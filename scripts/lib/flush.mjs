#!/usr/bin/env node
// `loom flush` — read-only system-flush reporter (ADR-0058-era follow-up to the
// 2026-08-04 internal flush). Surfaces latent gaps across four axes and EXITS.
// It NEVER edits anything: fixes are a separate, user-consented act (Rule 19 /
// Rule 1 — burning tokens on unconsented changes would itself violate consent).
//
// Axes: (1) broken internal markdown links — TUNED to skip bootstrap-generated
// forward-references (the naive first-pass over-reported these ~50%; see the
// flush pros/cons discussion), (2) libs with no test coverage, (3) fuzz the pure
// parsers/classifiers (must degrade, never throw), (4) dead refs to removed
// paths. Deterministic; complements the judgment-based monthly audit.
//
// Exit: 0 if zero REAL findings, 1 otherwise (so CI/precheck can gate on it),
// but it is advisory — a finding is a prompt to triage, not an auto-fix trigger.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.argv[2] || process.cwd();
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

// Link targets that are legitimately absent in a fresh template: the discovery
// flow + bootstrap GENERATE these per project, so a doc referencing them is a
// forward-reference, not a broken link. Keeping this list is why the tuned
// flush doesn't cry wolf (the lesson from the naive first pass).
const BOOTSTRAP_GENERATED = [
  "discovery/quick-scan.md", "discovery/requirements.md", "discovery/risk-register.md",
  "discovery/open-questions.md", "orchestration/work-graph.json", "self-knowledge.md",
];
// Path-boundary-anchored so a typo like `old-self-knowledge.md` is NOT
// mistaken for the allowlisted `self-knowledge.md` (critic flag 1, 2026-08-04).
const isBootstrapForwardRef = (target) => {
  const t = target.replace(/\\/g, "/");
  return BOOTSTRAP_GENERATED.some((g) => t === g || t.endsWith("/" + g));
};

function walk(dir, filter, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "archive"].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

export function findBrokenLinks(root) {
  const md = walk(root, (f) => f.endsWith(".md"));
  const RE = /\[[^\]]*\]\(([^)]+)\)/g;
  const broken = [];
  for (const f of md) {
    // constitution/history/ is an archival, explicitly in-place-immutable copy
    // (its own header forbids editing). Its relative links reflect the file's
    // original location and are stale-by-move; we do NOT edit an immutable file
    // to fix cosmetic link depth, so this dir is a documented skip — not a
    // silent allowlist. New breakage elsewhere still surfaces.
    if (rel(f).startsWith("constitution/history/")) continue;
    const text = readFileSync(f, "utf8");
    let m;
    while ((m = RE.exec(text)) !== null) {
      let t = m[1].trim();
      if (/^(https?:|mailto:|#|<)/.test(t)) continue;
      t = t.split("#")[0].split("?")[0];
      if (!t || t.startsWith("$") || t.includes("<") || t.includes("NNNN")) continue; // template placeholders
      const resolved = path.resolve(path.dirname(f), t);
      if (isBootstrapForwardRef(path.relative(root, resolved))) continue;              // tuned: forward-ref, not a gap
      if (!existsSync(resolved)) broken.push(`${rel(f)} → ${m[1]}`);
    }
  }
  return broken;
}

function untestedLibs(root) {
  const dir = path.join(root, "scripts", "lib");
  if (!existsSync(dir)) return [];
  const libs = readdirSync(dir).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"));
  const testText = walk(root, (f) => f.endsWith(".test.mjs")).map((f) => readFileSync(f, "utf8"));
  return libs
    .filter((lib) => !existsSync(path.join(dir, lib.replace(".mjs", ".test.mjs"))) && !testText.some((t) => t.includes(`/${lib}`)))
    .map((lib) => `scripts/lib/${lib}`);
}

const JUNK = [null, undefined, 0, NaN, true, "", "\r\n---\r\n", "﻿---\nx", "x".repeat(50000),
  {}, [], [null], "---\n\n---", "\x00\x01", "]]]{{{", '{"unterminated', "---\nk: [unclosed"];
async function fuzzModule(root, relPath, fns) {
  const crashes = [];
  let mod;
  try { mod = await import(pathToFileURL(path.join(root, relPath)).href); }
  catch (e) { return [`import ${relPath}: ${e.message}`]; }
  for (const [name, wrap] of fns) {
    const fn = mod[name];
    if (typeof fn !== "function") continue;
    for (const j of JUNK) {
      try { fn(...wrap(j)); } catch (e) { crashes.push(`${name}(${safe(j)}) → ${e.message}`); }
    }
  }
  return crashes;
}
const safe = (v) => { try { return typeof v === "string" ? JSON.stringify(v.slice(0, 16)) : String(v); } catch { return "?"; } };

function deadRefs(root) {
  const md = walk(root, (f) => f.endsWith(".md"));
  const out = [];
  for (const f of md) {
    const r = rel(f);
    if (r.startsWith("adr/0031")) continue; // ADR-0031 documents the handoff retirement itself
    const text = readFileSync(f, "utf8");
    if (/\]\(\.{0,2}\/?handoff\//.test(text)) out.push(`${r} links to removed handoff/`);
  }
  return out;
}

export async function runFlush(root) {
  return {
    brokenLinks: findBrokenLinks(root),
    untestedLibs: untestedLibs(root),
    fuzzCrashes: [
      ...await fuzzModule(root, "scripts/lib/update-bus-tick.mjs", [["parseFrontmatter", (x) => [x]]]),
      ...await fuzzModule(root, "scripts/lib/source-tier-classifier.mjs", [["classifySourceTier", (x) => [x]]]),
      ...await fuzzModule(root, "scripts/lib/admission-check.mjs", [["admissionCheck", (x) => [x]], ["estimateTokens", (x) => [x]]]),
      ...await fuzzModule(root, "scripts/lib/calibration.mjs", [["claimKey", (x) => [x]]]),
    ],
    deadRefs: deadRefs(root),
  };
}

async function main() {
  const f = await runFlush(ROOT);
  const list = (a) => (a.length ? a.map((x) => "    - " + x).join("\n") : "    (none)");
  console.log("\n═══ loom flush (READ-ONLY — fixes require your consent) ═══\n");
  console.log(`[1] Broken internal links, bootstrap forward-refs excluded (${f.brokenLinks.length}):\n${list(f.brokenLinks)}`);
  console.log(`\n[2] Libs with no test coverage (${f.untestedLibs.length}):\n${list(f.untestedLibs)}`);
  console.log(`\n[3] Fuzz crashes — pure fns that throw on dirty input (${f.fuzzCrashes.length}):\n${list(f.fuzzCrashes)}`);
  console.log(`\n[4] Dead references to removed paths (${f.deadRefs.length}):\n${list(f.deadRefs)}`);
  const total = Object.values(f).reduce((n, a) => n + a.length, 0);
  console.log(`\n═══ ${total} finding(s). This report changed nothing. Triage real-vs-by-design before fixing (with consent). ═══`);
  process.exit(total ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
}
