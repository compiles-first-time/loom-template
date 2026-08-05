#!/usr/bin/env node
// Obvious-reject source-tier classifier — the mechanical FLOOR of the L7
// source-tier filter (ADR-0007/0009) that the research-scout applies.
//
// Tiering is fundamentally an LLM judgment call (is this preprint credible?
// is this vendor blog primary?). But the BLATANT Rejected-tier cases —
// forums, social media, Medium/Substack, undated/anonymous — are mechanically
// recognizable, and a deterministic floor for them means the scout's first
// stage can drop the obvious noise before spending judgment, AND it's
// testable against an adversarial corpus (extends BR_13's governed-vs-
// ungoverned harness to the intake filter).
//
// Same split as permissions-classifier / destructive-guard / admission-check:
// obvious cases decided in code, nuance returned as "unknown → agent judges".
// A classifier that returns {tier:"rejected"} is a HARD drop; {tier:null} means
// "not obviously rejected — the scout must tier it by judgment", never an
// implicit admit.
//
// Pure functions + a CLI (guarded — importing never runs it).

import { pathToFileURL } from "node:url";

// Host substrings that are Rejected-tier by definition (L7 §Source tiering:
// "forums, user-generated content, social media, undated/anonymous"). Kept
// conservative — only hosts whose editorial model is structurally UGC.
export const REJECTED_HOST_PATTERNS = [
  /(^|\.)reddit\.com$/i,
  /(^|\.)news\.ycombinator\.com$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)substack\.com$/i,
  /(^|\.)(twitter|x)\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)quora\.com$/i,
  /(^|\.)stackoverflow\.com$/i,
  /(^|\.)discord(app)?\.com$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)tiktok\.com$/i,
];

// Tier-1 hosts we can positively recognize (official/primary/peer-reviewed).
// A positive tier-1 match is a hint the scout can trust; absence is NOT a
// demotion — unknown hosts return null (judge it).
export const TIER1_HOST_PATTERNS = [
  /(^|\.)arxiv\.org$/i,
  /(^|\.)nist\.gov$/i,
  /(^|\.)nvd\.nist\.gov$/i,
  /(^|\.)github\.com$/i, // official releases feeds; the scout still judges the repo
  /(^|\.)opentelemetry\.io$/i,
  /(^|\.)owasp\.org$/i,
  /(^|\.)ietf\.org$/i,
  /(^|\.)w3\.org$/i,
];

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase();
  } catch {
    // Bare host or malformed — try a loose extraction.
    const m = /^(?:[a-z]+:\/\/)?([^/\s]+)/i.exec(String(url || ""));
    return m ? m[1].toLowerCase() : "";
  }
}

/**
 * Classify a candidate source. Deterministic floor only.
 * @param {object} item  - { url, date, author }
 * @returns {{tier: "rejected"|"1"|null, reason: string, mechanical: boolean}}
 *   tier "rejected" → hard drop; "1" → recognized primary; null → agent judges.
 */
export function classifySourceTier(item = {}) {
  // Degrade, never throw, on a null/non-object item (dirty input must not crash
  // the projection — same principle as the aggregator handlers).
  const safeItem = item && typeof item === "object" ? item : {};
  const { url = "", date = null, author = null } = safeItem;
  const host = hostOf(url);

  // Blatant UGC/social hosts are Rejected regardless of metadata.
  for (const re of REJECTED_HOST_PATTERNS) {
    if (re.test(host)) {
      return { tier: "rejected", reason: `UGC/social host ${host} is Rejected-tier by definition (L7)`, mechanical: true };
    }
  }
  // A recognized primary/official host IS the credential — check it BEFORE the
  // undated/anonymous heuristic so an arxiv/NVD item with unextracted date or
  // author is not false-rejected (flag 6, 2026-08-04 critic review). The host's
  // editorial model, not the scraped byline, is what makes it Tier 1.
  for (const re of TIER1_HOST_PATTERNS) {
    if (re.test(host)) {
      return { tier: "1", reason: `recognized primary/official host ${host}`, mechanical: true };
    }
  }
  // Undated AND anonymous on an UNRECOGNIZED host is the "undated/anonymous"
  // Rejected case (both missing; a dated-but-anonymous official doc is handled
  // by the tier-1 check above).
  if ((date == null || date === "") && (author == null || author === "")) {
    return { tier: "rejected", reason: "undated AND anonymous on an unrecognized host — Rejected-tier (L7)", mechanical: true };
  }
  return { tier: null, reason: "not obviously rejected or tier-1 — the scout must tier this by judgment", mechanical: false };
}

async function main() {
  const probes = [
    { url: "https://old.reddit.com/r/ml/comments/x", date: "2026-08-01", author: "u/anon" },
    { url: "https://arxiv.org/abs/2310.11324", date: "2024-01-01", author: "Sclar et al." },
    { url: "https://example.unknown/post", date: null, author: null },
    { url: "https://some-lab.ai/blog/new-method", date: "2026-07-01", author: "Lab" },
  ];
  console.log("source-tier-classifier (ADR-0007/0009) — obvious-reject floor demo\n");
  for (const p of probes) console.log(`${(p.url).padEnd(48)} → ${JSON.stringify(classifySourceTier(p))}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
}
