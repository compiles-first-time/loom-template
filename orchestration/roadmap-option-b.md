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
| OB-P2-01 | Pick the second host: **LangGraph** (rich seams, production-relevant) vs **Gemini API** (bare model, tests advisory path) | ☐ | P1-05 | ADR-0050 |
| OB-P2-02 | Build the minimal second adapter (policy eval at its seams; emit audit) | ☐ | P2-01 | |
| OB-P2-03 | **Second adapter passes conformance** → "model-agnostic" becomes fact, not claim | ☐ | P2-02 | THE milestone |

## Phase 3 — Observability migration (vendor-neutral audit)

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-P3-01 | Event log emits **OpenTelemetry** spans/logs (keep JSONL as a local sink) | ☐ | additive first, migrate second |
| OB-P3-02 | Observatory becomes an OTel **view** (reads OTLP) without losing the zero-dep dashboard | ☐ | |

## Phase 4 — Production host adapter (durable execution)

| ID | Task | Status | Notes |
|---|---|---|---|
| OB-P4-01 | Production adapter over **LangGraph/Temporal** (durable state, retries, recovery) | ☐ | the "enterprise production runtime" target |
| OB-P4-02 | State persistence (replace in-memory-only aggregator for the production path) | ☐ | |

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
| OB-X-02 | Test-case registry per requirement (ADR-0046) — one register per BR, exceptions enumerated | ◐ | BR_01 done; ongoing per requirement |
| OB-X-03 | Standing research gates: "does the host already provide this?" + "spec or adapter?" | ☑ | ADR-0048 §7 |
| OB-X-04 | Two open PRs awaiting Nick's merge: #52 (BR_01/registry) then B-foundation (this) | ◐ | self-merge blocked by guardrail |
