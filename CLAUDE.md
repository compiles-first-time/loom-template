# CLAUDE.md — Project Index

> **Project:** `<PROJECT_NAME>` *(replace at bootstrap)*
> **Description:** `<one-sentence description>` *(replace at bootstrap)*
> **Loom version:** 0.2.0
> **Kernel version:** v6
> **Initialized:** `<YYYY-MM-DD>`

This file is the **primary entry point** for Claude (chat) and Claude Code into this project. Keep it small — hard cap ~10 KB. Detail belongs in [`layers/`](./layers/), not here.

> **Fresh Claude instance? Read [`handoff/2026-05-20-loom-v1.0-context.md`](./handoff/2026-05-20-loom-v1.0-context.md) before generating output.** It captures collaboration conventions, the 18 open PRs, and the nuances behind every architectural decision through v1.0. See [`handoff/README.md`](./handoff/README.md) for the dated-snapshot convention.

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

- **ADR-0002** — Orchestration framework (LangGraph.js as v1 default). Confirm or override at bootstrap.

**Recent ADRs (Accepted):** 0003–0010 from Loom Enhancement Batch 01 (retrieval + context engineering, Phase 1 research) · 0011 Claude Code enforcement runtime (v0.2 PR-1 / A) · 0012–0016 (v0.2 B–F: subagents, bootstrap unification, lessons auto-suggest, loom doctor, Update Bus stub). v0.2 enforcement runtime complete. **Docs:** 0031 (handoff maintenance policy — when to write new handoffs, what goes in them, TL;DR ≤ 250 words constraint, `loom doctor` `handoff-freshness` check). v0.3.3 = 0034 (specialist-invocation discipline when registry unavailable; closes Ravenwise lesson Root cause 3) · 0035 (provisioning specialist + per-platform playbook schema + 5-layer staleness validation; closes Ravenwise lesson out-of-scope #4) · 0036 (credential collection: `@napi-rs/keyring` primary + `.env.local` fallback + `keyring:service/account` reference convention; closes architect direction 2026-05-25). **All three Proposed (cascade PRs).**

> **Note:** This line is stale for v0.3 → v0.3.2 entries (0017–0030, 0032, 0033 are merged on main but missing here — collateral from cascade-merge `CLAUDE.md` conflict resolutions). Separate cleanup PR proposed; see [`lessons-learned/2026-05-22-browser-gated-provisioning-friction.md`](./lessons-learned/2026-05-22-browser-gated-provisioning-friction.md).

---

*Edit this file as the project evolves. It is the single source of "where to look next" for any agent or human entering this project.*
