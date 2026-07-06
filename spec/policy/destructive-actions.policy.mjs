// Portable destructive-action policy — DATA ONLY (ADR-0048 spec, ADR-0047 BR_01).
//
// No host dependency, no I/O, no logic — just the policy the pure evaluator
// (scripts/lib/destructive-guard.mjs) applies. An adapter or a project may pass
// an override object of the same shape to decideDestructiveAction({ policy }).
//
// This is the concrete decoupling proof: the *policy* lives here (portable);
// the *evaluator* is a pure function; the *mechanism* (emitting a Claude Code
// permissionDecision) lives in the Claude Code adapter. Any adapter reaches the
// same decision from the same data.

export const DESTRUCTIVE_POLICY = {
  // Tier 1 — DENY: edits to these files are constitutionally forbidden.
  // Path-suffix matched so absolute paths resolve.
  immutableFiles: ["constitution/kernel-v6.md"], // Kernel Rule 19 (amend-only)
  hookManagedFiles: [
    "orchestration/progress-ledger.md",
    "tools/discovered-runtime.md",
  ],

  // Tier 1 — DENY: force-push to any of these branches (irreversible history rewrite).
  protectedBranches: ["main", "master", "prod", "production"],

  // Tier 3 — ALLOW: a destructive op whose path/command sits inside one of these
  // path segments has a bounded blast radius (worktree isolation). Matched as a
  // path segment (preceded by start, separator, or quote).
  containedScopeSegments: [".worktrees/"],

  // Tier 2 — default decision for the destructive class. "ask" (Rule 20 +
  // anti-habituation evidence). A project may set "deny" to hard-block all.
  destructiveDefault: "ask",
};
