Create or move a **kanban action item (ticket)** on the Loom board (ADR-0048 `OB-X-01`). Tickets are units of work that flow across states; each links to the requirement (BR) it serves so the board card surfaces that requirement's exceptions (BE/SE) and test-case status.

## Input

`$ARGUMENTS` — free-form, e.g. `move OB-P1-03 to in_progress` or `new "wire OPA policy eval" for BR_01`. If ambiguous, ask which ticket and which state.

## States (columns)

`backlog → todo → in_progress → blocked → review → done` (from `scripts/lib/ticket.mjs` `KANBAN_STATES`).

## What to do

1. **Resolve the ticket id.** For a new ticket, mint a stable id (roadmap tasks use `OB-<phase>-<n>`; ad-hoc work can use a short slug). For a move, use the existing id.
2. **Emit a `ticket` event** via `emitTicket` from `scripts/lib/ticket.mjs`:
   ```js
   import { emitTicket } from "../../scripts/lib/ticket.mjs";
   emitTicket({ id: "OB-P1-03", title: "Evaluate OPA/Rego", state: "in_progress", parent_id: "BR_01", assignee: "builder" });
   ```
   - Re-emitting the same `id` with a new `state` records a **transition**; the aggregator accrues **time-in-state** from the timestamps (upsert by id — no duplicates).
   - `parent_id` should be the requirement (BR) this ticket serves, when there is one — that's what links the card to its exceptions.
3. **Keep the roadmap in sync.** If the ticket corresponds to a roadmap task, update its status in `orchestration/roadmap-option-b.md` too (the roadmap is the durable human checklist; tickets are the live board).
4. **Confirm** the board reflects it (Observatory → Kanban panel), and the full suite stays green if you touched code.

## Requirement cases are already on the board — don't duplicate them

Every solution step and exception in a requirement's ADR-0046 register appears on the board **automatically** as a derived card (tagged `register`): non-passing cases surface individually in the open columns, and the requirement rolls up to a single Done card exactly when *all* its cases pass. So: do **not** mint a ticket per register case — mint tickets only for work that isn't captured as a register case (infra chores, follow-ups, spikes), and link them to their BR via `parent_id`.

## Deletion is a human verification act — agents must not delete

There is deliberately **no delete verb here**. A finished ticket is removed only by a human (third-party verification that the work is really complete), via the **× button on Done-column cards in the Observatory UI**, which POSTs `/api/tickets/:id/delete`. The server refuses anything not in `done` and appends an audited `ticket_deleted` event (actor + prior state + note) to the event log. Do not emit `ticket_deleted` events from agent code or CLI — that bypasses the verification boundary.

## Quality bar

- Every in-flight ticket has a `state` that matches reality; stale `in_progress` tickets are a smell (the board shows time-in-state so they surface).
- Tickets that implement a requirement carry its `parent_id` — an orphan ticket (no requirement, no rationale) is a smell.
- Don't invent states outside `KANBAN_STATES` unless you also teach the panel to render them.

$ARGUMENTS
