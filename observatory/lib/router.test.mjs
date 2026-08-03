#!/usr/bin/env node
// Unit tests for observatory/lib/router.mjs — the ticketDeleteGuard that
// enforces "only done-column tickets are deletable, and only via the human
// Observatory UI surface" (the agent-facing /ticket path has no delete verb).

import { ticketDeleteGuard } from "./router.mjs";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓  ${label}`);
  } else {
    failed++;
    console.error(`  ✗  ${label}`);
  }
}

const stateWith = (tickets) => ({ kanban: { tickets } });

console.log("\nticketDeleteGuard");
{
  const g = ticketDeleteGuard(stateWith([]), "OB-X-99");
  assert(g.ok === false && g.status === 404, "unknown ticket → 404");
}
{
  const g = ticketDeleteGuard(stateWith([{ id: "T1", state: "in_progress" }]), "T1");
  assert(g.ok === false && g.status === 409, "non-done ticket → 409 (finish the work first)");
  assert(/in_progress/.test(g.error), "error names the ticket's actual state");
}
{
  const g = ticketDeleteGuard(stateWith([{ id: "T1", state: "done" }]), "T1");
  assert(g.ok === true && g.ticket.id === "T1", "done ticket → deletable");
}
{
  for (const s of ["backlog", "todo", "blocked", "review"]) {
    const g = ticketDeleteGuard(stateWith([{ id: "T1", state: s }]), "T1");
    assert(g.ok === false, `state '${s}' is not deletable`);
  }
}
{
  const g = ticketDeleteGuard(undefined, "T1");
  assert(g.ok === false && g.status === 404, "missing state shape → 404, no throw");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
