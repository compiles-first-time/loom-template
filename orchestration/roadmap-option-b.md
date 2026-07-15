# Roadmap — Option B: model-agnostic governance spec + adapters

> **North star:** [ADR-0048](../adr/0048-north-star-model-agnostic-spec-and-adapters.md). Loom becomes a runtime-neutral **spec** (policy + schemas + conventions) + host **adapters** + a **conformance suite**. This file is the durable checklist; it is hand-authored (distinct from the hook-managed `progress-ledger.md`). Task IDs are stable so they can seed kanban tickets (`ticket` events → Observatory Kanban panel).

**Status legend:** ☑ done · ◐ in progress · ☐ todo · ⏸ deferred/blocked
**Shaping decisions (2026-07-06):** govern both, dev-time first · hard-where-possible, advisory elsewhere · solo-operated, enterprise-shaped (defer RBAC/multi-tenancy/compliance).

**The one milestone that makes "model-agnostic" real:** `OB-P2-*` — a second adapter passing the conformance suite. Everything before it is building toward a *provable* claim, not the claim itself.

---

## Phase 0 — Decision & scaffolding (this session)

| ID | Task | Status | Links |
|---|---|---|---|
| OB-P0-01 | ADR-0048 north star (Accepted-pending) | ☑ | ADR-0048 |
| OB-P0-02 | This roadmap/checklist | ☑ | this file |
| OB-P0-03 | `spec/` + `adapters/` structure + READMEs + manifest (additive; no physical moves yet) | ☑ | `spec/`, `adapters/` |
| OB-P0-04 | Decoupling proof: destructive-action policy → `spec/policy/` data; guard consumes it; tests green | ☑ | `spec/policy/`, destructive-guard.mjs (+5 override tests) |
| OB-P0-05 | Kanban foundation: `ticket` event + projection (state + time-in-state + BR link) + panel + emit path | ☑ | aggregator, Observatory Kanban panel, `/ticket` |

## Phase 1 — Portable policy + Claude Code adapter (dev-time first)

| ID | Task | Status | Depends | Notes |
|---|---|---|---|---|
| OB-P1-01 | Formalize the Claude Code **adapter** boundary | ☑ | P0-03 | `adapters/claude-code/README.md` + `spec/MANIFEST.md`; physical move still deferred |
| OB-P1-02 | Migrate constitution + LR-04 + BR_01 tiers to **policy-as-data** in `spec/policy/` | ◐ | P0-04 | destructive-actions extracted; consolidating LR-04/constitution guards is ongoing |
| OB-P1-03 | **Evaluate OPA/Rego** vs the Loom-native evaluator | ☑ | P1-02 | **ADR-0049**: native-first; OPA triggered by a non-JS adapter (Phase 2) |
| OB-P1-04 | **Conformance suite** — the runtime-neutral adapter contract | ☑ | P1-02 | `spec/conformance/` (8 scenarios + runner); the OB-P2-03 yardstick |
| OB-P1-05 | Run the Claude Code adapter against the conformance suite | ☑ | P1-04 | passes (13 assertions); provides HARD enforcement |

## Phase 2 — Second adapter = the agnosticism proof ★

| ID | Task | Status | Depends | Notes |
|---|---|---|---|---|
| OB-P2-01 | Pick the second host: **LangGraph** (rich seams, JS) vs Gemini API | ☑ | P1-05 | **ADR-0050** — LangGraph chosen; Gemini-direct deferred (bare/advisory + OPA trigger) |
| OB-P2-02 | Build the second adapter (policy eval at its seam; map to interrupt/block/proceed) | ☑ | P2-01 | `adapters/langgraph/guard.mjs` + live `example.run.mjs` (ran vs a real StateGraph + fake model) |
| OB-P2-03 | **Second adapter passes conformance** → "model-agnostic" becomes fact | ☑ | P2-02 | **DONE** — 20 assertions + live graph run. *Host-agnostic proven; cross-language (Python/OPA) is the next depth (OB-P1-03 trigger)* |

## Phase 3 — Observability migration (vendor-neutral audit)

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-P3-01 | Event log → **OpenTelemetry** (OTLP) export (keep JSONL as the sink) | ☑ | ADR-0051: zero-dep OTLP mapper + `scripts/otel-export.mjs` (verified, 430 records) |
| OB-P3-02 | Observatory becomes an OTel **view** (reads OTLP) without losing the zero-dep dashboard | ☐ | follow-on half of Option 2 |

## Phase 4 — Production host adapter (durable execution)

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-P4-01 | Production adapter over **LangGraph** — durable state + interrupt/resume HIL, governed | ☑ | ADR-0052: checkpointer + real `interrupt()`/`Command(resume)`, verified live (approve→exec, reject→skip). Temporal deferred |
| OB-P4-02 | Persistent state for production (swap MemorySaver → Sqlite/Postgres saver; crash-recovery) | ◐ | config swap in LangGraph; Observatory aggregator staying in-memory is a separate concern |

## Phase 5 — Enterprise hardening (DEFERRED per scope decision)

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-P5-01 | RBAC / SSO | ⏸ | deferred until a 2nd operator/customer |
| OB-P5-02 | Multi-tenancy / tenant isolation | ⏸ | |
| OB-P5-03 | SOC2-style compliance tooling | ⏸ | |

## Cross-cutting

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-X-01 | **Kanban board** (action items + state + time-in-state + link to BR/requirement + its exceptions) | ◐ | foundation this session; polish tracked |
| OB-X-02 | Test-case registry per requirement (ADR-0046) — one register per BR, exceptions enumerated | ☑ | BR_01–BR_05 registered + emitting; `requirements/README.md` index |
| OB-X-03 | Standing research gates: "does the host already provide this?" + "spec or adapter?" | ☑ | ADR-0048 §7 |
| OB-X-04 | PRs #52 / #54 / #55 merged to main | ☑ | Option-B foundation + Phase 1 + Phase 2 all landed |
| OB-X-05 | **Flaky test fixed** — root cause: fragile `URL.pathname` regex (only matched UPPERCASE Windows drive) → malformed path → integration block silently skipped (52 vs 60). Now `fileURLToPath`. | ☑ | Stably 60 across runs. Same bug-class also found + fixed in `observatory/server.mjs` (CONFIG_PATH) + `scripts/lib/deploy.mjs`. Lesson: `2026-07-06-fileurl-to-path-windows-drive-letter.md`. Candidate doctor check noted. |

## Phase 1 proof-first backlog (2026-07-15 handoff)

> From `handoff/2026-07-15-deliberation-panel-and-research-findings.md`. Each item has a Requirements & Exceptions register (ADR-0046, `observability/eval-suite/requirements/BR_NN.md`) as its definition-of-done and a kanban ticket. An item is DONE only when its register PASSES. Seeded as `ticket` events → Observatory Kanban panel.

| ID | Task | Status | BR | Notes |
|---|---|---|---|---|
| OB-REP-01 | ADR-0053 **Step 1** passive reputation projection (panel dependency) | ☑ | BR_06 | `observatory/lib/reputation.mjs` + aggregator `state.reputation`; projection-only (no dispatch, Rule 2). critic APPROVE-WITH-FLAGS (fixed) + constitution-service APPROVE |
| OB-PANEL-01 | **Deliberation panel** (reputation-weighted + robust aggregation, cost-gated, live 2nd model) — ADR-0056 | ☑ | BR_07 | ADR-0056; live llama3 vote proven (Canberra @0.632, indep 2); critic APPROVE-WITH-FLAGS (3 blockers + 2 residuals closed) + constitution-service (LR-06 emission added). 16 cases |
| OB-P1B-01 | `discovery-authored` doctor check (stamped ≠ authored; guarded for template) | ☐ | BR_08 | from lesson `2026-07-10-discovery-must-be-authored-not-stamped.md` |
| OB-P1B-02 | Cold-start bootstrap fixes (louder banner + `bootstrapped_this_session` marker) | ☐ | BR_09 | from lesson `2026-07-10-first-governed-session-cold-start.md`; constitution-service gate |
| OB-LS0-01 | Lessons-service **Phase 0** (frontmatter schema + `loom lessons search` + soft-checks) | ☐ | BR_10 | ADR-0055 Phase 0; zero-infra |
