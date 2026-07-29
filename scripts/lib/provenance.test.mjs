import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyExecution,
  currentAgent,
  detectAgentInvocation,
  detectSkillInvocation,
  detectSlashCommand,
} from "./provenance.mjs";

/* ── execution_kind ─────────────────────────────────────────────────────── */

test("code execution is deterministic", () => {
  for (const tool of ["Bash", "Read", "Write", "Edit", "Grep", "Glob"]) {
    assert.equal(classifyExecution({ tool }), "deterministic", tool);
  }
});

test("spawning an agent spends inference", () => {
  for (const tool of ["Task", "Agent", "WebSearch", "Skill"]) {
    assert.equal(classifyExecution({ tool }), "model", tool);
  }
});

test("an MCP tool is unknown, not guessed", () => {
  // An external server does the work; this process cannot inspect it, and a
  // wrong label is worse than an honest gap.
  assert.equal(classifyExecution({ tool: "mcp__github__create_issue" }), "unknown");
});

test("an unrecognised or missing tool is unknown", () => {
  assert.equal(classifyExecution({ tool: "SomeFutureTool" }), "unknown");
  assert.equal(classifyExecution({}), "unknown");
  assert.equal(classifyExecution(), "unknown");
  assert.equal(classifyExecution({ tool: 42 }), "unknown");
});

/* ── agent identity ─────────────────────────────────────────────────────── */

test("the acting agent comes from the environment, defaulting to main", () => {
  assert.equal(currentAgent({}), "main");
  assert.equal(currentAgent({ LOOM_AGENT_NAME: "critic" }), "critic");
  assert.equal(currentAgent({ CLAUDE_AGENT_NAME: "eac" }), "eac");
});

/* ── skill invocation ───────────────────────────────────────────────────── */

test("the Skill tool records which skill ran", () => {
  assert.deepEqual(detectSkillInvocation({ tool: "Skill", input: { skill: "testcase" } }), {
    skill: "testcase",
    source: "tool",
  });
});

test("a non-skill tool is not a skill invocation", () => {
  assert.equal(detectSkillInvocation({ tool: "Bash", input: { command: "ls" } }), null);
});

test("a slash command is a skill invocation", () => {
  // Loom's own skills are slash commands, so this is where the skill map gets
  // its data — `skill` was measured at zero occurrences before this.
  assert.deepEqual(detectSlashCommand("/testcase BR_14 the thing"), {
    skill: "testcase",
    source: "slash_command",
  });
  assert.equal(detectSlashCommand("/Handoff").skill, "handoff", "case is normalised");
});

test("a slash mid-sentence is prose, not an invocation", () => {
  assert.equal(detectSlashCommand("see /handoff for context"), null);
  assert.equal(detectSlashCommand("use the a/b test"), null);
  assert.equal(detectSlashCommand(""), null);
  assert.equal(detectSlashCommand(null), null);
});

/* ── agent → agent ──────────────────────────────────────────────────────── */

test("Task records the child agent and its parent", () => {
  const edge = detectAgentInvocation(
    { tool: "Task", input: { subagent_type: "critic", description: "review the ADR" } },
    { LOOM_AGENT_NAME: "builder" },
  );
  assert.deepEqual(edge, {
    agent: "critic",
    parent_agent: "builder",
    description: "review the ADR",
  });
});

test("a Task with no subagent type yields no edge", () => {
  // Better a missing edge than an invented one: a missing edge looks missing,
  // a wrong edge looks like fact.
  assert.equal(detectAgentInvocation({ tool: "Task", input: { description: "do a thing" } }), null);
  assert.equal(detectAgentInvocation({ tool: "Bash", input: { subagent_type: "critic" } }), null);
});

test("an unparented spawn attributes to main rather than dropping the edge", () => {
  const edge = detectAgentInvocation({ tool: "Task", input: { subagent_type: "auth" } }, {});
  assert.equal(edge.parent_agent, "main");
});
