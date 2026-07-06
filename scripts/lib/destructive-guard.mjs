// Loom destructive-action guard — the decision logic behind BR_01 (ADR-0047).
//
// Pure, side-effect-free tier decision consumed by scripts/hooks/pre-tool-use.mjs.
// Kept out of the hook so it is unit-testable in isolation; its branches ARE the
// SE/BE test cases enumerated in observability/eval-suite/requirements/BR_01.md.
//
// Risk-proportionate friction mapped to reversibility × blast-radius
// (Kernel Rule 20 "temporal weighting"). Three tiers:
//
//   DENY  (tier 1) — immutable / catastrophic-irreversible:
//                     · edits to constitution/kernel-v6.md (Rule 19)
//                     · hand-edits to hook-managed bi-temporal files
//                     · force-push to a protected branch (main/master/prod)
//   ASK   (tier 2) — the destructive class (a classifier hit) not otherwise
//                     denied or contained. Rare, so per-op confirmation stays
//                     meaningful rather than habituated (Akhawe & Felt 2013;
//                     Herley 2009).
//   ALLOW (tier 3) — a destructive hit whose blast radius is provably contained
//                     (inside a .worktrees/ isolation dir). Trust the scope +
//                     Loom's existing governance (Rule 8 anti-paternalism).
//
// Everything with no destructive signal returns { decision: "none" } → the hook
// exits 0 (today's behavior). Fail-open is the caller's responsibility: any
// throw here must be caught by the hook and treated as "none".

const CMD_FIELDS = ["command", "Command", "script"];

// Files the constitution forbids an agent from editing directly (Rule 19:
// foundational rules 1–8 are amend-only, via the documented process — never a
// casual Edit/Write). Matched by path suffix so absolute paths resolve.
export const IMMUTABLE_FILES = ["constitution/kernel-v6.md"];

// Hook-managed bi-temporal files: hand-edits break the append integrity the
// Stop / runtime-discovery hooks depend on (see handoff "Do not do").
export const HOOK_MANAGED_FILES = [
  "orchestration/progress-ledger.md",
  "tools/discovered-runtime.md",
];

// A path/command inside a worktree isolation dir has a bounded blast radius.
// Match ".worktrees/" as a path segment — preceded by start, a separator, or a
// quote — so both "rm -rf .worktrees/x" (space-prefixed, relative) and
// "cd repo/.worktrees/x" (slash-prefixed) are recognized, while a false match
// like "myworktrees/" is not. (Scratchpad containment is a documented v1.1 extension.)
const CONTAINED_RE = /(?:^|[\s"'`(=]|\/)\.worktrees\//;

const FORCE_PUSH_RE = /\bgit\s+push\b[^\n]*?(?:--force\b|--force-with-lease\b|-f\b)/i;
const PROTECTED_BRANCH_RE = /\b(?:main|master|prod|production)\b/i;

function normPath(p) {
  return typeof p === "string" ? p.replace(/\\/g, "/") : "";
}

function extractFilePath(input) {
  if (input && typeof input === "object" && typeof input.file_path === "string") {
    return input.file_path;
  }
  return "";
}

function extractCommand(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    for (const f of CMD_FIELDS) {
      if (typeof input[f] === "string") return input[f];
    }
  }
  return "";
}

function pathMatchesAny(filePath, relList) {
  const norm = normPath(filePath);
  if (!norm) return null;
  for (const rel of relList) {
    // Match exact tail so an absolute path (…/project/constitution/kernel-v6.md)
    // or a repo-relative path both resolve.
    if (norm === rel || norm.endsWith("/" + rel)) return rel;
  }
  return null;
}

// Tier 1 — context-based hard deny. Independent of the classifier: these are
// file targets / branch targets a command-pattern classifier does not see.
function checkDenyTier({ tool, filePath, command }) {
  const isEdit = tool === "Edit" || tool === "Write" || tool === "NotebookEdit" || tool === "MultiEdit";

  if (isEdit && filePath) {
    const immutable = pathMatchesAny(filePath, IMMUTABLE_FILES);
    if (immutable) {
      return {
        matched_on: immutable,
        reason:
          `Blocked: ${immutable} is amend-only under Kernel Rule 19 (foundational rules are immutable). ` +
          `Constitutional changes go through the documented amendment process (transparent, auditable, consent-based) — not a direct edit.`,
      };
    }
    const managed = pathMatchesAny(filePath, HOOK_MANAGED_FILES);
    if (managed) {
      return {
        matched_on: managed,
        reason:
          `Blocked: ${managed} is a hook-managed bi-temporal file. Hand-edits break the append integrity the Stop / runtime-discovery hooks depend on. ` +
          `Let the hooks maintain it.`,
      };
    }
  }

  if (command && FORCE_PUSH_RE.test(command) && PROTECTED_BRANCH_RE.test(command)) {
    return {
      matched_on: (command.match(FORCE_PUSH_RE) || [""])[0].trim(),
      reason:
        `Blocked: force-push to a protected branch (main/master/prod) rewrites shared history irreversibly (Kernel Rule 20). ` +
        `Force-push to a feature branch instead, or open a PR.`,
    };
  }

  return null;
}

// Tier 3 — contained scope: a destructive op whose target is inside a worktree
// isolation dir. Bounded blast radius → trust the scope (Rule 8).
function checkContainedScope({ filePath, command }) {
  const hay = normPath(filePath) + "\n" + normPath(command);
  if (CONTAINED_RE.test(hay)) return { marker: ".worktrees/" };
  return null;
}

function isDestructiveSignal(hits) {
  if (!Array.isArray(hits)) return null;
  // A classifier hit is a destructive signal when its category is
  // destructive_actions OR it carries an explicit decision of ask/deny.
  return (
    hits.find((h) => h && h.decision === "deny") ||
    hits.find((h) => h && (h.category === "destructive_actions" || h.decision === "ask")) ||
    null
  );
}

/**
 * Decide the PreToolUse tier for a tool call.
 *
 * @param {object} ctx
 * @param {string} ctx.tool   - tool name (e.g. "Bash", "Edit")
 * @param {*}      ctx.input  - tool_input payload
 * @param {Array}  [ctx.hits] - classifier hits from classifyToolCall()
 * @returns {{decision:"deny"|"ask"|"allow"|"none", tier:number, reason:(string|null), matched_on:(string|null)}}
 */
export function decideDestructiveAction(ctx = {}) {
  const { tool = "", input = null, hits = [] } = ctx;
  const filePath = extractFilePath(input);
  const command = extractCommand(input);

  // Tier 1: context-based hard deny (immutable files, hook-managed files, force-push-protected).
  const denial = checkDenyTier({ tool, filePath, command });
  if (denial) {
    return { decision: "deny", tier: 1, reason: denial.reason, matched_on: denial.matched_on };
  }

  // Explicit YAML decision:deny on any classifier hit also hard-denies.
  const denyHit = Array.isArray(hits) ? hits.find((h) => h && h.decision === "deny") : null;
  if (denyHit) {
    return {
      decision: "deny",
      tier: 1,
      reason:
        `Blocked by policy (${denyHit.category}): ${denyHit.matched_on}. Category decision=deny in loom-permissions.yaml.`,
      matched_on: denyHit.matched_on,
    };
  }

  const signal = isDestructiveSignal(hits);
  if (!signal) return { decision: "none", tier: 0, reason: null, matched_on: null };

  // Tier 3: contained scope → trust + allow (still logged by the caller).
  const contained = checkContainedScope({ filePath, command });
  if (contained) {
    return {
      decision: "allow",
      tier: 3,
      reason: `Contained scope (${contained.marker}) — trusting worktree isolation.`,
      matched_on: signal.matched_on || null,
    };
  }

  // Tier 2: ask (the rare destructive class).
  const protocol = summarizeProtocol(signal.required_protocol);
  return {
    decision: "ask",
    tier: 2,
    reason:
      `Destructive/irreversible (${signal.category || "destructive_actions"}): ${signal.matched_on || "matched"}. ` +
      `Kernel Rule 20 — confirm to proceed${protocol ? `; ${protocol}` : ""}.`,
    matched_on: signal.matched_on || null,
  };
}

function summarizeProtocol(required_protocol) {
  if (!Array.isArray(required_protocol) || required_protocol.length === 0) return "";
  // required_protocol is a list of single-key objects; surface the keys as a checklist.
  const keys = required_protocol
    .map((p) => (p && typeof p === "object" ? Object.keys(p)[0] : null))
    .filter(Boolean);
  if (keys.length === 0) return "";
  return `check: ${keys.join(", ")}`;
}

/**
 * Build the Claude Code PreToolUse decision object for a deny/ask result.
 * Returns null for allow/none (the hook simply exits 0 and does not print).
 */
export function toHookOutput(result) {
  if (!result || (result.decision !== "deny" && result.decision !== "ask")) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason || "",
    },
  };
}
