// Canonical BR_10 test cases (lessons-service Phase 0 / ADR-0055 / registry per ADR-0046).
//
// Consumed by scripts/lib/lessons.test.mjs. Covers the 8 Phase-0 acceptance
// CRITERIA formalized from docs/proposals/lessons-learned-service.md (schema
// round-trip, keyword search, metadata filter, secrets flag, confidence sanity,
// share respected, dedup, output format) plus smoke, malformed-tolerance, a
// real-load conformance check, and a real-value correctness check.

import {
  parseFrontmatter,
  validateLessonSchema,
  searchLessons,
  formatResult,
  isPushCandidate,
  scanLessonForSecrets,
  findDuplicate,
  similarity,
  loadLessons,
} from "../../../scripts/lib/lessons.mjs";

// A synthetic, schema-conformant lesson as raw text (for parse round-trip).
const LESSON_TEXT = `---
id: 2026-07-08-bootstrap-ps1-getdate-asutc-ps51
title: bootstrap.ps1 crashes on Windows PowerShell 5.1
domain: [tooling, windows, powershell]
stack: [loom, powershell]
platform: [win32]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: process-cartographer
  sources: [PR #76, ps1-portability]
  confidence: 0.98
created: 2026-07-08
updated: 2026-07-15
embedding_hash: null
---

# bootstrap.ps1 crashes on PS 5.1
Get-Date -AsUTC is a PowerShell 6+ token. Use [DateTime]::UtcNow instead.
`;

const lessonObj = (over = {}) => {
  const { frontmatter, body } = parseFrontmatter(LESSON_TEXT);
  return { file: "x.md", frontmatter: { ...frontmatter, ...over.frontmatter }, body: over.body ?? body };
};

export const BR_10_CASES = [
  {
    id: "BR_10", type: "BR", framework_location: "scripts/lib/lessons.mjs",
    title: "Searchable, schema'd local lessons",
    expected_input: "lessons-learned/*.md + a query",
    expected_output: "ranked local hits; schema-validated",
    justification: "ADR-0055 Phase 0 — compounding memory, zero-infra; unblocks the Phase-1 canonical store.",
    run() {
      const hits = searchLessons([lessonObj()], "powershell");
      const ok = hits.length === 1 && hits[0].frontmatter.id.includes("ps51");
      return { actual: `hits=${hits.length}`, pass: ok };
    },
  },
  {
    id: "BR-10_s1", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Schema round-trips (acceptance #1)",
    expected_input: "a schema-conformant lesson",
    expected_output: "all fields parse; arrays + nested provenance preserved",
    justification: "Frontmatter must round-trip so lessons are DB-ready (Phase 1 ingestion).",
    run() {
      const { frontmatter: fm } = parseFrontmatter(LESSON_TEXT);
      const ok = Array.isArray(fm.domain) && fm.domain.length === 3 &&
        fm.provenance && fm.provenance.confidence === 0.98 && fm.share === true &&
        validateLessonSchema(fm).conforms;
      return { actual: `domain=${JSON.stringify(fm.domain)}, conf=${fm.provenance?.confidence}, conforms=${validateLessonSchema(fm).conforms}`, pass: ok };
    },
  },
  {
    id: "BR-10_s2", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Keyword search ranks metadata match first (acceptance #2)",
    expected_input: 'search "powershell"',
    expected_output: "the powershell-tagged lesson outranks a body-only match",
    justification: "Rank by metadata match, then textual relevance (proposal).",
    run() {
      const tagged = lessonObj();
      const bodyOnly = { file: "y.md", frontmatter: { id: "other", title: "Other", domain: ["misc"], stack: ["x"], platform: ["linux"], severity: "low", share: true, provenance: { confidence: 0.5 } }, body: "mentions powershell once in prose" };
      const hits = searchLessons([bodyOnly, tagged], "powershell");
      const ok = hits.length === 2 && hits[0].frontmatter.id.includes("ps51");
      return { actual: `top=${hits[0]?.frontmatter.id}, metaScore=${hits[0]?.metaScore}`, pass: ok };
    },
  },
  {
    id: "BR-10_s3", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Metadata filter (acceptance #3)",
    expected_input: "--domain tooling --platform win32",
    expected_output: "filters to lessons carrying both tags",
    justification: "Filters are AND; a lesson must carry the tag to match.",
    run() {
      const win = lessonObj();
      const linux = { file: "z.md", frontmatter: { id: "lin", domain: ["tooling"], platform: ["linux"], stack: ["loom"], severity: "low", share: true, title: "L", provenance: {} }, body: "x" };
      const hits = searchLessons([win, linux], "", { domain: "tooling", platform: "win32" });
      const ok = hits.length === 1 && hits[0].frontmatter.id.includes("ps51");
      return { actual: `matched=${hits.length} (win32+tooling)`, pass: ok };
    },
  },
  {
    id: "BR-10_BE-01", type: "BE", framework_location: "scripts/lib/lessons.mjs",
    title: "share:false is NEVER a push candidate (acceptance #6)",
    expected_input: "a lesson with share:false",
    expected_output: "isPushCandidate false; searchable locally",
    justification: "Data-egress safety — a project-local lesson must never leave the repo (LR-03 spirit).",
    run() {
      const priv = lessonObj({ frontmatter: { share: false } });
      const searchable = searchLessons([priv], "powershell").length === 1;
      const ok = isPushCandidate(priv.frontmatter) === false && searchable;
      return { actual: `pushCandidate=${isPushCandidate(priv.frontmatter)}, searchableLocally=${searchable}`, pass: ok };
    },
  },
  {
    id: "BR-10_BE-02", type: "BE", framework_location: "scripts/lib/lessons.mjs",
    title: "Secret in lesson body is flagged (acceptance #4)",
    expected_input: "a body containing a token-shaped secret",
    expected_output: "scanLessonForSecrets returns a hit",
    justification: "Secret hygiene — a lesson must not leak a credential (reuses the shared secret patterns, ADR-0018).",
    run() {
      const hits = scanLessonForSecrets("oops we committed ghp_0123456789012345678901234567890123 to the repo");
      const ok = hits.length >= 1 && /GitHub/.test(hits[0].label);
      return { actual: `hits=${hits.length} (${hits[0]?.label || "none"})`, pass: ok };
    },
  },
  {
    id: "BR-10_BE-03", type: "BE", framework_location: "scripts/lib/lessons.mjs",
    title: "High severity + low confidence warns, does NOT block (acceptance #5)",
    expected_input: "severity: high, confidence: 0.3",
    expected_output: "a warning; conforms still true (soft, not a hard block)",
    justification: "Phase-0 gates are warnings — the author is signalled, not stopped (hard gates are Phase 1+).",
    run() {
      const fm = { id: "a", title: "t", domain: ["x"], stack: ["y"], severity: "high", share: true, provenance: { confidence: 0.3 } };
      const v = validateLessonSchema(fm);
      const ok = v.conforms === true && v.warnings.some((w) => /confidence/.test(w));
      return { actual: `conforms=${v.conforms}, warnings=${v.warnings.length}`, pass: ok };
    },
  },
  {
    id: "BR-10_BE-04", type: "BE", framework_location: "scripts/lib/lessons.mjs",
    title: "Near-duplicate is flagged (acceptance #7)",
    expected_input: "two lessons with >80% token overlap",
    expected_output: "findDuplicate returns the near-neighbour (supersede, don't add a 500th copy)",
    justification: "LR-05 — update/supersede rather than duplicate. Phase-0 uses token overlap; embeddings arrive in Phase 1.",
    run() {
      const existing = [{ file: "e.md", frontmatter: { id: "existing" }, body: "PowerShell 5.1 fails on Get-Date -AsUTC because it is a version six only token use UtcNow instead" }];
      const candidate = "PowerShell 5.1 fails on Get-Date -AsUTC because it is a version six only token; use UtcNow instead please";
      const dup = findDuplicate(existing, candidate, 0.8);
      const ok = dup && dup.id === "existing" && dup.similarity >= 0.8;
      return { actual: dup ? `dup=${dup.id} sim=${dup.similarity.toFixed(2)}` : "no dup", pass: !!ok };
    },
  },
  {
    id: "BR-10_SE-01", type: "SE", framework_location: "scripts/lib/lessons.mjs",
    title: "Malformed / missing frontmatter is tolerated",
    expected_input: "a file with no frontmatter fence",
    expected_output: "parses to empty frontmatter + full body; no crash; validate reports missing",
    justification: "Dirty lessons dir must not crash search/validate — tolerant parse (soft).",
    run() {
      let threw = false; let p, v;
      try { p = parseFrontmatter("# Just a heading\nno frontmatter here"); v = validateLessonSchema(p.frontmatter); }
      catch { threw = true; }
      const ok = !threw && p.hasFrontmatter === false && v.conforms === false && v.missing.length > 0;
      return { actual: threw ? "threw" : `hasFm=${p.hasFrontmatter}, missing=${v.missing.length}`, pass: ok };
    },
  },
  {
    id: "BR-10_Output", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Output format carries all fields (acceptance #8)",
    expected_input: "formatResult(hit)",
    expected_output: "id, title, severity, domain, stack, platform, origin, confidence, created",
    justification: "Consumers need the full record to decide relevance.",
    run() {
      const out = formatResult(lessonObj(), 1);
      const ok = ["id:", "severity:", "domain:", "stack:", "platform:", "origin:", "confidence:", "created:"].every((k) => out.includes(k)) && out.includes("ps51");
      return { actual: out.replace(/\n/g, " | ").slice(0, 90), pass: ok };
    },
  },
  {
    id: "BR-10_RealLoad", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Real lessons-learned/ loads + conforms (integration)",
    expected_input: "loadLessons() over the migrated repo lessons",
    expected_output: "≥90% conform to the ADR-0055 schema",
    justification: "The migration standardized the real lessons — the doctor lesson-schema check depends on this.",
    run() {
      const lessons = loadLessons();
      const conforming = lessons.filter((l) => validateLessonSchema(l.frontmatter).conforms).length;
      const pct = lessons.length ? Math.round((conforming / lessons.length) * 100) : 0;
      const ok = lessons.length > 0 && pct >= 90;
      return { actual: `${conforming}/${lessons.length} conform (${pct}%)`, pass: ok };
    },
  },
  {
    id: "BR-10_RealValues", type: "---", framework_location: "scripts/lib/lessons.mjs",
    title: "Real lessons parse to CORRECT values, not just present",
    expected_input: "parse every real lesson; check title value-level correctness",
    expected_output: "no unbalanced-quote title artifacts; embedded-quote titles preserved",
    justification: "Critic 2026-07-15: a presence-only conformance check masked a coerce() bug that corrupted a real title. Value-level assertions over the actual files close that gap.",
    run() {
      const lessons = loadLessons();
      // A dropped wrapping-quote leaves an ODD number of double-quotes in the title.
      const unbalanced = lessons.filter((l) => ((String(l.frontmatter.title || "").match(/"/g) || []).length % 2) !== 0);
      // The embedded-quote lesson must round-trip verbatim (its title is NOT fully wrapped).
      const quota = lessons.find((l) => l.file.includes("write-fails-read-works-is-quota"));
      const quotaOk = !!quota && /^"Auth error" on write/.test(String(quota.frontmatter.title || ""));
      const ok = unbalanced.length === 0 && quotaOk;
      return { actual: `unbalanced-quote titles=${unbalanced.length}, quota-title-intact=${quotaOk}`, pass: ok };
    },
  },
];
