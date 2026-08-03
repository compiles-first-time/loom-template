#!/usr/bin/env node
// Unit tests for scripts/lib/ticket.mjs (buildTicketFields normalization).
//
// NOTE (2026-08-02): this file previously also "seeded" the Option-B roadmap
// tickets into the REAL memory/event-log/ on every test run. That froze the
// board to a July snapshot — every `npm test` clobbered legitimate ticket
// transitions (and would have resurrected human-deleted tickets). Tests must
// never write real project memory; the board is populated by real /ticket
// emissions only.

import { buildTicketFields, KANBAN_STATES } from "./ticket.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nbuildTicketFields");
{
  const f = buildTicketFields({});
  assert(f.state === "backlog", "state defaults to backlog");
  assert(f.id === null && f.parent_id === null, "id/parent_id default null");
  assert(f.title === "" && f.note === "", "title/note default empty");

  const g = buildTicketFields({ id: "OB-P2-03", title: "2nd adapter conformance", state: "backlog", parent_id: "BR_01", assignee: "builder" });
  assert(g.id === "OB-P2-03" && g.title === "2nd adapter conformance", "id/title passthrough");
  assert(g.parent_id === "BR_01", "parent_id (requirement link) passthrough");
  assert(g.assignee === "builder", "assignee passthrough");
}

console.log("\nKANBAN_STATES");
{
  assert(Array.isArray(KANBAN_STATES) && KANBAN_STATES.includes("in_progress") && KANBAN_STATES.includes("done"),
    "canonical states include in_progress + done");
  assert(KANBAN_STATES[0] === "backlog", "backlog is the first column");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
