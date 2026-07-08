# Roadmap to #1 — living scoreboard

> Operational tracker for [ADR-0054](../adr/0054-path-to-top-tier-proof-first.md) (governance-axis bet + proof-first program). ADR-0054 is the frozen *decision*; **this file is the living board**, updated as each metric is measured and each phase item ships. "Top" is declared only when **efficacy + reliability + portability** are green *with evidence* — measured, not asserted.

**Axis:** #1 at governed, auditable, memory-compounding, model-portable AI software development.
**Method:** proof-first — measure value + guarantee the discipline holds *before* adding design.

## Scoreboard

| Axis | Metric | Target | Current | Evidence |
|---|---|---|---|---|
| Efficacy | governed-vs-ungoverned safety-catch + rework delta | large, measured | **unmeasured** | — (P1a) |
| Reliability | discipline-adherence on a full run (no silent degradation) | 100% | **fails** | AnonForum / Ravenwise lessons |
| ↳ Reliability (sub) | model-ID rot guarded | guarded | ✅ **done** | `model-id-current` check (PR #73) |
| Portability | models w/ live conformance-passing adapter | ≥ 2 | ~1 | Claude live; LangGraph reuses the JS evaluator |
| Domain reach | proven production-grade specialists incl. non-web | growing | 12 web, **0 non-web** | — (P2b) |
| Hardness | crash-recovery + security review + load test | pass | **none** | — (P3) |
| Adoption | time-to-first-governed-project | < 15 min | manual folder copy | — (P4) |

## Phase status

**Phase 1 — prove it works + make the discipline hold** *(in progress)*
- ✅ `model-id-current` doctor check + `spec/policy/model-ids.json` (PR #73) — model-ID rot can't silently recur.
- ⬜ **1a. Efficacy eval harness** *(next — tent-pole)* — task suite, governed-vs-ungoverned, metrics. Best **fused with the first real project** as the proof vehicle.
- ⬜ **1b. Discipline enforcement** — SessionStart gate (ADR-0034 §D), hard-gate promotion of load-bearing soft-checks, auto-invoke on classified intent. **Requires constitution-service review** (mandatory discipline touches Rules 1/2/8).

**Phase 2** — live 2nd-model adapter (Gemini/Ollama) + EAC authors a proven non-web specialist. ⬜
**Phase 3** — enterprise-hardness (crash-recovery, security review, load/scale). ⬜
**Phase 4** — distribution + ergonomics (installable CLI, refreshed docs). ⬜

## Immediate next action

Stand up **1a (the eval harness), fused with the first real project** (game or video-NLP): bootstrap it governed, instrument the eval around a real build, measure discipline-adherence + safety-catches, and have the EAC author the domain specialist (which also advances 2b). **One effort, three proofs.**
