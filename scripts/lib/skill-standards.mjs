#!/usr/bin/env node
// Skill authoring + vetting standards (ADR-0063).
//
// The chameleon architecture (few standing agents, many EAC-synthesized skills)
// makes skill QUALITY the load-bearing discipline: a skill costs a line in an
// index until invoked, so the population grows without bound — and nothing in
// Loom checked any property of that population. Per the standing lesson
// (2026-08-13), an unchecked convention drifts; this module is the check.
//
// Four mechanical floors, drawn from the 2026-08 practitioner corpus the
// architect supplied (analyzed against the repo before adoption):
//
//   1. DESCRIPTION IS THE TRIGGER. At routing time the model sees only the
//      name + description; a description that says what but not WHEN
//      under-triggers, and models already under-trigger. Agents' description
//      must carry when-language. (Registry specialists are routed by
//      manifest.yaml patterns, so their `summary` is only checked for
//      presence and length.)
//   2. SIZE BUDGET. A skill body competes with everything else in context.
//      ≤500 lines; beyond that, split detail into references/ and let the
//      agent pull files on demand (progressive disclosure).
//   3. DETERMINISTIC SCRIPTS FOR FRAGILE STEPS is an authoring rule enforced
//      by the register (BR_18) and the EAC standard, not here — a checker
//      cannot know which steps are fragile. Named so its absence from this
//      file reads as a decision, not an omission.
//   4. VET BEFORE INSTALL. A skill is a dependency: it is read by an agent
//      with tool access, and public-skill audits report ~35% with security
//      flaws. The mechanical floor scans skill bodies for embedded
//      remote-code-execution patterns; the judgment layer (Critic review of
//      third-party skills, LR-01) is documented in L4.
//
// Pure functions over file text; the doctor check does the walking.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

export const SIZE_BUDGET_LINES = 500;
export const DESCRIPTION_MAX = 1024;

// When-language that makes a description a trigger rather than a caption.
const TRIGGER_RE = /\bwhen\b|\buse (this|it|proactively|for|to)\b|\btrigger/i;

// Embedded-RCE floor for the vet check. Deliberately narrower than the
// loom-permissions destructive list: a skill may legitimately DISCUSS
// `rm -rf`; piping a remote download into a shell inside a skill body is a
// different animal. An intentional teaching example can carry
// `<!-- skill-vet: allow -->` on any line of the file.
export const VET_PATTERNS = [
  { re: /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python[0-9.]*|node)\b/, label: "remote download piped into a shell" },
  { re: /\bbase64\s+(?:-d|--decode)\b[^|\n]*\|\s*(?:sh|bash|zsh)\b/, label: "base64-decoded payload piped into a shell" },
  { re: /\b(?:iex|Invoke-Expression)\b.*(?:DownloadString|Net\.WebClient|Invoke-WebRequest)/i, label: "PowerShell download-and-execute" },
];
const VET_ALLOW = /<!--\s*skill-vet:\s*allow\s*-->/;

/** Parse simple `key: value` frontmatter. Returns {} when absent. */
export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(String(text || ""));
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

function bodyLines(text) {
  const s = String(text || "");
  const stripped = s.replace(/^---\n[\s\S]*?\n---\n?/, "");
  return stripped.split("\n").length;
}

/**
 * Check one skill artifact.
 * @param {object} opts
 * @param {string} opts.file  - repo-relative path (for reporting)
 * @param {string} opts.text  - file contents
 * @param {"command"|"agent"|"registry"} opts.kind
 * @returns {{file: string, findings: string[]}}
 */
export function checkSkill({ file, text, kind }) {
  const findings = [];
  const fm = parseFrontmatter(text);
  const lines = bodyLines(text);

  // ── size budget (progressive disclosure) ─────────────────────────────
  if (lines > SIZE_BUDGET_LINES) {
    findings.push(`${lines} lines > ${SIZE_BUDGET_LINES} budget — split detail into references/ (progressive disclosure)`);
  }

  // ── description present, bounded, and (for agents) a trigger ─────────
  if (kind === "agent") {
    const d = fm.description || "";
    if (!d) findings.push("no `description:` frontmatter — the agent can never be routed to");
    else {
      if (d.length > DESCRIPTION_MAX) findings.push(`description ${d.length} chars > ${DESCRIPTION_MAX}`);
      if (!TRIGGER_RE.test(d)) findings.push("description says what but not WHEN — add when-language (models under-trigger)");
    }
  } else if (kind === "registry") {
    const s = fm.summary || fm.description || "";
    if (!s) findings.push("no `summary:` frontmatter");
    else if (s.length > DESCRIPTION_MAX) findings.push(`summary ${s.length} chars > ${DESCRIPTION_MAX}`);
  } else if (kind === "command") {
    // Commands open with a prose paragraph that doubles as the description.
    const stripped = String(text || "").replace(/^---\n[\s\S]*?\n---\n?/, "");
    const firstProse = stripped.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (!firstProse || firstProse.trim().length < 40) {
      findings.push("no leading description paragraph (≥40 chars) — the skill index shows nothing useful");
    }
  }

  // ── embedded-RCE vet floor ───────────────────────────────────────────
  if (!VET_ALLOW.test(text)) {
    for (const { re, label } of VET_PATTERNS) {
      if (re.test(text)) findings.push(`vet: ${label} embedded in the skill body — review per L4 §Skill vetting, or annotate skill-vet: allow with justification`);
    }
  }

  return { file, findings };
}

/** Walk the three skill populations and check each artifact. */
export async function checkAllSkills(root = PROJECT_ROOT) {
  const out = [];
  const scan = async (dir, kind, pick) => {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = pick(dir, e);
      if (!p) continue;
      const text = await fs.readFile(p, "utf8").catch(() => null);
      if (text === null) continue;
      out.push(checkSkill({ file: path.relative(root, p).replace(/\\/g, "/"), text, kind }));
    }
  };

  await scan(path.join(root, ".claude", "commands"), "command", (d, e) =>
    e.isFile() && e.name.endsWith(".md") ? path.join(d, e.name) : null
  );
  await scan(path.join(root, ".claude", "agents"), "agent", (d, e) =>
    e.isFile() && e.name.endsWith(".md") ? path.join(d, e.name) : null
  );
  await scan(path.join(root, "agents", "specialists", "_registry"), "registry", (d, e) =>
    e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")
      ? path.join(d, e.name, "SKILL.md")
      : null
  );

  return out;
}

// ── Agent risk × capability classification (ADR-0063 §2) ─────────────────
//
// Loom classified ACTIONS (LR-04) and MODELS (ADR-0045) but never AGENTS.
// The 2×2 — risk (blast radius of what it touches) × capability (breadth of
// autonomous reasoning) — decides lifecycle and oversight:
//
//   low/low    → persistent, static least-privilege creds; treat traditionally
//   high-cap / low-risk  → reasoning is fine; damage is bounded
//   low-cap / high-risk  → predetermined actions on sensitive systems; extra
//                          business controls (LR-02 posture)
//   high/high  → the focus quadrant: MUST declare `hitl:` (its human gate),
//                and SHOULD be ephemeral when task-scoped (Rule 20 — a
//                standing high/high agent is a standing irreversible surface)
//
// Values live in agent frontmatter so the classification travels with the
// agent and doctor can hold it.

export const RISK_VALUES = ["low", "high"];
export const CAPABILITY_VALUES = ["low", "high"];
export const LIFECYCLE_VALUES = ["persistent", "ephemeral"];

/** Check one agent's classification frontmatter. */
export function checkAgentClassification({ file, text }) {
  const fm = parseFrontmatter(text);
  const findings = [];
  const need = (key, allowed) => {
    const v = fm[key];
    if (!v) findings.push(`missing \`${key}:\` (ADR-0063 classification)`);
    else if (!allowed.includes(v)) findings.push(`\`${key}: ${v}\` — must be one of ${allowed.join("|")}`);
    return v;
  };
  const risk = need("risk", RISK_VALUES);
  const capability = need("capability", CAPABILITY_VALUES);
  need("lifecycle", LIFECYCLE_VALUES);
  if (risk === "high" && capability === "high" && !(fm.hitl || "").trim()) {
    findings.push("high risk × high capability with no `hitl:` — the focus quadrant requires a named human gate");
  }
  return { file, findings };
}

export async function checkAllAgentClassifications(root = PROJECT_ROOT) {
  const dir = path.join(root, ".claude", "agents");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    const text = await fs.readFile(path.join(dir, f), "utf8").catch(() => null);
    if (text === null) continue;
    out.push(checkAgentClassification({ file: `.claude/agents/${f}`, text }));
  }
  return out;
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const skills = await checkAllSkills();
  const agents = await checkAllAgentClassifications();
  let bad = 0;
  for (const group of [skills, agents]) {
    for (const r of group) {
      if (r.findings.length === 0) continue;
      bad++;
      console.log(`\n  ! ${r.file}`);
      for (const f of r.findings) console.log(`      ${f}`);
    }
  }
  console.log(bad === 0 ? "\n  ✓ all skill artifacts and agent classifications conform\n" : `\n  ${bad} artifact(s) with findings\n`);
  process.exit(0);
}
