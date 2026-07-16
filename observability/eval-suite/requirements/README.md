# Requirements registry — index

Per [ADR-0046](../../../adr/0046-requirements-exceptions-testcase-registry.md). Each **Business Requirement (BR)** Loom has delivered, decomposed into its solution + Business/System Exceptions (BE/SE), with test cases that emit `test_case` events → the Observatory **Requirements** panel renders the full, live, regression-tracked view.

| BR | Title | ADR | Validated by | Register |
|---|---|---|---|---|
| **BR_01** | Hook-enforced confirmation for destructive actions | 0047 | `scripts/lib/destructive-guard.test.mjs` | [BR_01.md](./BR_01.md) (full exemplar) + `BR_01.cases.mjs` |
| **BR_02** | Requirements & Exceptions Test-Case Registry | 0046 | `observatory/lib/aggregator.test.mjs` | `registry.cases.mjs` |
| **BR_03** | Kanban action-item tracking (time-in-state) | 0048 (OB-X-01) | `observatory/lib/aggregator.test.mjs` | `registry.cases.mjs` |
| **BR_04** | Model-agnostic governance (spec + adapters) | 0048 | `adapters/langgraph/guard.test.mjs` | `registry.cases.mjs` |
| **BR_05** | Conformance suite (adapter contract) | 0048 (OB-P1-04) | `spec/conformance/conformance.test.mjs` | `registry.cases.mjs` |
| **BR_06** | Passive agent-reputation projection (Step 1) | 0053 | `observatory/lib/reputation.test.mjs` | [BR_06.md](./BR_06.md) + `BR_06.cases.mjs` |
| **BR_07** | Multi-LLM deliberation panel (disciplined) | 0056 | `scripts/lib/deliberation.test.mjs` | [BR_07.md](./BR_07.md) + `BR_07.cases.mjs` |
| **BR_08** | `discovery-authored` doctor check | 0015 (+ lesson 2026-07-10) | `scripts/lib/discovery-authored.test.mjs` | [BR_08.md](./BR_08.md) + `BR_08.cases.mjs` |
| **BR_09** | Cold-start bootstrap fixes | 0020/0038 (+ lesson 2026-07-10) | `scripts/lib/cold-start.test.mjs` | [BR_09.md](./BR_09.md) + `BR_09.cases.mjs` |
| **BR_10** | Lessons-Learned Service Phase 0 | 0055 | `scripts/lib/lessons.test.mjs` | [BR_10.md](./BR_10.md) + `BR_10.cases.mjs` |
| **BR_11** | Verifier gate → reputation emission | 0044 + 0053 | `scripts/lib/verify-gate.test.mjs` | [BR_11.md](./BR_11.md) + `BR_11.cases.mjs` |
| **BR_12** | Governed decision (panel as a decision path) | 0056 | `scripts/lib/governed-decision.test.mjs` | [BR_12.md](./BR_12.md) + `BR_12.cases.mjs` |
| **BR_13** | Efficacy eval harness (governed vs ungoverned) | 0054 (P1a) | `observability/eval-suite/efficacy/harness.test.mjs` | [BR_13.md](./BR_13.md) + `BR_13.cases.mjs` |

## How it works

- **Full exemplar:** [`BR_01.md`](./BR_01.md) is the human-readable register in the ADR-0022 table form (ID · Type · Expected/Actual I/O · Why · status), with `BR_01.cases.mjs` asserting the guard AND emitting on every `node scripts/test.mjs`.
- **BR_02–BR_05:** defined as data in `registry.cases.mjs`; `registry.test.mjs` asserts each traces to a real validating test and emits its rows. The rich per-column view is the **Observatory Requirements panel** (the live source of truth); this index is the human map.
- **Regression:** every `node scripts/test.mjs` re-emits all rows (upserted by id), so the panel always reflects current status.

## Convention for new requirements

New validated work becomes a `BR_NN` here (via `/testcase`): decompose into solution + BE/SE exceptions, wire cases to emit, add a row above. This is the traceability spine — every requirement's exceptions are enumerated and every case shows expected-vs-actual.
