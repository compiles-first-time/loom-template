# Handoff — Observatory (L9) UX redesign: approved design + proof-first build plan

> **Date:** 2026-07-16 · **Status:** design **approved** (clickable mockup v4.3); production build **not started** — this is the build spec.
> **Mockup (reference):** [`docs/proposals/observatory-redesign/mockup.html`](../docs/proposals/observatory-redesign/) — self-contained, clickable, both themes.
> **Live Artifact:** https://claude.ai/code/artifact/fef889a8-df4d-49d7-9904-c1ac13f83422 (private to the architect).
> **Lesson from this cycle:** [`lessons-learned/2026-07-16-mockup-first-adversarial-review.md`](../lessons-learned/2026-07-16-mockup-first-adversarial-review.md).

## Why

The current Observatory is an **event-log inspector for a developer**, not a narrative for an operator: panels show raw slices (`BR_02`, truncated sessions, an unlabeled cost total, a bare deliberation question). The architect asked to *plan → design → validate/reiterate until perfect → then build proof-first*. This handoff captures the validated design.

## The redesign, in one line

An **oversight console with progressive disclosure**: an operator sees the story at a glance (Overview), an architect drills into full provenance (a right-side detail drawer on every item). The **run (execution)** is the spine — every op, decision, agent action, test case, and commit ties back to a `run_id` and the **user** who initiated it.

## Information architecture (12 panels, 3 nav groups)

- **Monitor:** Overview · Runs · Requirements · Decisions · Agents
- **Govern:** Governance · Constitution
- **Operate:** Work · Models & Budget · Cost · Activity · Glossary

Header leads with the **project name** (each project gets its own dashboard, scoped to it), then "Loom Observatory · L9", a run-context pill, the acting user, and a theme toggle.

## Key design decisions (validated in the mockup)

1. **Progressive disclosure** — Overview is the operator narrative; clicking any row/card/tile opens a detail drawer with plain-language explanation + full provenance (operator glance → architect depth).
2. **Runs as the spine** — a Jira-style Runs list (filter by owner / project / status / env), and every other panel tags its rows with the run + actor. Multi-user auditable.
3. **Written requirements** — plain-language BR names, not `BR_02`; the drawer shows the full test-case register (expected→actual, who checked, why it validates) and an **honest re-run flow** (flaky clears on retry; blocked/broken reproduce until the real cause is resolved).
4. **Constitution viewer** — the real Kernel V6 rules (1,2,8 immutable; 19,20,22,23) + local rules LR-01..07, grouped, searchable, each showing how often governance **cited** it this run, linking back into the Governance log. Honest that the canonical kernel is user-installed.
5. **Decisions** — who asked / who resolved, votes weighted by reputation, **voice = agent vs model vs model-samples**, and effective-independence (correlated Claude-family voices count as ~one).
6. **Models & Budget** — the editable operational panel (see below).
7. **Colour discipline** — a single **teal** accent for brand/interactive; **green/amber/red reserved for state** (allow/pass, ask/attention, deny/fail). Mono for all data; larger type + AA-compliant contrast in both themes.
8. **Encoding** — the shipped mockup is pure ASCII (numeric HTML entities) so typography renders regardless of how the page is served (see lesson).

## Configurable items — scope + the write-back model

The architect scoped the dashboard-configurable items to **low-stakes operational knobs** — model **routing** (which model runs which task class), **pricing**, per-model **caps**, **fallback** order, **budget**, **checkpoint on/off**. These have **no bearing on reasoning, quality, criticality, or consequential outcomes**, so the write-back is light-touch, **not** the governance ceremony first proposed:

> **edit → validate → write the real config file → emit one audit line (who/what/when, Rule 22) → panel reflects it → survives reload.** No confirmation gates, no constitution-service, no destructive-guard.

- **Read-only panels** (reflect reality, no write-back): Overview, Runs, Requirements, Decisions, Agents, Governance log, Constitution, Activity, Cost.
- **Editable panels** (write-back, audited): **Models & Budget** (→ the LiteLLM routing/caps config per [ADR-0045](../adr/0045-per-agent-model-routing.md)) and the **Work** kanban (→ ticket-transition events).
- **Durable execution** ([ADR-0052](../adr/0052-production-host-durable-execution.md)): raising a capped model's limit resumes its checkpointed in-flight work from the last checkpoint — surfaced in the mockup (banner + Checkpointed-work tile + model drawer).

The heavy governed path stays reserved for genuinely consequential changes (editing the kernel, weakening a destructive-op rule) — deliberately **not** exposed in the dashboard.

## Proof-first build plan (per [ADR-0054](../adr/0054-path-to-top-tier-proof-first.md))

The redesign is an incremental rebuild of `observatory/public/js/app.mjs` (+ small `server.mjs` write-back endpoints), one panel at a time, each with a Requirements & Exceptions register that PASSES before it's done.

1. **Marquee proof — Models & Budget write-back.** Register proves the round-trip *and* the guardrails: edit a field → the real config file changes → an audit event is emitted → the panel reflects it → it **survives a reload**; plus BE/SE: malformed value rejected, cap ≤ 0 rejected, non-owner cannot rewrite, audit-line-on-every-change.
2. Then the read-only panels (Constitution, Runs, evidence-ledger Overview, Requirements drawer, Decisions provenance) — each a projection over existing events + a register.
3. Work kanban write-back (ticket transitions).
4. Wire panels to live `/api/state` + SSE; browser-verify each.

## Open threads (unchanged by this handoff)

- **PR #81** (`phase1-backlog`, BR_06–BR_13) still open — architect merges (self-authored/AI-review is blocked by the auto-mode guardrail).
- **`efficacy-hardening`** (`0fbd2cf`, curl|sh RCE gap → +11) staged locally to push after #81 merges.
- Backlog: more efficacy gaps (`dd`/`mkfs`), Update-Bus panel, lessons Phase 1.
