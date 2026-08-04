# L9 — Observatory (Real-Time Dashboard)

> **Canonical source:** ADR-0039.

---

## Purpose

L9 is the human-facing rendering layer for Loom's operational signals. L6 (Observability) defines **what** to measure — hooks, event log, eval harness, drift signals. L9 defines **how** those measurements reach a human in real time via a locally-hosted dashboard.

The observatory consumes — never modifies — data produced by L0–L8. The only write path is the Update Bus accept/reject endpoint, which records a user decision into an existing inbox item (Kernel Rule 19: human approval gate).

## Architecture

Single-process Node.js HTTP server at `localhost:4040`. No external dependencies beyond Node 22+.

**Data flow:**
- `fs.watch` on `memory/event-log/`, `orchestration/`, `update-bus/inbox/`
- In-memory aggregator builds 8 projections from the JSONL event stream
- Server-Sent Events (SSE) push deltas to the browser
- Vanilla HTML/CSS/JS frontend — no build step, no framework

The JSONL event stream the Observatory consumes is the same audit stream targeted for OpenTelemetry OTLP export ([ADR-0051](../adr/0051-opentelemetry-otlp-audit.md)); the Observatory reads it locally while OTLP carries it to external backends.

## Projections → panels

> **Reconciled to shipped runtime 2026-08-04** (inbox item `audit-l9-openwork-checklist-stale-d4c04`). The redesign (PR #85 → live-or-empty PR #87) reorganized the panel set; this table now reflects what the client at `observatory/public/js/app.mjs` actually renders. Where a projection exists in the aggregator but no panel renders it, that is stated — per the capability-claims discipline ([lesson 2026-08-04](../lessons-learned/2026-08-04-capability-claims-must-move-with-the-feature.md)), a claimed capability with no UI surface must say so.

| Projection (aggregator) | Source | Rendered by panel |
|---|---|---|
| Sessions / runs | session_start, session_end, tool_call | Overview, Runs |
| Requirements | test_case events (ADR-0046 register) | Requirements |
| Decisions | deliberation events (ADR-0056) | Decisions |
| Agents / reputation | reputation_event, specialist_spawned/retired | Agents |
| Compliance / governance | destructive_op, constitution_check_missing | Governance |
| Constitution | kernel-v6 + local-rules (+ Rule-20 citations from destructive_op) | Constitution |
| Kanban / work | ticket, ticket_deleted events | Work |
| Models & budget | routing config + tokens events | Models & Budget |
| Cost | tokens / loop_cost_summary events | Cost |
| Activity | the full event feed | Activity |
| Update Bus | update-bus/inbox/*.md | **backend only — no panel renders it** (aggregator tracks the inbox; the router serves the ADR-0041 decision endpoint; review via files, `scripts/update-bus-tick.sh`, or chat) |

## Redaction boundary

All data passes through `observatory/lib/redactor.mjs` before reaching the browser. The redactor wraps `scripts/lib/secret-patterns.mjs` (HIGH-confidence token patterns) and adds email, IP, and user-path scrubbing. No raw event data bypasses this module.

## Panels (12, as shipped)

Overview, Runs, Requirements, Decisions, Agents (group *Monitor*); Governance, Constitution (*Govern*); Work, Models & Budget, Cost, Activity, Glossary (*Operate*).

- The **Requirements** panel surfaces the requirements & exceptions test-case registry ([ADR-0046](../adr/0046-requirements-exceptions-testcase-registry.md)); pass / fail rollups per requirement come from that register, and register cases also decompose onto the **Work** board (ADR-0057-era kanban).
- **Not carried over from the pre-redesign UI:** standalone Tasks, Failures, Deploys, Systems, and **Update Bus** panels. Their data (where the aggregator still tracks it) surfaces inside Activity/Governance/Work or, for the Update Bus, has no UI surface yet — a candidate follow-up, not a shipped capability.

## Relationship to other layers

- **Depends on L6** (reads event log, eval results, drift signals)
- **Depends on L5** (reads task-ledger, progress-ledger, work-graph)
- **Depends on L4** (reads MCP config for Systems panel)
- **Depends on L7** (reads Update Bus inbox; writes user decisions)
- **Does not modify** L0–L8 artifacts except Update Bus `user_decision` field

## Open work

- [x] Wire projections + panels with live data — shipped in the redesign (PR #85) and made live-or-empty (PR #87); all 12 panels above render from real aggregator state
- [x] Dark/light theme toggle, responsive layout, per-model cost rates — shipped (theme toggle + Models & Budget panel)
- [ ] **Update Bus review surface** — the backend integration exists (aggregator inbox tracking + ADR-0041 decision endpoint) but no panel renders it; a review panel is the main missing capability (surfaced by the 2026-08 internal audit)
- [ ] Cost accuracy — token accounting overstates spend (ticket `OB-COST-01`); the Cost/Models panels are only trustworthy once fixed
- [ ] v2: Agent-to-agent message visualization (blocked on A2A/ACP implementation)
- [ ] v2: RAGAS faithfulness scoring display (blocked on eval runner implementation)
