// Provenance instrumentation — the fields that make the event log a graph.
//
// Four things the log could not answer before, requested by the architect
// (2026-07-28) after IDEA's Observatory work found them missing:
//
//   1. which agent used which skill        → `skill_invoked`
//   2. which agent invoked which agent     → `agent_invoked` + `parent_agent`
//   3. what each step cost                 → `turn_token_usage` (see _transcript.mjs)
//   4. where traditional code ran, not a model → `execution_kind`
//
// Pure functions only, so they are testable without a hook payload. Every one
// of them returns an explicit "unknown" rather than a guess: a wrong provenance
// edge is worse than a missing one, because a missing edge looks missing and a
// wrong one looks like fact.

/** Tools whose work is done by code, with no inference in the loop. */
const DETERMINISTIC_TOOLS = new Set([
  "Bash",
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "Glob",
  "Grep",
  "LS",
  "TodoWrite",
]);

/** Tools that spend inference — a model runs as a direct result of the call. */
const MODEL_TOOLS = new Set(["Task", "Agent", "WebSearch", "Skill"]);

/**
 * Did this step run code, or did it spend inference?
 *
 * The axis is **what executed**, not who decided to call it. A model chooses
 * every tool call; that is not the question. The question is whether answering
 * it required another inference pass, because that is what costs money and what
 * cannot be replayed deterministically.
 *
 * Returns `"unknown"` for anything unrecognised — including MCP tools, whose
 * behaviour is defined by a server this process cannot inspect.
 */
export function classifyExecution({ tool } = {}) {
  if (!tool || typeof tool !== "string") return "unknown";
  if (MODEL_TOOLS.has(tool)) return "model";
  if (DETERMINISTIC_TOOLS.has(tool)) return "deterministic";
  // `mcp__server__tool` — an external server does the work; we cannot claim
  // either way without inspecting it.
  if (tool.startsWith("mcp__")) return "unknown";
  return "unknown";
}

/**
 * The agent currently acting.
 *
 * Claude Code does not expose a subagent's own name to its hooks, so a
 * subagent's calls are attributed to `main` unless the environment says
 * otherwise. That is a known limitation, recorded rather than papered over —
 * `parent_agent` on the spawn event still gives the edge.
 */
export function currentAgent(env = process.env) {
  return env.LOOM_AGENT_NAME || env.CLAUDE_AGENT_NAME || "main";
}

/**
 * A skill invocation, if this tool call is one.
 *
 * Two shapes reach us: the `Skill` tool (with a skill name in its input), and a
 * slash command in the user's prompt, which is how Loom's own `/testcase`,
 * `/ticket`, and `/handoff` are invoked.
 */
export function detectSkillInvocation({ tool, input } = {}) {
  if (tool !== "Skill") return null;
  const skill =
    (input && (input.skill || input.name || input.command)) ||
    (typeof input === "string" ? input : null);
  if (!skill || typeof skill !== "string") return null;
  return { skill: skill.trim(), source: "tool" };
}

/** Loom's own slash commands live in `.claude/commands/<name>.md`. */
export function detectSlashCommand(prompt) {
  if (!prompt || typeof prompt !== "string") return null;
  // Only a leading slash counts — "see /handoff for context" is prose.
  const m = /^\s*\/([a-z][a-z0-9:-]*)/i.exec(prompt);
  if (!m) return null;
  return { skill: m[1].toLowerCase(), source: "slash_command" };
}

/**
 * An agent-to-agent invocation, if this tool call is one.
 *
 * The `Task` tool's `subagent_type` is the child. The parent is whoever is
 * acting now. This is the edge the provenance graph could not draw, because
 * nothing recorded it.
 */
export function detectAgentInvocation({ tool, input } = {}, env = process.env) {
  if (tool !== "Task" && tool !== "Agent") return null;
  const child =
    input && (input.subagent_type || input.agent_type || input.agentType || input.subagentType);
  if (!child || typeof child !== "string") return null;
  return {
    agent: child,
    parent_agent: currentAgent(env),
    description: (input && (input.description || input.task)) || null,
  };
}
