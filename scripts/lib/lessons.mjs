#!/usr/bin/env node
// Lessons-Learned Service — Phase 0 (ADR-0055): standardized frontmatter schema
// + `loom lessons search` over LOCAL files + soft-check validation. Zero-infra:
// no canonical store, no hosted index yet — just schema + offline search.
//
// Pure functions are exported (testable); a thin CLI at the bottom is guarded so
// importing this module never runs it. Wrappers: scripts/lessons.{sh,ps1}.
//
// Usage:
//   node scripts/lib/lessons.mjs search "<query>" [--domain d --stack s --platform p]
//   node scripts/lib/lessons.mjs validate            (schema soft-check over all lessons)

import { promises as fs, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scanForSecrets } from "./secret-patterns.mjs";

const ROOT = process.env.LOOM_PROJECT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LESSONS_DIR = path.join(ROOT, "lessons-learned");

// ── Schema (ADR-0055) ──────────────────────────────────────────────────────
export const LESSON_REQUIRED_FIELDS = ["id", "title", "domain", "stack", "severity", "share", "provenance"];

// Optional since 2026-08-16 (L3 recursive-ingestion guard): `agent_authored:
// true|false` marks whether the lesson was written by an agent or a human.
// Lessons are mostly agent-written and agent-consumed; making machine
// provenance visible is the cheap half of the model-collapse defense (the
// expensive half — human gating on cross-project promotion — is ADR-0055).
// Optional, not required: retro-stamping 25 existing lessons with guessed
// authorship would fabricate provenance, which is the exact sin ADR-0060 bans.
export const LESSON_OPTIONAL_FIELDS = ["agent_authored", "supersedes", "embedding_hash"];
export const LESSON_ALL_FIELDS = [
  "id", "title", "domain", "stack", "platform", "severity", "share",
  "supersedes", "provenance", "created", "updated", "embedding_hash",
];

// ── Minimal frontmatter parser (the lesson shape, not arbitrary YAML) ────────
// Handles: scalars, inline arrays `[a, b]`, booleans/numbers, and ONE nested
// block (`provenance:` with indented sub-keys incl. an inline array `sources`).
export function parseFrontmatter(text = "") {
  // Normalize BOM + CRLF (Windows clones check out CRLF) so the fence regex and
  // line splitting are line-ending-agnostic.
  text = String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const m = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/.exec(text);
  if (!m) return { frontmatter: {}, body: text, hasFrontmatter: false };
  const fmRaw = m[1];
  const body = m[2] || "";
  const fm = {};
  const lines = fmRaw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!top) continue;
    const key = top[1];
    let val = top[2];
    if (val === "" ) {
      // Possibly a nested block (indented children follow).
      const nested = {};
      let hasChild = false;
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        const child = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[++i]);
        if (child) { nested[child[1]] = coerce(child[2]); hasChild = true; }
      }
      fm[key] = hasChild ? nested : null;
    } else {
      fm[key] = coerce(val);
    }
  }
  return { frontmatter: fm, body, hasFrontmatter: true };
}

// Quote-aware split of an inline array `[a, "b, c"]` → ["a", "b, c"]. A comma
// inside quotes is NOT a separator (critic 2026-07-15) — the schema's own
// `sources` examples are free-text and can contain commas.
function splitInlineArray(s) {
  const inner = s.slice(1, -1);
  const out = [];
  let cur = "";
  let q = null;
  for (const ch of inner) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ",") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out.filter((x) => x !== "");
}

function coerce(v) {
  const s = String(v).trim();
  if (s === "") return null;
  if (/^\[.*\]$/.test(s)) return splitInlineArray(s);
  // Unwrap ONLY when the ENTIRE value is wrapped in matching quotes. A value
  // with an embedded (non-wrapping) quote — e.g. a title `"Auth error" on write
  // while reads succeed …` — must be preserved verbatim, not have its leading
  // quote silently stripped (critic 2026-07-15, confirmed live corruption).
  const qm = /^"([\s\S]*)"$/.exec(s) || /^'([\s\S]*)'$/.exec(s);
  const unq = qm ? qm[1] : s;
  if (unq === "null") return null;
  if (unq === "true") return true;
  if (unq === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(unq)) return Number(unq);
  return unq;
}

// ── Validation (soft) ────────────────────────────────────────────────────────
export function validateLessonSchema(fm = {}) {
  const missing = LESSON_REQUIRED_FIELDS.filter((f) => fm[f] === undefined || fm[f] === null || (Array.isArray(fm[f]) && fm[f].length === 0));
  const warnings = [];
  const conf = fm.provenance && typeof fm.provenance === "object" ? fm.provenance.confidence : undefined;
  if (typeof conf === "number" && conf < 0.5 && String(fm.severity).toLowerCase() === "high") {
    warnings.push(`confidence ${conf} < 0.5 but severity: high — sanity-check this lesson`);
  }
  return { ok: missing.length === 0, missing, warnings, conforms: missing.length === 0 };
}

// A lesson with share:false must never be a push candidate (data-egress safety).
export function isPushCandidate(fm = {}) {
  return fm.share === true;
}

// ── Secrets soft-check (reuse the shared patterns) ───────────────────────────
export function scanLessonForSecrets(body = "") {
  return scanForSecrets(body);
}

// ── Dedup (Phase-0 stand-in: token Jaccard; embeddings arrive in Phase 1) ────
export function tokenSet(text = "") {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}
export function similarity(a = "", b = "") {
  const A = tokenSet(a), B = tokenSet(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
export function findDuplicate(lessons, candidateBody, threshold = 0.8) {
  let best = null;
  for (const l of lessons) {
    const sim = similarity(candidateBody, l.body);
    if (sim >= threshold && (!best || sim > best.similarity)) best = { id: l.frontmatter.id || l.file, similarity: sim };
  }
  return best;
}

// ── Search ───────────────────────────────────────────────────────────────────
export function searchLessons(lessons, query = "", filters = {}) {
  const terms = String(query).toLowerCase().match(/[a-z0-9]{2,}/g) || [];
  const norm = (v) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : v == null ? [] : [String(v).toLowerCase()]);
  const results = [];
  for (const l of lessons) {
    const fm = l.frontmatter || {};
    // Hard filters: if specified, the lesson must carry the tag.
    if (filters.domain && !norm(fm.domain).includes(filters.domain.toLowerCase())) continue;
    if (filters.stack && !norm(fm.stack).includes(filters.stack.toLowerCase())) continue;
    if (filters.platform && !norm(fm.platform).includes(filters.platform.toLowerCase())) continue;

    const tags = [...norm(fm.domain), ...norm(fm.stack), ...norm(fm.platform)];
    const title = String(fm.title || l.file).toLowerCase();
    const body = String(l.body || "").toLowerCase();
    // Metadata match dominates; textual relevance breaks ties.
    let metaScore = 0, textScore = 0;
    for (const t of terms) {
      if (tags.some((tag) => tag.includes(t))) metaScore += 1;
      if (title.includes(t)) textScore += 2;
      if (body.includes(t)) textScore += 1;
    }
    // With no query terms, a filter match alone qualifies (list-by-tag).
    const filterOnly = terms.length === 0 && (filters.domain || filters.stack || filters.platform);
    if (metaScore === 0 && textScore === 0 && !filterOnly) continue;
    results.push({ ...l, score: metaScore * 1000 + textScore, metaScore, textScore });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function formatResult(hit, idx) {
  const fm = hit.frontmatter || {};
  const arr = (v) => (Array.isArray(v) ? v.join(", ") : v || "");
  const prov = fm.provenance && typeof fm.provenance === "object" ? fm.provenance : {};
  return [
    `[${idx}] ${fm.title || hit.file}`,
    `    id: ${fm.id || "(none)"}`,
    `    severity: ${fm.severity || "?"} | domain: ${arr(fm.domain)} | stack: ${arr(fm.stack)} | platform: ${arr(fm.platform)}`,
    `    origin: ${prov.origin_project || "?"} | confidence: ${prov.confidence ?? "?"}`,
    `    created: ${fm.created || "?"}`,
  ].join("\n");
}

// ── Loader ───────────────────────────────────────────────────────────────────
export function loadLessons(dir = LESSONS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => {
      const text = readFileSync(path.join(dir, f), "utf8");
      const { frontmatter, body, hasFrontmatter } = parseFrontmatter(text);
      return { file: f, frontmatter, body, hasFrontmatter };
    });
}

// ── CLI (guarded — importing this module never runs it) ──────────────────────
async function runCli(argv) {
  const [cmd, ...rest] = argv;
  const filters = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--domain") filters.domain = rest[++i];
    else if (rest[i] === "--stack") filters.stack = rest[++i];
    else if (rest[i] === "--platform") filters.platform = rest[++i];
    else if (rest[i] === "--local") { /* Phase 0 is always local */ }
    else positional.push(rest[i]);
  }
  const lessons = loadLessons();

  if (cmd === "search") {
    const query = positional.join(" ");
    const hits = searchLessons(lessons, query, filters);
    if (hits.length === 0) { process.stdout.write("No matching lessons.\n"); return 0; }
    process.stdout.write(hits.map((h, i) => formatResult(h, i + 1)).join("\n\n") + "\n");
    return 0;
  }
  if (cmd === "validate") {
    let conforming = 0;
    const report = [];
    for (const l of lessons) {
      const v = validateLessonSchema(l.frontmatter);
      if (v.conforms) conforming++;
      else report.push(`  ${l.file}: missing ${v.missing.join(", ")}`);
      for (const w of v.warnings) report.push(`  ${l.file}: WARN ${w}`);
    }
    const pct = lessons.length ? Math.round((conforming / lessons.length) * 100) : 100;
    process.stdout.write(`lessons schema: ${conforming}/${lessons.length} conform (${pct}%)\n`);
    if (report.length) process.stdout.write(report.join("\n") + "\n");
    return 0;
  }
  process.stderr.write("usage: lessons.mjs search \"<query>\" [--domain d --stack s --platform p] | validate\n");
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => { process.stderr.write(String(e) + "\n"); process.exit(1); });
}

void fs; // reserved for async loader variants
