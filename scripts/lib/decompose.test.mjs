#!/usr/bin/env node
// Unit tests for scripts/lib/decompose.mjs (ADR-0064).
// Each block corresponds to a row in
// observability/eval-suite/requirements/BR_19.md.

import { classifyOwner, decomposeRegister, renderPlan, decomposeFile } from "./decompose.mjs";
import { parseRegister, REQUIRED_COLUMNS, ADDED_COLUMNS } from "./requirements-register.mjs";
import path from "node:path";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const COLS = [...REQUIRED_COLUMNS, ...ADDED_COLUMNS];
const HEADER = `| ${COLS.join(" | ")} |`;
const SEP = `|${COLS.map(() => "---").join("|")}|`;
function row(id, type, owner = "critic", verifier = "test_suite: x.test.mjs") {
  const cells = [id, type, "loc", "usecase", "in", "out", "ain", "aout", "just", "pending", owner, verifier];
  return `| ${cells.join(" | ")} |`;
}
function reg(...rows) {
  return parseRegister([HEADER, SEP, ...rows].join("\n"));
}
const ROSTER = ["critic", "eac", "requirements-analyst"];
const REGISTRY = ["auth", "payments"];

// ─── owner classification ───────────────────────────────────────────────────
console.log("\nBR_19 — owner classification");
{
  const o = (s) => classifyOwner(s, { roster: ROSTER, registry: REGISTRY });
  assert(o("critic") === "agent", "installed agent recognized");
  assert(o("payments") === "registry", "registry specialist recognized");
  assert(o("doctor") === "runtime", "runtime machinery is not a gap");
  assert(o("Stop hook") === "runtime", "case-insensitive runtime match");
  assert(o("architect") === "human", "human role recognized");
  assert(o("architect / infra") === "human", "compound human role recognized");
  assert(o("any claiming agent") === "runtime", "quantified role satisfiable by the session");
  assert(o("video-transcoder") === "gap", "unknown role → specialist gap (the EAC trigger)");
  assert(o("—") === "empty", "em-dash placeholder → empty, not a gap");
  assert(o("") === "empty", "blank → empty");
  assert(o(null) === "empty", "null → empty, no throw");
}

// ─── graph construction ─────────────────────────────────────────────────────
console.log("\nBR_19 — nodes, packets, prerequisites");
{
  const r = decomposeRegister({
    parsed: reg(
      row("BR_20", "BR"),
      row("BR-20_TR-01", "TR", "architect", "human_gate: paid tier approved"),
      row("BR-20_Fetch", "---"),
      row("BR-20_Fetch_SE-01", "SE"),
      row("BR-20_Fetch_BE-01", "BE"),
      row("BR-20_Write", "---", "eac")
    ),
    roster: ROSTER,
    registry: REGISTRY,
  });
  assert(r.nodes.length === 4, "BR + TR + 2 steps become nodes; exceptions do not");
  const fetch = r.nodes.find((n) => n.id === "BR-20_Fetch");
  assert(fetch.kind === "step", "step kind");
  assert(fetch.context_packet.join(",") === "BR-20_Fetch,BR-20_Fetch_SE-01,BR-20_Fetch_BE-01",
    "context packet = the step + its attached exceptions, nothing else");
  const tr = r.nodes.find((n) => n.id === "BR-20_TR-01");
  assert(tr.kind === "prerequisite", "TR row becomes a prerequisite node");
  assert(tr.owner_kind === "human", "prerequisite owned by a human");
  assert(r.gaps.length === 0, "fully-known owners → no gaps");
  assert(r.direct_execution_advised === false, "2 steps → ceremony applies");
}

console.log("\nBR_19 — the chameleon trigger");
{
  const r = decomposeRegister({
    parsed: reg(row("BR_21", "BR"), row("BR-21_Cut", "---", "video-transcoder")),
    roster: ROSTER,
    registry: REGISTRY,
  });
  assert(r.gaps.length === 1, "unknown owner produces exactly one gap");
  assert(r.gaps[0].owner_role === "video-transcoder", "gap names the missing role");
  assert(r.gaps[0].action.includes("embed-vs-split"), "gap action routes through the EAC placement rule");
  const plan = renderPlan(r, "BR_21");
  assert(plan.includes("Specialist gaps (1)"), "plan surfaces the gap section");
  assert(plan.includes("EAC trigger"), "plan names it as the EAC trigger");
}

console.log("\nBR_19 — unowned and unverified are reported, never guessed");
{
  const r = decomposeRegister({
    parsed: reg(row("BR_22", "BR", "—", "—"), row("BR-22_S", "---", "", "")),
    roster: ROSTER,
  });
  assert(r.unowned.length === 2, "both unowned nodes reported");
  assert(r.unverified.length === 2, "both unverified nodes reported");
  assert(r.gaps.length === 0, "empty is not a gap — a gap is a NAMED role with no owner");
  const plan = renderPlan(r, "BR_22");
  assert(plan.includes("**UNOWNED**"), "plan marks unowned cells");
  assert(plan.includes("cannot be closed (ADR-0044)"), "plan says why unverified matters");
}

// ─── proportionality ────────────────────────────────────────────────────────
console.log("\nBR_19 — the anti-ceremony rule");
{
  const one = decomposeRegister({ parsed: reg(row("BR_23", "BR"), row("BR-23_S", "---")), roster: ROSTER });
  assert(one.direct_execution_advised === true, "≤1 step → direct execution advised");
  assert(renderPlan(one, "BR_23").includes("skip the ceremony"), "the plan says so out loud");
  const zero = decomposeRegister({ parsed: reg(row("BR_24", "BR")), roster: ROSTER });
  assert(zero.direct_execution_advised === true, "0 steps → same");
}

// ─── robustness + live dogfood ──────────────────────────────────────────────
console.log("\nBR_19 — robustness and the live repo");
{
  assert(decomposeRegister({}).nodes.length === 0, "no input → empty graph, no throw");
  assert(decomposeRegister({ parsed: null }).gaps.length === 0, "null parse → no gaps");

  const live = await decomposeFile(
    path.join(PROJECT_ROOT, "observability", "eval-suite", "requirements", "BR_16.md")
  );
  assert(live.nodes.length >= 6, `BR_16 decomposes (${live.nodes.length} nodes)`);
  assert(live.gaps.length === 0, "BR_16's owners all resolve — no false gaps on a real register");
  assert(live.nodes.some((n) => n.kind === "prerequisite"), "BR_16's TR row surfaces as a prerequisite");
  assert(live.nodes.every((n) => n.context_packet.length >= 1), "every node carries a packet");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
