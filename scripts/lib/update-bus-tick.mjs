#!/usr/bin/env node
// `loom update-bus tick` — v0.3 receiver (ADR-0057; upgrades the ADR-0016 stub).
//
// What this tick DOES:
//   1. Validates every update-bus/inbox/*.md item's frontmatter against the
//      constraints in update-bus/schema.json (required fields, id pattern,
//      enums, types — a native zero-dep check driven by the schema file).
//   2. Surfaces pending items for Critic review (prints the review queue and
//      emits an `update_bus_tick` event to the JSONL log so the Observatory
//      and audit trail see the state).
//   3. Keeps the original stub behavior: inbox/archive counts + schema parse.
//
// What this tick deliberately does NOT do (Kernel Rule 19 / L7 anti-collapse):
//   - It never applies or merges a proposal.
//   - It never moves items to archive/ — only the post-USER-approval apply
//     flow does that. collapse_risk items can never be auto-merged at all.
//
// Feed polling itself is the research-scout agent's job (.claude/agents/
// research-scout.md, ADR-0057) — an LLM judgment task (tiering, dedup,
// ≥2-source validation), not a script task. The scout writes the inbox; this
// tick validates and hands off to the Critic.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const INBOX = path.join(ROOT, "update-bus", "inbox");
const ARCHIVE = path.join(ROOT, "update-bus", "archive");
const SCHEMA = path.join(ROOT, "update-bus", "schema.json");

// ── Pure helpers (exported for tests) ───────────────────────────────────────

// Minimal frontmatter parser for the README's item shape: `key: value` lines,
// inline arrays `[a, b]`, booleans, quoted or bare strings. Returns null when
// the file has no frontmatter block.
// BOM strip: Windows writers (PowerShell Out-File/Set-Content) prepend a BOM
// by default, which breaks the ^--- anchor — same bug already fixed once in
// observatory/lib/file-watcher.mjs for these exact files.
export function parseFrontmatter(text) {
  let src = String(text || "");
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) return null;
  const out = {};
  let pendingList = null; // key whose value may continue as a block list (`- item` lines)
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, ""); // strip trailing comments
    const trimmed = line.trim();
    if (!trimmed) continue;
    const li = /^-\s+(.*)$/.exec(trimmed);
    if (li && pendingList) {
      if (!Array.isArray(out[pendingList])) out[pendingList] = [];
      out[pendingList].push(stripQuotes(li[1].trim()));
      continue;
    }
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(trimmed);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    if (rawVal.trim() === "") {
      out[key] = ""; // stays "" unless block-list items follow
      pendingList = key;
      continue;
    }
    out[key] = parseScalar(rawVal.trim());
    pendingList = null;
  }
  return out;
}

function parseScalar(v) {
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => stripQuotes(s.trim()));
  }
  return stripQuotes(v);
}

function stripQuotes(s) {
  return /^(['"]).*\1$/.test(s) ? s.slice(1, -1) : s;
}

// Validate one parsed frontmatter object against the constraints expressed in
// update-bus/schema.json: required fields, `pattern`, `enum`, boolean/array
// `type`, and `format: date` on top-level properties (the only shapes the
// line-based parser can produce). Returns an array of error strings (empty =
// valid). Schema-driven so schema edits don't require editing this file.
export function validateInboxItem(fm, schema) {
  const errors = [];
  if (!fm || typeof fm !== "object") return ["no frontmatter block found"];
  for (const req of schema.required || []) {
    if (!(req in fm)) errors.push(`missing required field: ${req}`);
  }
  for (const [key, def] of Object.entries(schema.properties || {})) {
    if (!(key in fm)) continue;
    const val = fm[key];
    if (def.enum && !def.enum.includes(val)) {
      errors.push(`${key}: "${val}" not in [${def.enum.join(", ")}]`);
    }
    if (def.pattern && typeof val === "string" && !new RegExp(def.pattern).test(val)) {
      errors.push(`${key}: "${val}" does not match ${def.pattern}`);
    }
    if (def.type === "boolean" && typeof val !== "boolean") {
      errors.push(`${key}: expected boolean, got ${typeof val}`);
    }
    if (def.type === "array" && !Array.isArray(val)) {
      errors.push(`${key}: expected array, got ${typeof val}`);
    }
    if (def.format === "date" && typeof val === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      errors.push(`${key}: "${val}" is not YYYY-MM-DD`);
    }
  }
  return errors;
}

// ── Tick ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("loom update-bus tick (v0.3 receiver, ADR-0057) — validate + surface; never applies.\n");

  if (!existsSync(SCHEMA)) {
    console.error("error: update-bus/schema.json missing");
    process.exit(1);
  }
  let schema;
  try {
    schema = JSON.parse(await fs.readFile(SCHEMA, "utf8"));
    console.log("  ✓ schema.json parses");
  } catch (err) {
    console.error(`  ✗ schema.json malformed: ${err.message}`);
    process.exit(1);
  }

  // Validate inbox items
  const inboxFiles = existsSync(INBOX)
    ? (await fs.readdir(INBOX)).filter((f) => f.endsWith(".md") && f !== "README.md")
    : [];
  const valid = [];
  const invalid = [];
  for (const f of inboxFiles) {
    const text = await fs.readFile(path.join(INBOX, f), "utf8");
    const fm = parseFrontmatter(text);
    const errors = validateInboxItem(fm, schema);
    if (errors.length) invalid.push({ file: f, errors });
    else valid.push({ file: f, id: fm.id, source_tier: fm.source_tier, risk: fm.risk, collapse_risk: fm.collapse_risk, pendingCritic: !fm.critic_review });
  }

  const archiveCount = existsSync(ARCHIVE)
    ? (await listFilesRecursive(ARCHIVE)).filter((f) => f.endsWith(".md")).length
    : 0;

  console.log(`  ✓ inbox/   ${inboxFiles.length} item(s): ${valid.length} valid, ${invalid.length} malformed`);
  console.log(`  ✓ archive/ ${archiveCount} resolved`);

  for (const bad of invalid) {
    console.error(`\n  ✗ ${bad.file} fails schema validation:`);
    for (const e of bad.errors) console.error(`      - ${e}`);
    console.error("    Fix the frontmatter or remove the file; malformed items are NOT surfaced for review.");
  }

  // Surface the Critic review queue (notification step of the v0.3 plan).
  const pending = valid.filter((v) => v.pendingCritic);
  if (pending.length) {
    console.log(`\n  → ${pending.length} item(s) awaiting Critic review (L7 pipeline: Critic → Human Replica → user):`);
    for (const p of pending) {
      console.log(`      - ${p.id}  [tier ${p.source_tier ?? "?"} · risk ${p.risk}${p.collapse_risk ? " · COLLAPSE-RISK (never auto-merged)" : ""}]`);
    }
    console.log('    Invoke the critic subagent on these items (e.g. via the Claude Code session: "critic: review the update-bus inbox").');
  } else if (valid.length) {
    console.log("\n  → all valid items already carry a critic_review — pipeline continues downstream.");
  } else {
    console.log("\n  → inbox empty; nothing awaiting review.");
  }

  // Audit-trail event (best-effort — hooks own the log format; reuse their lib).
  try {
    const { appendEvent, mechanicalRecord } = await import("../hooks/_lib.mjs");
    appendEvent(mechanicalRecord("update_bus_tick", {
      inbox_total: inboxFiles.length,
      valid: valid.length,
      malformed: invalid.length,
      pending_critic: pending.map((p) => p.id),
    }));
    console.log("  ✓ update_bus_tick event appended to the event log");
  } catch {
    console.log("  ! event-log append skipped (hooks lib unavailable in this context)");
  }

  console.log("\nThis tick validates and surfaces only. Applying/merging a proposal requires");
  console.log("USER approval (L7); collapse_risk items can never be auto-merged (Rule 19).");

  process.exit(invalid.length ? 1 : 0);
}

async function listFilesRecursive(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// CLI (guarded — importing never runs it); same idiom as verify-gate/lessons.
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}
