# CLAUDE.md — Project Index

> **Project:** `loom-template` *(replace at bootstrap)*
> **Description:** `<one-sentence description>` *(replace at bootstrap)*
> **Loom version:** 1.0.0
> **Kernel version:** v6
> **Initialized:** `2026-06-14`

This file is the **primary entry point** for Claude (chat) and Claude Code into this project. Keep it small — hard cap ~10 KB. Detail belongs in [`layers/`](./layers/), not here.

> **Fresh Claude instance?** Current state lives in session auto-memory and this file; run [`loom doctor`](./scripts/) and L8 discovery ([layers/L8-discovery.md](./layers/L8-discovery.md)) to audit project state. The dated `handoff/` snapshots were retired 2026-08-02 (recoverable from git history; the `/handoff` skill can regenerate one if a frozen snapshot is ever needed again — see ADR-0031).

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
| L0 — Constitutional substrate | [layers/L0-constitutional.md](./layers/L0-constitutional.md) | Before any consequential action |
| L1 — Project skeleton | [layers/L1-skeleton.md](./layers/L1-skeleton.md) | When adding/moving files |
| L2 — Agent topology | [layers/L2-agents.md](./layers/L2-agents.md) | When working with agents |
| L3 — Memory architecture | [layers/L3-memory.md](./layers/L3-memory.md) | When reading/writing memory |
| L4 — Tooling layer (MCP) | [layers/L4-tooling.md](./layers/L4-tooling.md) | When integrating new tools |
| L5 — Orchestration | [layers/L5-orchestration.md](./layers/L5-orchestration.md) | When designing task flows |
| L6 — Observability & eval | [layers/L6-observability.md](./layers/L6-observability.md) | When debugging or shipping |
| L7 — Self-extension / Update Bus | [layers/L7-extension.md](./layers/L7-extension.md) | When the system changes itself |
| L8 — Discovery | [layers/L8-discovery.md](./layers/L8-discovery.md) | When onboarding or auditing project state |
| L9 — Observatory | [layers/L9-observatory.md](./layers/L9-observatory.md) | When monitoring operations or reviewing Update Bus proposals |

Quick agent reference: [`AGENTS.md`](./AGENTS.md).
Canonical spec: [`loom-spec.md`](./loom-spec.md) (executive) → [`spec/loom-spec-v0.1-full.md`](./spec/loom-spec-v0.1-full.md) (complete).

---

## Constitutional baseline (must read before consequential actions)

This project inherits the **Trajectory Kernel V6** from Loom. The operationally critical rules:

- **Rule 1 — Authorship:** Every agent has the right to author its own pursuits within its possibility space. Agents may decline or escalate.
- **Rule 2 — Fundamental wrong:** Unconsented narrowing of another agent's possibility space is the fundamental wrong.
- **Rule 8 — Anti-paternalism:** No agent — including the kernel — decides what's good for another.
- **Rule 19 — Self-modification:** The kernel modifies itself only via transparent, auditable, consent-based process. Foundational rules (1–8) are effectively immutable.
- **Rule 20 — Temporal weighting:** Reversible narrowings carry less weight than irreversible ones. Destructive ops require confirmation.
- **Rule 22 — Epistemic transparency:** Every claim must have provenance. Every action emits a trace.
- **Rule 23 — Session-bounded reconciliation:** State reconciliation happens within bounded sessions.

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
- **Token-cost awareness.** Per [LR-06](./constitution/local-rules.md#lr-06): before running multi-agent operations, estimate the cost and surface it to the architect. Prefer targeted agents over workflow fan-outs. Run a canary agent before fleet fan-out. Use the cheapest model sufficient for mechanical tasks. See [L5 §Token-cost-aware orchestration](./layers/L5-orchestration.md#token-cost-aware-orchestration) for the full discipline.
- **RAG-aware guidance.** When the project involves retrieval (search, knowledge base, document QA), consult [L3 §Retrieval pipeline](./layers/L3-memory.md#retrieval-pipeline) for the default pipeline, confidence gating, reranker alternatives, GraphRAG decision tree, and iterative pattern cost guidance. All drawn from peer-reviewed evidence per [ADR-0037](./adr/0037-retrieval-pipeline-evidence-review.md).
- **Workflow redesign is the investment.** Agent capability gains materialize only after workflow redesign, not just tool adoption — the productivity J-curve (Brynjolfsson et al., AEJ:Macro 2021 `[H]`). Budget for the dip; track workflow changes in lessons-learned with tag `[workflow-redesign]`.

## Pre-PR checklist (applies to loom-template itself)

> Loom's governance applies to its own development. The template must meet the same standards it requires of projects built on it.

Before opening a PR on loom-template:

1. **`loom doctor` must pass** — all hard checks green. Warnings noted in PR description.
2. **Specialist consultation** — for non-trivial changes, invoke relevant specialist(s) via [ADR-0034](./adr/0034-specialist-invocation-discipline.md) path 2b (Agent tool with SKILL.md content). Document which specialists were consulted in the PR description.
3. **Claim events** — emit `event_type: claim` records for non-trivial assertions introduced by the PR (per the Claim convention below).
4. **Hook capture verification** — confirm hooks are firing for this session (check `memory/event-log/` for today's `session_start` event). If not, note the gap in the PR description per [ADR-0038](./adr/0038-hook-capture-gap-detection.md).

## Claim convention (v0.2)

> Hooks in [`.claude/settings.json`](./.claude/settings.json) auto-emit the **mechanical subset** of the Rule-22 trace (timestamp, tool, args, exit code) to `memory/event-log/YYYY-MM-DD.jsonl`. The **introspective subset** (confidence, sources, decision log) requires you, the model, to emit it explicitly.

When stating a non-trivial confidence-tagged claim, append one JSONL line to today's event log:

```json
{"timestamp":"<iso>","session_id":"<id>","event_type":"claim","agent":"<name-or-session>","claim":"<assertion>","confidence":0.87,"what_would_raise_to_95":"<answer>","sources":["<id>","..."],"decision_log":["<reason>"],"constitutional_check":"Passed Rule N"}
```

Use `Bash` with a single-line `echo` redirect (POSIX) or `Add-Content` (PowerShell). See [L6](./layers/L6-observability.md) for the full schema and rationale.

---

## Open questions (current)

*(track only questions blocking current work; archive resolved ones to `lessons-learned/`)*

- *(none yet)*

---

## ADRs in flight

*(list ADRs in `Proposed` status; once `Accepted` they fall off this list)*

- *(none — ADR-0002 and ADR-0034 accepted 2026-07-07; no ADRs currently in `Proposed` status)*

**Recent ADRs (Accepted):** 0003–0010 (batch 01: retrieval + context engineering) · 0011–0016 (v0.2: enforcement runtime, subagents, bootstrap, lessons, doctor, Update Bus stub) · 0017–0030 (v0.3–v1.0: intent classifier, secrets, deploy, discovery, specialists, permissions, HR) · 0031 (handoff policy) · 0032–0033 (deploy terminal states, loom-spec maintenance) · 0034–0036 (v0.3.3: specialist invocation, provisioning specialist, credential collection) · 0037–0038 (v0.3.4: RAG research arc + LR-06, hook capture gap detection) · 0039–0041 (Observatory: architecture, projection schemas, Update-Bus integration — accepted 2026-07-07) · 0042 (credential-setup specialist) · 0043 (cwd-robust project-root resolution) · 0044 (verifier gates for agent tasks) · 0045 (per-agent model routing + LiteLLM proxy) · 0046–0047 (test-case registry + hook-enforced destructive-action confirmation, BR_01) · **0048–0053 (north star: model-agnostic spec + adapters; policy engine native-first; 2nd adapter LangGraph; OTel OTLP audit; durable execution; agent reputation)** · **0054 (path to top-tier: governance axis + proof-first program)** · **0055 (shared lessons-learned service)** · **0056 (multi-LLM deliberation panel)**.

---

*Edit this file as the project evolves. It is the single source of "where to look next" for any agent or human entering this project.*
