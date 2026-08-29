# CLAUDE.md — Project Index

> **Project:** `loom-template` *(replace at bootstrap)*
> **Description:** `<one-sentence description>` *(replace at bootstrap)*
> **Loom version:** 1.0.0
> **Kernel version:** v6
> **Initialized:** `2026-06-14`

This file is the **primary entry point** for Claude (chat) and Claude Code into this project. Keep it small — hard cap ~10 KB. Detail belongs in [`layers/`](./layers/), not here.

> **Fresh Claude instance?** State lives in session auto-memory and this file; run [`loom doctor`](./scripts/) and L8 discovery ([layers/L8-discovery.md](./layers/L8-discovery.md)) to audit it. Dated `handoff/` snapshots were retired 2026-08-02 — `/handoff` regenerates one if needed (ADR-0031).

---

## Project identity

- **What this is:** *(one paragraph — replace at bootstrap)*
- **Why it exists:** *(the problem this solves)*
- **Who uses it:** *(intended users — at v1, usually just the author)*
- **What success looks like:** *(concrete, measurable outcome)*

---

## Current goals

*(replace this list with your current goals; keep it under 5 items)*

1. *(Goal 1)*
2. *(Goal 2)*
3. *(Goal 3)*

---

## Layer map

The architecture is documented as **spec-as-codebase**. Each layer has its own file under [`layers/`](./layers/). Read only what you need.

| Layer | File | When to read |
|---|---|---|
| L0 — Constitutional | [L0](./layers/L0-constitutional.md) | Before any consequential action |
| L1 — Skeleton | [L1](./layers/L1-skeleton.md) | When adding/moving files |
| L2 — Agent topology | [L2](./layers/L2-agents.md) | When working with agents |
| L3 — Memory | [L3](./layers/L3-memory.md) | When reading/writing memory |
| L4 — Tooling (MCP) | [L4](./layers/L4-tooling.md) | When integrating new tools |
| L5 — Orchestration | [L5](./layers/L5-orchestration.md) | When designing task flows |
| L6 — Observability | [L6](./layers/L6-observability.md) | When debugging or shipping |
| L7 — Self-extension | [L7](./layers/L7-extension.md) | When the system changes itself |
| L8 — Discovery | [L8](./layers/L8-discovery.md) | When onboarding or auditing state |
| L9 — Observatory | [L9](./layers/L9-observatory.md) | When monitoring operations (12 live panels) |

Quick agent reference: [`AGENTS.md`](./AGENTS.md).
Canonical spec: [`loom-spec.md`](./loom-spec.md) (executive) → [`spec/loom-spec-v0.1-full.md`](./spec/loom-spec-v0.1-full.md) (complete).

---

## Constitutional baseline (must read before consequential actions)

This project inherits the **Trajectory Kernel V6** from Loom. The operationally critical rules:

- **Rule 1 — Authorship:** Every agent has the right to author its own pursuits within its possibility space. Agents may decline or escalate.
- **Rule 2 — Fundamental wrong:** Unconsented narrowing of another agent's possibility space is the fundamental wrong.
- **Rule 8 — Anti-paternalism:** No agent — including the kernel — decides what's good for another.
- **Rule 19 — Self-modification:** The kernel changes only via transparent, auditable, consent-based process. Rules 1–8 are effectively immutable.
- **Rule 20 — Temporal weighting:** Reversible narrowings weigh less than irreversible ones. Destructive ops require confirmation.
- **Rule 22 — Epistemic transparency:** Every claim has provenance. Every action emits a trace.
- **Rule 23 — Session-bounded reconciliation:** Reconciliation happens within bounded sessions.

Full text: [`constitution/kernel-v6.md`](./constitution/kernel-v6.md). Project-local extensions: [`constitution/local-rules.md`](./constitution/local-rules.md).

---

## Confidence calibration (mandatory for every claim)

| Level | Required action |
|---|---|
| `< 60%` | Stop; gather more data |
| `60–80%` | Proceed only with human oversight |
| `80–95%` | Proceed; log for audit |
| `> 95%` | Autonomous execution allowed |

Always be ready to answer: **"What would raise confidence to 95%?"**

---

## Working agreements

- **Edits over rewrites.** Prefer surgical edits to existing files.
- **No new files unless necessary.** Especially no new docs unless asked.
- **ADRs for consequential choices.** Format under [`adr/`](./adr/).
- **Lessons-learned for failures.** Surface to [`lessons-learned/`](./lessons-learned/).
- **Provenance tags `[source][confidence]`** on every non-trivial claim, per Kernel Rule 22.
- **Verification-first.** Reliability comes from verifier gates + enforcement (ADR-0044/0011/0047), not from more prompt detail — invest there first. `[multi-source][80–95%]` ([ADR-0044 §External corroboration](./adr/0044-verifier-gates-for-agent-tasks.md#external-corroboration-2026-08-03)).
- **An unchecked convention drifts.** A rule written only in prose is not a rule — measured, not assumed, is the standard. Adherence, provenance, and register completeness are all now checked by code (ADR-0059/0060/0061), because each had silently degraded while documented. `[multi-source][80–95%]`
- **Token-cost awareness.** Per [LR-06](./constitution/local-rules.md#lr-06): before multi-agent operations, estimate cost and surface it to the architect. Prefer targeted agents over fan-outs; canary before fleet; cheapest sufficient model for mechanical tasks. See [L5](./layers/L5-orchestration.md#token-cost-aware-orchestration).
- **RAG-aware guidance.** For retrieval work (search, knowledge base, document QA) consult [L3 §Retrieval pipeline](./layers/L3-memory.md#retrieval-pipeline) — pipeline, confidence gating, rerankers, GraphRAG decision tree, cost. Peer-reviewed basis in [ADR-0037](./adr/0037-retrieval-pipeline-evidence-review.md).
- **Workflow redesign is the investment.** Capability gains materialize after workflow redesign, not tool adoption — the J-curve (Brynjolfsson et al., AEJ:Macro 2021 `[H]`). Budget for the dip; tag lessons `[workflow-redesign]`.

## Pre-PR checklist (applies to loom-template itself)

> Loom's governance applies to its own development. The template must meet the same standards it requires of projects built on it.

Before opening a PR on loom-template:

1. **`loom doctor` passes** — hard checks green; warnings noted in the PR.
2. **`--gate` passes** — `node observability/eval-suite/efficacy/harness.mjs --gate` (ADR-0062). CI runs it too.
3. **Specialist consultation** — for non-trivial changes, invoke relevant specialist(s) per [ADR-0034](./adr/0034-specialist-invocation-discipline.md) path 2b; name them in the PR.
4. **Claim events** — emit `claim` records via `/claim` for non-trivial assertions.
5. **Hook capture** — confirm today's `session_start` in `memory/event-log/`; note gaps per [ADR-0038](./adr/0038-hook-capture-gap-detection.md).
6. **Suggestions closed** — every `subagent_suggestion` used or declined with a reason ([ADR-0059](./adr/0059-skill-adherence-and-session-compliance.md)).

## Claim convention (v0.2)

> Hooks in [`.claude/settings.json`](./.claude/settings.json) auto-emit the **mechanical subset** of the Rule-22 trace (timestamp, tool, args, exit code) to `memory/event-log/YYYY-MM-DD.jsonl`. The **introspective subset** (confidence, sources, decision log) requires you, the model, to emit it explicitly.

When stating a non-trivial confidence-tagged claim, **use [`/claim`](./.claude/commands/claim.md)** — it resolves sources mechanically and emits the record. Don't hand-write the JSONL; that friction is why this subset kept going dark.

```json
{"timestamp":"<iso>","session_id":"<id>","event_type":"claim","agent":"<name>","claim":"<assertion>","confidence":0.87,"confidence_cap":0.95,"what_would_raise_to_95":"<answer>","sources":["ADR-0044"],"decision_log":["<reason>"],"constitutional_check":"Passed Rule N"}
```

**Confidence is capped by provenance** ([ADR-0060](./adr/0060-claim-provenance-verification.md)): `min(tier, verification V0–V4)`. The `>95%` band needs T1–T2 at V2+ (fetched + content-hashed), or two *independent* resolved sources. `unreachable` (blocked network) is not a failure; `unresolvable` is. See [L6](./layers/L6-observability.md).

---

## Open questions (current)

*(track only questions blocking current work; archive resolved ones to `lessons-learned/`)*

- **Human gold set + κ for the Critic** ([ADR-0059 §Deferred](./adr/0059-skill-adherence-and-session-compliance.md)). Loom has no chance-corrected agreement measure anywhere, so the Critic's accuracy is unmeasured. Standard is Krippendorff α ≥ 0.80. **Next validation milestone.**
- **Decentralized (orchestrator-less) L5 (Stanford DeLM).** Read the primary arXiv paper first — basis is Tier-3 reporting only `[delm][<60%]`. Removing the orchestrator removes a governance chokepoint. Cross-ref ADR-0002/0010/0044/0055. No L5 change until then.
- **Beads git-native tickets vs progress-ledger/kanban** `[claude-protocol][60–80%]`. Overlaps ADR-0048 kanban; small mapping trial only.
- **TRACE Step-1 contrastive capability-gap diagnosis** for lessons/reputation — see ADR-0055 `[trace preprint][60–80%]`; diagnosis only, never its training stack.

---

## ADRs in flight

*(list ADRs in `Proposed` status; once `Accepted` they fall off this list)*

- [ADR-0057](./adr/0057-research-scout-update-bus-intake.md) — Research Scout: automated Update-Bus intake (proposal-only, human-gated). Awaiting Critic → Human Replica → user review; the weekly trigger stays un-armed until accepted.

**Recent ADRs (Accepted):** 0003–0047 — retrieval/context, v0.2 enforcement runtime, v0.3–v1.0 governance, Observatory (0039–0041), verifier gates (0044), model routing (0045), test-case registry + destructive hooks (0046–0047) · **0048–0053** (model-agnostic spec + adapters; native-first policy; LangGraph adapter; OTel audit; durable execution; agent reputation) · **0054–0058** (proof-first; lessons service; deliberation panel; kernel pin) · **0059–0064** (measured adherence + compliance; claim-provenance caps; Requirements Analyst; governance regression gate; skill standards + agent classification; /decompose pipeline). Full index in [`adr/`](./adr/); 0031 retired 2026-08-02.

---

*Edit this file as the project evolves. It is the single source of "where to look next" for any agent or human entering this project.*
