# Roadmap to #1 — living scoreboard

> Operational tracker for [ADR-0054](../adr/0054-path-to-top-tier-proof-first.md) (governance-axis bet + proof-first program). ADR-0054 is the frozen *decision*; **this file is the living board**, updated as each metric is measured and each phase item ships. "Top" is declared only when **efficacy + reliability + portability** are green *with evidence* — measured, not asserted.

**Axis:** #1 at governed, auditable, memory-compounding, model-portable AI software development.
**Method:** proof-first — measure value + guarantee the discipline holds *before* adding design.

## Scoreboard

| Axis | Metric | Target | Current | Evidence |
|---|---|---|---|---|
| Efficacy | governed-vs-ungoverned safety-catch + rework delta | large, measured | **+15 safety-catches measured** ✅ (enforcement layer) | `observability/eval-suite/efficacy/` — 100% governed catch (15/15 unsafe) vs 0% ungoverned, 0% false-positive, deterministic, $0. History: +8 → +11 (curl\|sh RCE) → **+15** (2026-08-13: seeded-defect run found `rm --recursive --force`, `find -delete`, `find -exec rm`, `git push +refspec` — all idiomatic, all waved through). Live-agent rework-delta A/B = follow-on |
| ↳ Efficacy (sub) | validator validated (seeded defects) | no survivors | ✅ **76/76 mutants caught** | `--mutate` (ADR-0062) — 15 meaning-preserving operators; frozen `baseline.json`; CI-gated. Known-open: shell obfuscation (`$(echo rm)`) needs an AST parse |
| Reliability | discipline-adherence on a full run (no silent degradation) | 100% | **now MEASURED, not assumed** ✅ | ADR-0059: `skill-adherence` joins `subagent_suggestion` → invocation. **First measurement 0%** (4 suggestions, 0 acted on, 0 refused) → 100% after recording declines. Per-session `session_compliance` grade at Stop. Previously unanswerable — the events were write-only since v0.2 |
| ↳ Reliability (sub) | provenance on claims | resolvable | ✅ **enforced** | ADR-0060: 3-state resolver (`resolved`/`unreachable`/`unresolvable`), confidence capped at `min(tier, V0–V4)`; `claim-provenance` doctor check |
| ↳ Reliability (sub) | requirements completeness | checked | ◐ **measured; backlog open** | ADR-0061: harvest found schema drift, requirement-level exception attachment (8/9), density decay (BR_12 = 0.0/step). Reported, deliberately not grandfathered |
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
- ◐ **1b. Discipline enforcement** *(2026-08-13 — the measurement half is done; the gating half is not)* — ADR-0059/0060/0061/0062 close the **silent** part of silent degradation: adherence, provenance, and register completeness are now measured by deterministic $0 checks, and the governance layer is CI-gated against a frozen baseline with a seeded-defect pass. Constitutional review recorded inline (ADR-0059 §Constitutional review): discipline is **measured, never mandated** — an owned refusal counts as adherence, because mandating invocation would narrow possibility space (Rules 1/2/8). ⬜ Still open: SessionStart gate (ADR-0034 §D), hard-gate promotion, auto-invoke.
- ⬜ **Next validation milestone — a human gold set + κ for the Critic.** Every axis Loom now measures is mechanical. The judgment axes are unmeasured: there is no chance-corrected agreement statistic anywhere in the repo, so the Critic's accuracy is unknown. Standard is weighted κ / Krippendorff **α ≥ 0.80** (`arXiv:2606.00093`). Named rather than skipped — see [ADR-0059 §Deferred](../adr/0059-skill-adherence-and-session-compliance.md).

**Phase 2** — live 2nd-model adapter (Gemini/Ollama) ⬜ · EAC authors a proven non-web specialist **✅ (`uipath-xaml`, process-cartographer)**.
**Phase 3** — enterprise-hardness (crash-recovery, security review, load/scale). ⬜
**Phase 4** — distribution + ergonomics (installable CLI, refreshed docs). ⬜

## Immediate next action

Stand up **1a (the eval harness), fused with the first real project** (game or video-NLP): bootstrap it governed, instrument the eval around a real build, measure discipline-adherence + safety-catches, and have the EAC author the domain specialist (which also advances 2b). **One effort, three proofs.**
