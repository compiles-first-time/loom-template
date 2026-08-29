#!/usr/bin/env node
// Unit tests for scripts/lib/claim-provenance.mjs (ADR-0060).
// Each block corresponds to a row in
// observability/eval-suite/requirements/BR_16.md.

import {
  classifySourceKind,
  resolveSource,
  verifyClaim,
  provenanceRecord,
  TIER_CAP,
  VERIFICATION_CAP,
} from "./claim-provenance.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

// Fake fetchers so the tests never touch the network.
const ok200 = (body = "") => async () => ({ status: 200, text: async () => body });
const notFound = async () => ({ status: 404, text: async () => "" });
const proxyBlocked = async () => ({ status: 403, text: async () => "" });
const throws = async () => { throw new Error("ENOTFOUND arxiv.org"); };

// ─── kind classification ────────────────────────────────────────────────────
console.log("\nBR_16 — source kind classification");
{
  assert(classifySourceKind("https://arxiv.org/abs/2503.13657").kind === "url", "https → url");
  assert(classifySourceKind("arXiv:2503.13657").kind === "arxiv", "arXiv:id → arxiv");
  assert(classifySourceKind("2503.13657").kind === "arxiv", "bare arxiv id → arxiv");
  assert(
    classifySourceKind("arXiv:2503.13657").url === "https://arxiv.org/abs/2503.13657",
    "arxiv id expands to a URL"
  );
  assert(classifySourceKind("doi:10.1109/TSE.2021.3107634").kind === "doi", "doi: → doi");
  assert(classifySourceKind("ADR-0044").kind === "adr", "ADR-0044 → adr");
  assert(classifySourceKind("LR-06").kind === "local_rule", "LR-06 → local_rule");
  assert(classifySourceKind("BR_13").kind === "requirement", "BR_13 → requirement");
  assert(classifySourceKind("layers/L6-observability.md").kind === "repo_path", "path → repo_path");
  assert(classifySourceKind("CLAUDE.md").kind === "repo_path", "bare .md filename → repo_path");
  assert(classifySourceKind("internal").kind === "opaque", "bare label → opaque");
  assert(classifySourceKind("").kind === "empty", "empty → empty");
  assert(
    classifySourceKind("scripts/lib/doctor.mjs:588").pathish === "scripts/lib/doctor.mjs",
    "line suffix stripped from path"
  );
  assert(
    classifySourceKind("layers/L6-observability.md#schema").pathish === "layers/L6-observability.md",
    "anchor stripped from path"
  );
}

// ─── local referents resolve offline ────────────────────────────────────────
console.log("\nBR_16 — repo-local referents are checkable with no network");
{
  const r = await resolveSource("CLAUDE.md");
  assert(r.status === "resolved", "existing repo file → resolved");
  assert(r.tier === "1", "in-repo artefact is Tier 1 (it IS the primary source)");
  assert(r.verification === "V1", "existence alone is V1");

  const missing = await resolveSource("does/not/exist.md");
  assert(missing.status === "unresolvable", "missing repo file → unresolvable");
  assert(missing.status !== "unreachable", "a missing local file is NOT 'unreachable'");

  const adr = await resolveSource("ADR-0044");
  assert(adr.status === "resolved", "ADR-0044 resolves by number");
  assert(adr.detail.includes("0044-"), "detail names the file it matched");

  const noAdr = await resolveSource("ADR-9999");
  assert(noAdr.status === "unresolvable", "nonexistent ADR → unresolvable");

  const lr = await resolveSource("LR-06");
  assert(lr.status === "resolved", "LR-06 resolves to local-rules.md");

  const br = await resolveSource("BR_13");
  assert(br.status === "resolved", "BR_13 resolves to its register");
}

// ─── the quote check: V2, and the misrepresentation case ────────────────────
console.log("\nBR_16 — a quoted span promotes to V2, and a wrong quote FAILS");
{
  const good = await resolveSource("CLAUDE.md", { quote: "Confidence calibration" });
  assert(good.status === "resolved", "present quote → resolved");
  assert(good.verification === "V2", "quote verified → V2");
  assert(typeof good.hash === "string" && good.hash.length === 16, "content hash recorded");

  // The whole point: a file that exists but does not say what the claim says.
  const bad = await resolveSource("CLAUDE.md", { quote: "this sentence is not in CLAUDE.md at all" });
  assert(bad.status === "unresolvable", "absent quote → unresolvable, NOT resolved");
  assert(
    bad.detail.includes("misrepresents"),
    "detail says the citation misrepresents the source"
  );
}

// ─── the three-state distinction ────────────────────────────────────────────
console.log("\nBR_16 — unreachable and unresolvable are different states");
{
  const offline = await resolveSource("https://arxiv.org/abs/2503.13657");
  assert(offline.status === "unreachable", "offline mode → unreachable, never unresolvable");
  assert(offline.detail.includes("--online"), "detail tells you how to actually check");

  const blocked = await resolveSource("https://arxiv.org/abs/2503.13657", { online: true, fetcher: proxyBlocked });
  assert(blocked.status === "unreachable", "HTTP 403 from a proxy → unreachable");
  assert(
    blocked.detail.includes("not evidence of absence"),
    "403 is explicitly not treated as absence"
  );

  const dns = await resolveSource("https://arxiv.org/abs/2503.13657", { online: true, fetcher: throws });
  assert(dns.status === "unreachable", "network throw → unreachable");

  const gone = await resolveSource("https://arxiv.org/abs/9999.99999", { online: true, fetcher: notFound });
  assert(gone.status === "unresolvable", "HTTP 404 → unresolvable (checked, absent)");

  const live = await resolveSource("https://arxiv.org/abs/2503.13657", { online: true, fetcher: ok200() });
  assert(live.status === "resolved", "HTTP 200 → resolved");
  assert(live.tier === "1", "arxiv.org is a recognised Tier-1 host");
}

// ─── rejected tier short-circuits ───────────────────────────────────────────
console.log("\nBR_16 — a Rejected-tier host is inadmissible regardless of reachability");
{
  const r = await resolveSource("https://www.reddit.com/r/x/comments/y", { online: true, fetcher: ok200() });
  assert(r.status === "unresolvable", "UGC host → unresolvable even on HTTP 200");
  assert(r.tier === "rejected", "tier is rejected");
  assert(r.detail.includes("ADR-0009"), "detail cites the standard it violates");
}

// ─── opaque labels earn nothing ─────────────────────────────────────────────
console.log("\nBR_16 — an opaque provenance label cannot buy confidence");
{
  const r = await resolveSource("internal");
  assert(r.status === "unreachable", "opaque label → unreachable (not a lie, just uncheckable)");
  assert(r.verification === "V0", "V0");
  assert(TIER_CAP[r.tier] === 0.6, "unknown tier caps at 0.60");
}

// ─── claim-level caps ───────────────────────────────────────────────────────
console.log("\nBR_16 — confidence is capped by min(tier, verification)");
{
  const unread = await verifyClaim({ claim: "x", confidence: 0.97, sources: ["CLAUDE.md"] });
  assert(unread.confidence_cap === VERIFICATION_CAP.V1, "one existence-only source caps at V1 (0.80)");
  assert(unread.over_confident === true, "0.97 stated against a 0.80 cap → over-confident");
  assert(unread.autonomy_eligible === false, "not eligible for autonomous execution");

  const quoted = await verifyClaim(
    { claim: "x", confidence: 0.9, sources: ["CLAUDE.md"] },
    { quotes: { "CLAUDE.md": "Confidence calibration" } }
  );
  assert(quoted.confidence_cap === VERIFICATION_CAP.V2, "a content-hashed quote reaches 0.95");
  assert(quoted.over_confident === false, "0.90 under a 0.95 cap is fine");

  const corroborated = await verifyClaim({
    claim: "x",
    confidence: 0.95,
    sources: ["CLAUDE.md", "ADR-0044"],
  });
  assert(corroborated.confidence_cap === VERIFICATION_CAP.V3, "two independent resolved sources → V3 (0.95)");

  const none = await verifyClaim({ claim: "x", confidence: 0.99, sources: [] });
  assert(none.confidence_cap === VERIFICATION_CAP.V0, "no sources → 0.60 cap");
  assert(none.over_confident === true, "an unsourced 0.99 claim is flagged");

  // An unresolvable source is worse than no source: it asserts support that
  // does not exist, so it must drag the cap down even alongside a good one.
  const poisoned = await verifyClaim({
    claim: "x",
    confidence: 0.9,
    sources: ["CLAUDE.md", "ADR-0044", "does/not/exist.md"],
  });
  assert(poisoned.counts.unresolvable === 1, "the bad source is counted");
  assert(poisoned.confidence_cap === VERIFICATION_CAP.V0, "one unresolvable source caps the whole claim at 0.60");
  assert(poisoned.over_confident === true, "and the stated 0.90 becomes over-confident");
}

console.log("\nBR_16 — independence is required for the V3 bump");
{
  // Same kind AND same host → not independent. Two arxiv URLs are one line of
  // evidence for provenance purposes, not two.
  const sameHost = await verifyClaim(
    { claim: "x", confidence: 0.9, sources: ["https://arxiv.org/abs/1111.11111", "https://arxiv.org/abs/2222.22222"] },
    { online: true, fetcher: ok200() }
  );
  assert(sameHost.counts.resolved === 2, "both resolved");
  assert(sameHost.confidence_cap === VERIFICATION_CAP.V1, "same host → no V3 bump, stays at 0.80");
}

// ─── the event record ───────────────────────────────────────────────────────
console.log("\nBR_16 — the emitted record carries what the compliance check reads");
{
  const report = await verifyClaim({ claim: "y", confidence: 0.7, sources: ["CLAUDE.md", "nope.md"] });
  const rec = provenanceRecord(report, { session_id: "s1" });
  assert(rec.session_id === "s1", "session id carried");
  assert(rec.resolved === 1 && rec.unresolvable === 1, "counts match the shape session-compliance reads");
  assert(rec.rule === "ADR-0060", "tagged with its ADR");
  assert(Array.isArray(rec.sources) && rec.sources[0].status, "per-source detail retained for audit");
}

// ─── robustness ─────────────────────────────────────────────────────────────
console.log("\nBR_16 — dirty input degrades, never throws");
{
  assert((await resolveSource(null)).status === "unresolvable", "null source → unresolvable");
  assert((await resolveSource(undefined)).status === "unresolvable", "undefined → unresolvable");
  const empty = await verifyClaim({});
  assert(empty.counts.total === 0, "empty claim → zero sources");
  assert(empty.stated_confidence === null, "no stated confidence → null, not 0");
  assert(empty.over_confident === false, "absent confidence is not over-confidence");
  const strSource = await verifyClaim({ claim: "z", sources: "CLAUDE.md" });
  assert(strSource.counts.total === 1, "a bare string source is accepted as a one-element list");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
