// Canonical BR_08 test cases (discovery-authored doctor check / registry per ADR-0046).
//
// Consumed by scripts/lib/discovery-authored.test.mjs. FIDELITY (critic
// 2026-07-15): rather than hand-typed strings that just match the regex
// (circular), this runs the REAL `scripts/lib/discover.mjs --non-interactive`
// generator in a temp dir and scans its ACTUAL stamped output — so the tells are
// verified against what `discover.*` really produces, not a paraphrase.

import { promises as fsp } from "node:fs";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { scanDiscoveryAuthored, AUTHORED_DISCOVERY_FILES } from "../../../scripts/lib/discovery-authored.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DISCOVER = path.join(ROOT, "scripts", "lib", "discover.mjs");

// ── Run the REAL generator once, capture its stamped output ─────────────────
function stampRealTemplates() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "loom-disc-"));
  const out = { full: {}, quickScan: null, ok: false };
  try {
    spawnSync(process.execPath, [DISCOVER, "--non-interactive"], { cwd: tmp, encoding: "utf8" });
    spawnSync(process.execPath, [DISCOVER, "--quick", "--non-interactive"], { cwd: tmp, encoding: "utf8" });
    const disc = path.join(tmp, "discovery");
    for (const name of ["requirements.md", "risk-register.md", "open-questions.md"]) {
      const p = path.join(disc, name);
      if (existsSync(p)) out.full[name] = readFileSync(p, "utf8");
    }
    const qs = path.join(disc, "quick-scan.md");
    if (existsSync(qs)) out.quickScan = readFileSync(qs, "utf8");
    out.ok = Object.keys(out.full).length === 3;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

const REAL = stampRealTemplates();
const realDocs = Object.entries(REAL.full).map(([name, text]) => ({ name, text }));

// An authored (real) requirements doc — no template tells. Includes a legit
// risk sentence about "database connection lost" written as normal prose (the
// critic's false-positive probe) to prove it is NOT flagged.
const AUTHORED = `# Requirements
| ID | Capability | User | Trigger | Outcome | Notes |
|---|---|---|---|---|---|
| FR-01 | Ingest a UiPath REFramework .xaml and render a 3D city | analyst | uploads .xaml | city rendered | |
| FR-02 | Export the city as a shareable link | analyst | clicks share | URL minted | |

Risk note: if the database connection is lost mid-request we surface a 503 and retry.
`;

export const BR_08_CASES = [
  {
    id: "BR_08", type: "BR", framework_location: "scripts/lib/doctor.mjs",
    title: "Flag unauthored (placeholder) discovery docs — stamped ≠ authored",
    expected_input: "the REAL discover.mjs stamped full-discovery docs",
    expected_output: "all 3 flagged; an authored doc not flagged",
    justification: "Lesson 2026-07-10 — a stamped-but-unauthored discovery doc looks 'done' while being boilerplate; the silent-degradation trap.",
    run() {
      const stamped = scanDiscoveryAuthored(realDocs);
      const authored = scanDiscoveryAuthored([{ name: "requirements.md", text: AUTHORED }]);
      const ok = REAL.ok && stamped.flagged.length === 3 && authored.flagged.length === 0;
      return { actual: `real-stamped flagged=${stamped.flagged.length}/3, authored flagged=${authored.flagged.length}`, pass: ok };
    },
  },
  {
    id: "BR-08_BE-01", type: "BE", framework_location: "scripts/lib/discovery-authored.mjs",
    title: "Placeholder present but check passes (false negative) — REAL generator output",
    expected_input: "each of requirements/risk-register/open-questions.md as stamped by discover.mjs",
    expected_output: "every stamped file is flagged (no silent pass)",
    justification: "Critic 2026-07-15: the tells must catch what discover.* ACTUALLY stamps (a markdown table), not the lesson's shorthand. Verified against real generator output, not synthetic strings.",
    run() {
      if (!REAL.ok) return { actual: "generator did not produce all 3 files", pass: false };
      const perFile = realDocs.map((d) => `${d.name}:${scanDiscoveryAuthored([d]).flagged.length ? "flagged" : "MISSED"}`);
      const allFlagged = realDocs.every((d) => scanDiscoveryAuthored([d]).flagged.length === 1);
      return { actual: perFile.join(", "), pass: allFlagged };
    },
  },
  {
    id: "BR-08_SE-01", type: "SE", framework_location: "scripts/lib/doctor.mjs",
    title: "No full-discovery docs (template / post-bootstrap) → skip, not false-fail",
    expected_input: "empty set; and quick-scan.md is OUT of scope",
    expected_output: "checked 0; quick-scan not in AUTHORED_DISCOVERY_FILES",
    justification: "loom-template + the post-bootstrap-only-quick-scan state have no full-discovery docs — the check must skip (not a false 'authored' pass). quick-scan is deliberately excluded (no reliable tell; explicitly non-authoritative).",
    run() {
      const empty = scanDiscoveryAuthored([]);
      const quickExcluded = !AUTHORED_DISCOVERY_FILES.includes("quick-scan.md");
      const ok = empty.checked === 0 && empty.flagged.length === 0 && quickExcluded;
      return { actual: `checked=${empty.checked}, quick-scan-excluded=${quickExcluded}`, pass: ok };
    },
  },
  {
    id: "BR-08_SE-02", type: "SE", framework_location: "scripts/lib/discovery-authored.mjs",
    title: "Malformed / unreadable doc entry",
    expected_input: "docs incl. null, {name only}, {text non-string}",
    expected_output: "skipped safely; no crash; only valid docs checked",
    justification: "A missing/unreadable discovery file must not crash doctor — tolerant scan.",
    run() {
      let threw = false; let r;
      try { r = scanDiscoveryAuthored([null, { name: "x.md" }, { text: "no name" }, { name: "ok.md", text: AUTHORED }]); }
      catch { threw = true; }
      const ok = !threw && r.checked === 1 && r.flagged.length === 0;
      return { actual: threw ? "threw" : `checked=${r.checked}, flagged=${r.flagged.length}`, pass: ok };
    },
  },
  {
    id: "BR-08_BE-02", type: "BE", framework_location: "scripts/lib/discovery-authored.mjs",
    title: "Authored file wrongly flagged (false positive)",
    expected_input: "real authored prose incl. a natural 'database connection lost' risk sentence",
    expected_output: "not flagged",
    justification: "Critic 2026-07-15: keying on the template's italic-example convention (not free phrases) means an author who legitimately writes about 'database connection lost' is NOT punished.",
    run() {
      const r = scanDiscoveryAuthored([{ name: "requirements.md", text: AUTHORED }]);
      const ok = r.flagged.length === 0 && r.checked === 1;
      return { actual: `flagged=${r.flagged.length} (authored 'db connection lost' prose not flagged)`, pass: ok };
    },
  },
];

// Silence an unused-import lint (fsp reserved for future async fixtures).
void fsp;
