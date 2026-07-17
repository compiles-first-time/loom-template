// discovery-authored — pure scanner (BR_08).
//
// The silent-degradation trap (lesson 2026-07-10-discovery-must-be-authored-not-
// stamped): `scripts/discover.*` stamps TEMPLATE content into discovery docs
// (`requirements.md`, `risk-register.md`, …). A stamped-but-unauthored doc looks
// "done" — the file exists, the discovery gate passes — while its content is
// boilerplate. `doctor` can't tell scaffolded from authored, so a fast run
// treats scaffolding as completion. This scanner flags the tell-tale placeholder
// strings so a silent skip becomes a visible warning.
//
// Pure + testable; scripts/lib/doctor.mjs reads the files and calls scan().

// The FULL-discovery artifacts (per L8 / ADR-0025) — the docs whose authored-ness
// this check guards. `quick-scan.md` is intentionally EXCLUDED: it is explicitly
// "not authoritative" scaffolding (a 5-min answer sheet), its default values
// (`you`, `TBD`) are indistinguishable from a legit solo-project answer, and a
// dedicated "stamped-without-input" quick-scan banner is the lesson's separate
// recommendation #2. Excluding it also makes the realistic post-bootstrap state
// (only quick-scan.md present) correctly read as "skipped — full discovery not
// started yet", instead of a false "authored" pass (critic 2026-07-15).
export const AUTHORED_DISCOVERY_FILES = [
  "requirements.md",
  "risk-register.md",
  "open-questions.md",
];

// Tell-tale STRUCTURAL markers `scripts/lib/discover.mjs` stamps into the
// full-discovery templates — matched against the ACTUAL render (verified by
// running the real generator in BR_08.cases.mjs), not the lesson's shorthand
// prose. Two structural forms cover all three files with low false-positive
// risk (they key on the template's italic-example convention + empty ID rows,
// not on free phrases an author might legitimately write):
export const PLACEHOLDER_TELLS = [
  // Italic example cell: `*(e.g., …)*` in FR-01 / RISK-01 / OQ-01 / out-of-scope.
  // Narrow known false-positive (critic RES-1, LOW): this also matches an
  // author's OWN markdown-emphasized `*(e.g., …)*` — but a real requirement drops
  // the "e.g.," (which literally signals a placeholder example), so on a soft
  // warn-check with trivial remediation this is an acceptable trade.
  { re: /\*\(e\.g\.,/, label: "template example cell (*(e.g., …)*)" },
  // Empty template row: `| FR-02 | | | … |`, `| RISK-02 | BE | | … |`, `| OQ-02 | | … |`.
  { re: /^\s*\|\s*(?:FR|NFR|RISK|OQ)-\d+\s*\|(?:\s*(?:SE|BE)?\s*\|){2,}\s*$/m, label: "empty template row (| ID-NN | | … |)" },
];

/**
 * Scan a set of discovery docs for template placeholders.
 * @param {{name:string, text:string}[]} docs
 * @returns {{ checked:number, flagged:{name:string, hits:string[]}[] }}
 */
export function scanDiscoveryAuthored(docs = []) {
  const flagged = [];
  let checked = 0;
  for (const d of docs) {
    if (!d || typeof d.text !== "string" || !d.name) continue;
    checked++;
    const hits = PLACEHOLDER_TELLS.filter((t) => t.re.test(d.text)).map((t) => t.label);
    if (hits.length) flagged.push({ name: d.name, hits });
  }
  return { checked, flagged };
}
