#!/usr/bin/env node
// Claim provenance verification (ADR-0060).
//
// The CLAUDE.md claim convention has always asked for `sources: [...]` on every
// non-trivial claim, and nothing has ever checked that the sources exist. A
// hand-written array was indistinguishable from a verified one — which means
// Rule 22's provenance requirement was satisfiable by typing.
//
// That is not a hypothetical risk. The evidence is unambiguous that self-reported
// citation is the wrong primitive:
//
//   * citation-hallucination rates of 11–57% across deployed models
//     [arXiv:2606.00898, arXiv:2605.27700]
//   * deep-research agents cite sources they never verified
//     [arXiv:2605.06635 — "Cited but Not Verified"]
//   * and decisively: models "struggle to predict their own hallucinations"
//     [Dahl et al., Large Legal Fictions, J. Legal Analysis; >800k questions;
//      58% (GPT-4) – 88% (Llama 2)]
//
// The last one is why this file exists rather than a better prompt. A model
// cannot self-assess its citation accuracy, so provenance must be resolved by
// code.
//
// ── The three-state distinction that matters ─────────────────────────────
//
//   resolved      the referent provably exists (file found / HTTP 200)
//   unreachable   we could not check (offline, blocked proxy, timeout)
//   unresolvable  we checked and it is not there (missing file, 404, garbage id)
//
// Collapsing `unreachable` into `unresolvable` would be a serious design error.
// This very session ran behind an egress proxy that blocks arxiv.org — a fact
// about the environment, not a lapse by the operator. Punishing one as the other
// teaches people to stop citing. See the evidence review §0.1.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";
import { classifySourceTier } from "./source-tier-classifier.mjs";

// ── Confidence caps (evidence review §1) ─────────────────────────────────
//
// A claim's confidence is capped by min(source tier, verification level). A T1
// paper nobody opened buys no more than an unread T1 paper is worth.

export const TIER_CAP = {
  "1": 0.99,
  "2": 0.95,
  "3": 0.80,
  "4": 0.60,
  rejected: 0.0,
  unknown: 0.60,
};

export const VERIFICATION_CAP = {
  V0: 0.60, // asserted; nothing resolved
  V1: 0.80, // exists / search-attested — not read
  V2: 0.95, // fetched and content-hashed
  V3: 0.95, // ≥2 independent sources agree
  V4: 0.99, // replicated primary
};

// The CLAUDE.md band that authorises autonomous execution.
export const AUTONOMY_THRESHOLD = 0.95;

const ARXIV_RE = /^(?:arxiv:)?(\d{4}\.\d{4,5})(v\d+)?$/i;
const DOI_RE = /^(?:doi:)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i;
const ADR_RE = /^adr-(\d{4})$/i;
const LR_RE = /^lr-(\d{2})$/i;
const BR_RE = /^br[_-](\d{2})$/i;

/** What kind of thing is this source string claiming to be? */
export function classifySourceKind(raw) {
  const s = String(raw || "").trim();
  if (!s) return { kind: "empty" };
  if (/^https?:\/\//i.test(s)) return { kind: "url", url: s };
  if (ARXIV_RE.test(s)) return { kind: "arxiv", id: ARXIV_RE.exec(s)[1], url: `https://arxiv.org/abs/${ARXIV_RE.exec(s)[1]}` };
  if (DOI_RE.test(s)) return { kind: "doi", id: DOI_RE.exec(s)[1], url: `https://doi.org/${DOI_RE.exec(s)[1]}` };
  if (ADR_RE.test(s)) return { kind: "adr", id: ADR_RE.exec(s)[1] };
  if (LR_RE.test(s)) return { kind: "local_rule", id: LR_RE.exec(s)[1] };
  if (BR_RE.test(s)) return { kind: "requirement", id: BR_RE.exec(s)[1] };
  // A repo-relative path, optionally with a #anchor or :line suffix.
  if (/[/\\]/.test(s) || /\.(md|mjs|js|json|ya?ml|ps1|sh|txt)(#|:|$)/i.test(s)) {
    const [bare] = s.split("#");
    return { kind: "repo_path", pathish: bare.replace(/:\d+(-\d+)?$/, ""), raw: s };
  }
  return { kind: "opaque", raw: s };
}

async function firstExisting(root, candidates) {
  for (const c of candidates) {
    const p = path.join(root, c);
    if (existsSync(p)) return c;
  }
  return null;
}

/**
 * Resolve one source string.
 *
 * @param {string} raw
 * @param {object} [opts]
 * @param {string} [opts.root]     - project root
 * @param {boolean} [opts.online]  - allow network checks (default false)
 * @param {string} [opts.quote]    - a span that must appear in the referent (→ V2)
 * @param {Function} [opts.fetcher] - injectable fetch, for tests
 * @returns {Promise<{source,kind,status,verification,tier,tier_reason,detail,hash?}>}
 */
export async function resolveSource(raw, opts = {}) {
  const { root = PROJECT_ROOT, online = false, quote = null, fetcher = null } = opts;
  const c = classifySourceKind(raw);
  const base = { source: String(raw || ""), kind: c.kind };

  if (c.kind === "empty") {
    return { ...base, status: "unresolvable", verification: "V0", tier: "unknown", tier_reason: "empty source", detail: "empty source string" };
  }

  // ── Local referents: fully checkable offline, and the strongest kind Loom
  // can have, because the referent is in the repo under version control.
  if (c.kind === "repo_path" || c.kind === "adr" || c.kind === "local_rule" || c.kind === "requirement") {
    let candidates = [];
    if (c.kind === "repo_path") candidates = [c.pathish];
    if (c.kind === "adr") {
      const dir = path.join(root, "adr");
      let match = null;
      try {
        match = (await fs.readdir(dir)).find((f) => f.startsWith(`${c.id}-`));
      } catch { /* no adr dir */ }
      candidates = match ? [path.join("adr", match)] : [];
    }
    if (c.kind === "local_rule") candidates = [path.join("constitution", "local-rules.md")];
    if (c.kind === "requirement") {
      candidates = [
        path.join("observability", "eval-suite", "requirements", `BR_${c.id}.md`),
        path.join("observability", "eval-suite", "requirements", `BR_${c.id}.cases.mjs`),
      ];
    }

    const found = candidates.length ? await firstExisting(root, candidates) : null;
    if (!found) {
      return { ...base, status: "unresolvable", verification: "V0", tier: "1", tier_reason: "repo-local referent", detail: `not found in repo: ${candidates.join(" | ") || c.raw || raw}` };
    }

    // In-repo referents are Tier 1 (primary — it is the artefact itself), and
    // we can reach V2 whenever a quote is supplied, because we can read it.
    let verification = "V1";
    let hash;
    let detail = `found ${found}`;
    if (quote) {
      const text = await fs.readFile(path.join(root, found), "utf8");
      // Normalise whitespace so a re-wrapped markdown line still matches.
      const norm = (s) => String(s).replace(/\s+/g, " ").trim();
      if (norm(text).includes(norm(quote))) {
        verification = "V2";
        hash = crypto.createHash("sha256").update(norm(quote)).digest("hex").slice(0, 16);
        detail = `found ${found}; quoted span present (sha256:${hash})`;
      } else {
        // The file exists but does not say what the claim says it says. That is
        // a worse failure than a missing file, and must not read as success.
        return { ...base, status: "unresolvable", verification: "V0", tier: "1", tier_reason: "repo-local referent", detail: `found ${found} but the quoted span is absent — the citation misrepresents the source` };
      }
    }
    if (c.kind === "local_rule") detail += ` (LR-${c.id})`;
    return { ...base, status: "resolved", verification, tier: "1", tier_reason: "repo-local referent (primary artefact)", detail, ...(hash ? { hash } : {}) };
  }

  // ── Remote referents ────────────────────────────────────────────────────
  if (c.kind === "url" || c.kind === "arxiv" || c.kind === "doi") {
    const url = c.url;
    const t = classifySourceTier({ url, date: "n/a", author: "n/a" });
    const tier = t.tier === "rejected" ? "rejected" : t.tier === "1" ? "1" : "unknown";

    if (tier === "rejected") {
      return { ...base, status: "unresolvable", verification: "V0", tier, tier_reason: t.reason, detail: `Rejected-tier host — inadmissible under ADR-0009 regardless of reachability` };
    }
    if (!online) {
      return { ...base, status: "unreachable", verification: "V0", tier, tier_reason: t.reason, detail: `offline mode — not checked (pass --online to verify)` };
    }

    const doFetch = fetcher || globalThis.fetch;
    if (typeof doFetch !== "function") {
      return { ...base, status: "unreachable", verification: "V0", tier, tier_reason: t.reason, detail: "no fetch implementation available" };
    }
    try {
      const res = await doFetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (!res || typeof res.status !== "number") {
        return { ...base, status: "unreachable", verification: "V0", tier, tier_reason: t.reason, detail: "malformed response" };
      }
      if (res.status === 404 || res.status === 410) {
        return { ...base, status: "unresolvable", verification: "V0", tier, tier_reason: t.reason, detail: `HTTP ${res.status} — the referent does not exist` };
      }
      if (res.status >= 400) {
        // 403 from an egress proxy, 429 rate-limit, 5xx — all "could not check".
        return { ...base, status: "unreachable", verification: "V0", tier, tier_reason: t.reason, detail: `HTTP ${res.status} — could not verify (not evidence of absence)` };
      }
      let verification = "V1";
      let hash;
      let detail = `HTTP ${res.status}`;
      if (quote && typeof res.text === "function") {
        const body = await res.text();
        const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();
        if (norm(body).includes(norm(quote))) {
          verification = "V2";
          hash = crypto.createHash("sha256").update(norm(quote)).digest("hex").slice(0, 16);
          detail += `; quoted span present (sha256:${hash})`;
        } else {
          detail += "; quoted span NOT found in the fetched body";
          return { ...base, status: "unresolvable", verification: "V0", tier, tier_reason: t.reason, detail };
        }
      }
      return { ...base, status: "resolved", verification, tier, tier_reason: t.reason, detail, ...(hash ? { hash } : {}) };
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      return { ...base, status: "unreachable", verification: "V0", tier, tier_reason: t.reason, detail: `fetch failed: ${msg.slice(0, 120)}` };
    }
  }

  // ── Opaque: a bare string that names nothing checkable ──────────────────
  // e.g. "internal", "user-report", "institutional". These are legitimate
  // provenance *kinds* in Loom's vocabulary but they are not verifiable, so
  // they must not silently earn a high confidence cap.
  return {
    ...base,
    status: "unreachable",
    verification: "V0",
    tier: "unknown",
    tier_reason: "opaque provenance label — names no checkable referent",
    detail: "not a path, URL, DOI, arXiv id, or Loom identifier",
  };
}

/** Are two resolved sources independent enough to count toward V3? */
function independentPair(a, b) {
  if (a.kind !== b.kind) return true;
  const hostOf = (s) => {
    try { return new URL(s.source).hostname.toLowerCase(); } catch { return s.source.toLowerCase(); }
  };
  return hostOf(a) !== hostOf(b);
}

/**
 * Verify a whole claim record.
 *
 * @param {object} claim - a `claim` event ({ claim, confidence, sources, ... })
 * @param {object} [opts] - passed through to resolveSource; `quotes` maps source→span
 * @returns {Promise<object>} verification report incl. `confidence_cap` and `over_confident`
 */
export async function verifyClaim(claim = {}, opts = {}) {
  const raw = Array.isArray(claim.sources) ? claim.sources : claim.sources ? [claim.sources] : [];
  const quotes = opts.quotes || {};
  const results = [];
  for (const s of raw) {
    results.push(await resolveSource(s, { ...opts, quote: quotes[s] || null }));
  }

  const resolved = results.filter((r) => r.status === "resolved");
  const unreachable = results.filter((r) => r.status === "unreachable");
  const unresolvable = results.filter((r) => r.status === "unresolvable");

  // Per-source cap = min(tier cap, verification cap). Claim cap = the best
  // single source, because a claim rests on its strongest support.
  let cap = 0;
  for (const r of resolved) {
    const c = Math.min(TIER_CAP[r.tier] ?? TIER_CAP.unknown, VERIFICATION_CAP[r.verification] ?? VERIFICATION_CAP.V0);
    if (c > cap) cap = c;
  }
  // V3: ≥2 independently-resolved admissible sources agreeing.
  if (resolved.length >= 2) {
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (independentPair(resolved[i], resolved[j])) {
          cap = Math.max(cap, VERIFICATION_CAP.V3);
          i = resolved.length;
          break;
        }
      }
    }
  }
  if (resolved.length === 0) cap = VERIFICATION_CAP.V0;
  // An unresolvable citation is a defect in the claim itself, not a neutral
  // absence — it means the claim asserts support that does not exist.
  if (unresolvable.length > 0) cap = Math.min(cap, VERIFICATION_CAP.V0);

  const stated = typeof claim.confidence === "number" ? claim.confidence : null;
  return {
    claim: claim.claim || null,
    stated_confidence: stated,
    confidence_cap: cap,
    over_confident: stated !== null && stated > cap + 1e-9,
    autonomy_eligible: cap >= AUTONOMY_THRESHOLD,
    counts: { total: results.length, resolved: resolved.length, unreachable: unreachable.length, unresolvable: unresolvable.length },
    sources: results,
  };
}

/** The event record to append for a verified claim. */
export function provenanceRecord(report, { session_id = null } = {}) {
  return {
    session_id,
    claim: report.claim,
    resolved: report.counts.resolved,
    unreachable: report.counts.unreachable,
    unresolvable: report.counts.unresolvable,
    stated_confidence: report.stated_confidence,
    confidence_cap: report.confidence_cap,
    over_confident: report.over_confident,
    sources: report.sources.map((s) => ({ source: s.source, kind: s.kind, status: s.status, verification: s.verification, tier: s.tier })),
    rule: "ADR-0060",
  };
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const argv = process.argv.slice(2);
  const online = argv.includes("--online");
  const sources = argv.filter((a) => !a.startsWith("--"));
  if (sources.length === 0) {
    console.error("usage: node claim-provenance.mjs [--online] <source> [<source> ...]");
    console.error("       resolves each source and prints the confidence cap it can support");
    process.exit(2);
  }
  const report = await verifyClaim({ claim: "(cli probe)", sources }, { online });
  console.log("");
  for (const s of report.sources) {
    const mark = s.status === "resolved" ? "✓" : s.status === "unreachable" ? "?" : "✗";
    console.log(`  ${mark}  ${s.source}`);
    console.log(`     ${s.status} · ${s.verification} · tier ${s.tier} — ${s.detail}`);
  }
  console.log(
    `\n  resolved ${report.counts.resolved} · unreachable ${report.counts.unreachable} · unresolvable ${report.counts.unresolvable}`
  );
  console.log(`  confidence cap: ${report.confidence_cap.toFixed(2)}${report.autonomy_eligible ? "" : "  (below the 0.95 autonomy band)"}\n`);
  process.exit(report.counts.unresolvable > 0 ? 1 : 0);
}
