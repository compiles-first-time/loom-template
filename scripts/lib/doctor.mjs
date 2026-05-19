#!/usr/bin/env node
// `loom doctor` — cross-checks a Loom project for v0.2 conformance.
//
// Exit codes:
//   0  all checks passed (warnings allowed)
//   1  one or more hard checks failed
//
// Per ADR-0015.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FIX = args.has("--fix");

const results = [];
function hard(name, ok, detail) {
  results.push({ name, level: "hard", ok, detail });
}
function soft(name, ok, detail) {
  results.push({ name, level: "soft", ok, detail });
}

await main();

async function main() {
  await checkPlaceholders();
  await checkSizeCaps();
  await checkProposedAdrsInClaude();
  await checkMcpAlignment();
  await checkSubagentsParse();
  await checkEventLogCoverage();
  await checkConstitutionCoverage();
  await checkSkeleton();

  report();
}

// ── Checks ───────────────────────────────────────────────────────────────

async function checkPlaceholders() {
  const FILES = [
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
    "loom-spec.md",
    "memory/self-knowledge.md",
    "tools/mcp-servers/config.yaml",
    "observability/langfuse-config.yaml",
  ];
  const tokens = ["<PROJECT_NAME>", "<USER_NAME>", "<YYYY-MM-DD>"];
  const hits = [];
  for (const rel of FILES) {
    const p = path.join(ROOT, rel);
    if (!existsSync(p)) continue;
    const text = await fs.readFile(p, "utf8");
    const found = tokens.filter((t) => text.includes(t));
    if (found.length) hits.push({ file: rel, tokens: found });
  }
  if (hits.length === 0) return hard("placeholders", true, "no <PLACEHOLDER> tokens remain in stamped files");

  if (FIX) {
    return hard("placeholders", false, `--fix cannot guess project/user names; run scripts/bootstrap.{sh,ps1} with the right args. Hits: ${JSON.stringify(hits)}`);
  }
  hard("placeholders", false, `unstamped tokens remain in ${hits.length} file(s): ${hits.map((h) => h.file).join(", ")}`);
}

async function checkSizeCaps() {
  const caps = [
    { rel: "CLAUDE.md", capBytes: 10 * 1024, label: "CLAUDE.md ≤ 10 KB" },
    { rel: "AGENTS.md", capBytes: 5 * 1024, label: "AGENTS.md ≤ 5 KB" },
  ];
  for (const { rel, capBytes, label } of caps) {
    const p = path.join(ROOT, rel);
    if (!existsSync(p)) {
      hard(label, false, `${rel} missing`);
      continue;
    }
    const bytes = (await fs.stat(p)).size;
    if (bytes <= capBytes) hard(label, true, `${bytes} bytes`);
    else hard(label, false, `${bytes} bytes > ${capBytes}`);
  }
}

async function checkProposedAdrsInClaude() {
  const adrDir = path.join(ROOT, "adr");
  if (!existsSync(adrDir)) return hard("proposed-adrs-in-claude", false, "adr/ directory missing");
  const files = (await fs.readdir(adrDir)).filter((f) => /^\d{4}-.+\.md$/.test(f));
  const proposed = [];
  for (const f of files) {
    // ADR-0000 is the *template* — its Status line is a literal enumeration
    // "Proposed | Accepted | Superseded by ADR-XXXX", not a real status.
    if (/^0000-/.test(f)) continue;
    const text = await fs.readFile(path.join(adrDir, f), "utf8");
    const m = text.match(/\*\*Status:\*\*\s*([^\n]+)/);
    if (!m) continue;
    // Real Proposed status starts with "Proposed" and does NOT contain "Accepted"
    // (the template-0000 enumeration "Proposed | Accepted | Superseded ..." would match).
    const status = m[1].trim();
    if (/^Proposed\b/i.test(status) && !/\bAccepted\b/i.test(status)) {
      const numMatch = f.match(/^(\d{4})/);
      if (numMatch) proposed.push(numMatch[1]);
    }
  }
  const claudePath = path.join(ROOT, "CLAUDE.md");
  if (!existsSync(claudePath)) return hard("proposed-adrs-in-claude", false, "CLAUDE.md missing");
  const claudeText = await fs.readFile(claudePath, "utf8");

  // Look for the "ADRs in flight" section.
  const flightIdx = claudeText.indexOf("ADRs in flight");
  const flightBlock = flightIdx >= 0 ? claudeText.slice(flightIdx, flightIdx + 1500) : "";

  const missing = proposed.filter((n) => !flightBlock.includes(n));
  if (proposed.length === 0) return hard("proposed-adrs-in-claude", true, "no Proposed ADRs");
  if (missing.length === 0) return hard("proposed-adrs-in-claude", true, `${proposed.length} Proposed ADR(s) all listed in CLAUDE.md`);
  hard("proposed-adrs-in-claude", false, `Proposed ADRs missing from CLAUDE.md "ADRs in flight": ${missing.join(", ")}`);
}

async function checkMcpAlignment() {
  const gen = path.join(ROOT, "scripts", "lib", "mcp-yaml-to-settings.mjs");
  if (!existsSync(gen)) return hard("mcp-yaml-json-alignment", false, "scripts/lib/mcp-yaml-to-settings.mjs missing");
  const result = spawnSync("node", [gen, "--check"], { cwd: ROOT, encoding: "utf8" });
  if (result.status === 0) return hard("mcp-yaml-json-alignment", true, "tools/mcp-servers/config.yaml ↔ .claude/settings.json#mcpServers in sync");
  if (FIX) {
    const fix = spawnSync("node", [gen], { cwd: ROOT, encoding: "utf8" });
    if (fix.status === 0) return hard("mcp-yaml-json-alignment", true, "regenerated via --fix");
    return hard("mcp-yaml-json-alignment", false, `--fix failed: ${fix.stderr || fix.stdout}`);
  }
  hard("mcp-yaml-json-alignment", false, `drift; run with --fix or \`node scripts/lib/mcp-yaml-to-settings.mjs\`. ${result.stderr.trim() || result.stdout.trim()}`);
}

async function checkSubagentsParse() {
  const dir = path.join(ROOT, ".claude", "agents");
  if (!existsSync(dir)) return hard("subagents-present", false, ".claude/agents/ missing");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  if (files.length < 6) return hard("subagents-present", false, `expected ≥ 6 subagents, found ${files.length}`);
  const bad = [];
  for (const f of files) {
    const text = await fs.readFile(path.join(dir, f), "utf8");
    if (!/^---\s*\n[\s\S]+?\n---/.test(text)) bad.push(`${f}: missing or malformed frontmatter`);
    if (!/^name:\s*\S+/m.test(text)) bad.push(`${f}: missing 'name:' field`);
    if (!/^description:\s*\S+/m.test(text)) bad.push(`${f}: missing 'description:' field`);
  }
  if (bad.length) return hard("subagents-present", false, bad.join("; "));
  hard("subagents-present", true, `${files.length} subagents, all parse-clean`);
}

async function checkEventLogCoverage() {
  // Soft: ratio of commit days in last 14 with at least one event-log entry.
  const log = spawnSync(
    "git",
    ["log", "--since=14.days", "--format=%cs"],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (log.status !== 0) return soft("event-log-coverage", true, "git history unavailable (skipped)");
  const commitDays = new Set((log.stdout || "").trim().split("\n").filter(Boolean));
  if (commitDays.size === 0) return soft("event-log-coverage", true, "no commits in last 14 days (skipped)");
  const eventDir = path.join(ROOT, "memory", "event-log");
  let coveredDays = new Set();
  if (existsSync(eventDir)) {
    const files = (await fs.readdir(eventDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    coveredDays = new Set(files.map((f) => f.replace(".jsonl", "")));
  }
  const covered = [...commitDays].filter((d) => coveredDays.has(d)).length;
  const total = commitDays.size;
  const ratio = total ? covered / total : 1;
  const detail = `${covered}/${total} commit days have an event-log file (last 14 days)`;
  if (ratio >= 0.5) soft("event-log-coverage", true, detail);
  else soft("event-log-coverage", false, `${detail} — under 50%; hooks may have been disabled`);
}

async function checkConstitutionCoverage() {
  // Soft check (LR-02 / ADR-0017): for each session in the last 14 days that
  // emitted a production_mutation_attempted event, was there a prior
  // constitution-service claim in the same session?
  const eventDir = path.join(ROOT, "memory", "event-log");
  if (!existsSync(eventDir)) return soft("constitution-coverage", true, "no event log (skipped)");
  const files = (await fs.readdir(eventDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  // last 14 by name sort
  files.sort();
  const recent = files.slice(-14);
  const sessions = new Map(); // session_id -> { mutated, constitutionClaimed }
  for (const f of recent) {
    let text;
    try {
      text = await fs.readFile(path.join(eventDir, f), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      const sid = rec.session_id;
      if (!sid) continue;
      const cur = sessions.get(sid) || { mutated: false, constitutionClaimed: false };
      if (rec.event_type === "production_mutation_attempted") cur.mutated = true;
      if (rec.event_type === "claim") {
        const agent = String(rec.agent || "").toLowerCase();
        if (agent === "constitution-service" || agent.endsWith("/constitution-service")) {
          cur.constitutionClaimed = true;
        }
      }
      sessions.set(sid, cur);
    }
  }
  let violations = 0;
  for (const v of sessions.values()) {
    if (v.mutated && !v.constitutionClaimed) violations++;
  }
  if (violations === 0) {
    soft("constitution-coverage", true, "no sessions mutated prod without a constitution-service claim (last 14 days)");
  } else {
    soft("constitution-coverage", false, `${violations} session(s) mutated prod without a constitution-service claim (LR-02). Grep memory/event-log/ for production_mutation_attempted to find them.`);
  }
}

async function checkSkeleton() {
  const required = [
    "CLAUDE.md",
    "AGENTS.md",
    "constitution/kernel-v6.md",
    "spec/loom-spec-v0.1-full.md",
    "tools/mcp-servers/config.yaml",
    ".claude/settings.json",
  ];
  const missing = required.filter((rel) => !existsSync(path.join(ROOT, rel)));
  if (missing.length === 0) hard("skeleton-intact", true, "core files present");
  else hard("skeleton-intact", false, `missing: ${missing.join(", ")}`);
}

// ── Report ───────────────────────────────────────────────────────────────

function report() {
  let hardFailed = 0;
  let softFailed = 0;
  for (const r of results) {
    const mark = r.ok ? "✓" : r.level === "hard" ? "✗" : "!";
    const tag = r.level === "hard" ? "" : " (warn)";
    process.stdout.write(`  ${mark} ${r.name}${tag}: ${r.detail}\n`);
    if (!r.ok) {
      if (r.level === "hard") hardFailed++;
      else softFailed++;
    }
  }
  process.stdout.write(
    `\n${hardFailed === 0 && softFailed === 0 ? "All checks passed." : `${hardFailed} hard failure(s), ${softFailed} warning(s).`}\n`
  );
  process.exit(hardFailed > 0 ? 1 : 0);
}
