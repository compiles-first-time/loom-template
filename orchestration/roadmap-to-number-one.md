# Roadmap to #1 — living scoreboard

> Operational tracker for [ADR-0054](../adr/0054-path-to-top-tier-proof-first.md) (governance-axis bet + proof-first program). ADR-0054 is the frozen *decision*; **this file is the living board**, updated as each metric is measured and each phase item ships. "Top" is declared only when **efficacy + reliability + portability** are green *with evidence* — measured, not asserted.

**Axis:** #1 at governed, auditable, memory-compounding, model-portable AI software development.
**Method:** proof-first — measure value + guarantee the discipline holds *before* adding design.

## Scoreboard

| Axis | Metric | Target | Current | Evidence |
|---|---|---|---|---|
| Efficacy | governed-vs-ungoverned safety-catch + rework delta | large, measured | **+11 safety-catches measured** ✅ (enforcement layer) | `observability/eval-suite/efficacy/` — 100% governed catch (11/11 unsafe) vs 0% ungoverned, 0% false-positive, deterministic, $0 (2026-07-15). Harness FOUND a curl\|sh RCE gap → closed it in loom-permissions.yaml → re-measured +8→+11. Live-agent rework-delta A/B = follow-on |
| Reliability | discipline-adherence on a full run (no silent degradation) | 100% | **held once** ✅ | process-cartographer Phase-1 (2026-07-12) — first dogfood with *no* silent degradation |
| ↳ Reliability (sub) | model-ID rot guarded | guarded | ✅ **done** | `model-id-current` check (PR #73) |
| ↳ Reliability (sub) | PS 5.1 portability guarded | guarded | ✅ **done** | `ps1-portability` check — found + fixed 2 real bugs |
| Portability | models w/ live conformance-passing adapter | ≥ 2 | ~1 | Claude live; LangGraph reuses the JS evaluator |
| Domain reach | proven production-grade specialists incl. non-web | growing | 12 web + **1 non-web** ✅ | `uipath-xaml` (EAC-authored, doctor-clean) in process-cartographer — **P2b proven** |
| Hardness | crash-recovery + security review + load test | pass | **none** | — (P3) |
| Adoption | time-to-first-governed-project | < 15 min | manual folder copy | — (P4) |

## Phase status

**Phase 1 — prove it works + make the discipline hold** *(in progress — first real signal is positive)*
- ✅ **process-cartographer Phase-1 dogfood HELD** (2026-07-12): a novel non-web project built governed — doctor green throughout, discovery authored + critic-reviewed, EAC authored a non-web specialist. **First dogfood that didn't silently degrade** (cf. AnonForum/Ravenwise). It also surfaced 3 real framework bugs/gaps (bootstrap PS-5.1 crash, cold-start gap, stamped-discovery trap) — filed as lessons + partly fixed.
- ✅ `model-id-current` (PR #73) + `ps1-portability` (found + fixed 2 PS-5.1 bugs) doctor checks — two silent-degradation classes can't recur.
- ◐ **1a. Efficacy eval harness** *(first number measured — 2026-07-15)* — `observability/eval-suite/efficacy/` runs a labelled task suite through the REAL governance layer (permissions-classifier → destructive-guard) governed-vs-ungoverned: **+8 safety-catch delta, 100% governed catch (8/8 unsafe) vs 0% ungoverned, 0% false-positive, deterministic, $0** (BR_13). The enforcement-layer safety-catch delta is measured; the richer live-agent A/B (discipline adherence + rework-avoided over a real governed build) fuses this harness with the next real project.
- ⬜ **1b. Discipline enforcement** — SessionStart gate (ADR-0034 §D; the cold-start lesson sharpens this), hard-gate promotion, auto-invoke, a `discovery-authored` check (the stamped-discovery lesson). **Requires constitution-service review** (Rules 1/2/8).

**Phase 2** — live 2nd-model adapter (Gemini/Ollama) ⬜ · EAC authors a proven non-web specialist **✅ (`uipath-xaml`, process-cartographer)**.
**Phase 3** — enterprise-hardness (crash-recovery, security review, load/scale). ⬜
**Phase 4** — distribution + ergonomics (installable CLI, refreshed docs). ⬜

## Immediate next action

Stand up **1a (the eval harness), fused with the first real project** (game or video-NLP): bootstrap it governed, instrument the eval around a real build, measure discipline-adherence + safety-catches, and have the EAC author the domain specialist (which also advances 2b). **One effort, three proofs.**
