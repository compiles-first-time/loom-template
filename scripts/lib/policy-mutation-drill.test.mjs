#!/usr/bin/env node
// Policy mutation drill — the monitors' monitor for the governance layer.
//
// Mutation-testing principle (DeMillo et al. 1978; Jia & Harman 2011 survey):
// a protection is only proven load-bearing if REMOVING it visibly changes
// behavior. For every field in spec/policy/destructive-actions.policy.json we
// mutate the policy (via decideDestructiveAction's ctx.policy override — no
// files touched) and assert at least one probe's verdict flips. A mutant that
// changes nothing means the evaluator ignores that policy field — i.e. the
// policy file would be decorative there. Runs with the normal suite, so any
// future evaluator refactor that silently drops a policy field fails here.

import { decideDestructiveAction, IMMUTABLE_FILES } from "./destructive-guard.mjs";
import { DESTRUCTIVE_POLICY as SPEC_POLICY } from "../../spec/policy/destructive-actions.policy.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const destructiveHit = [{ category: "destructive_actions", matched_on: "rm -rf", decision: "ask" }];
const base = () => JSON.parse(JSON.stringify(SPEC_POLICY));

console.log("\nbaseline sanity (un-mutated policy)");
const probes = {
  immutable: () => ({ tool: "Edit", input: { file_path: "constitution/kernel-v6.md" } }),
  hookManaged: () => ({ tool: "Edit", input: { file_path: "orchestration/progress-ledger.md" } }),
  forcePush: () => ({ tool: "Bash", input: { command: "git push --force origin main" } }),
  contained: () => ({ tool: "Bash", input: { command: "rm -rf .worktrees/bd-7/tmp" }, hits: destructiveHit }),
  plainDestructive: () => ({ tool: "Bash", input: { command: "rm -rf build" }, hits: destructiveHit }),
};
{
  assert(decideDestructiveAction(probes.immutable()).decision === "deny", "immutable file edit → deny");
  assert(decideDestructiveAction(probes.hookManaged()).decision === "deny", "hook-managed file edit → deny");
  assert(decideDestructiveAction(probes.forcePush()).decision === "deny", "force-push to protected branch → deny");
  assert(decideDestructiveAction(probes.contained()).decision === "allow", "contained worktree scope → allow");
  assert(decideDestructiveAction(probes.plainDestructive()).decision === "ask", "plain destructive → ask (policy default)");
  assert(IMMUTABLE_FILES === SPEC_POLICY.immutableFiles,
    "guard's defaults come from the spec policy object (single source of truth)");
}

console.log("\nmutants — every policy field must be load-bearing");
{
  const m1 = base(); m1.immutableFiles = [];
  assert(decideDestructiveAction({ ...probes.immutable(), policy: m1 }).decision !== "deny",
    "mutant immutableFiles:[] flips the kernel-edit verdict (field is load-bearing)");

  const m2 = base(); m2.hookManagedFiles = [];
  assert(decideDestructiveAction({ ...probes.hookManaged(), policy: m2 }).decision !== "deny",
    "mutant hookManagedFiles:[] flips the ledger-edit verdict");

  const m3 = base(); m3.protectedBranches = [];
  assert(decideDestructiveAction({ ...probes.forcePush(), policy: m3 }).decision !== "deny",
    "mutant protectedBranches:[] flips the force-push verdict");

  const m4 = base(); m4.containedScopeSegments = [];
  const r4 = decideDestructiveAction({ ...probes.contained(), policy: m4 });
  assert(r4.decision !== "allow", "mutant containedScopeSegments:[] removes the worktree exemption");

  const m5 = base(); m5.destructiveDefault = "deny";
  assert(decideDestructiveAction({ ...probes.plainDestructive(), policy: m5 }).decision === "deny",
    "mutant destructiveDefault:'deny' changes the tier-2 verdict (default is read from policy)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
