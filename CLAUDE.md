# CLAUDE.md — Project Index

> **Project:** `<PROJECT_NAME>` *(replace at bootstrap)*
> **Description:** `<one-sentence description>` *(replace at bootstrap)*
> **Loom version:** 0.2.0
> **Kernel version:** v6
> **Initialized:** `<YYYY-MM-DD>`

This file is the **primary entry point** for Claude (chat) and Claude Code into this project. Keep it small — hard cap ~10 KB. Detail belongs in [`layers/`](./layers/), not here.

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
| L8 — Discovery (v0.5) | [layers/L8-discovery.md](./layers/L8-discovery.md) | When capturing what to build (functional + NFR + risks) |

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

## Runtime discovery

What MCP servers + subagents are actually available to this session: [`tools/discovered-runtime.md`](./tools/discovered-runtime.md) — auto-generated at SessionStart and bootstrap per [ADR-0020](./adr/0020-runtime-discovery.md). If subagents are flagged STALE, restart Claude Code.

## Open questions (current)

*(track only questions blocking current work; archive resolved ones to `lessons-learned/`)*

- *(none yet)*

---

## ADRs in flight

*(list ADRs in `Proposed` status; once `Accepted` they fall off this list)*

- **ADR-0002** — Orchestration framework (LangGraph.js as v1 default). Confirm or override at bootstrap.

**Recent ADRs (Accepted):** v0.2 = 0011 (hooks) · 0012 (subagents) · 0013 (bootstrap unification) · 0014 (lessons auto-suggest) · 0015 (loom doctor) · 0016 (Update Bus stub). v0.3 = 0017 (intent classifier + LR-02) · 0018 (secrets handling + LR-03) · 0019 (deploy primitive) · 0020 (runtime discovery + subagent staleness) · 0021 (subagent canonical-prompt evals). v0.4 = 0022 (xlsx docs convention + LR-05) · 0023 (specialist registry) · 0024 (12 starter specialists). v0.5 = 0025 (Discovery scaffolding + L8) · 0026 (Discovery gate + Critic checklists). v0.6 = 0027 (LR-04 permissions protocol — subsumes LR-02 + LR-03) · 0028 (OAuth preference + L4 credential hierarchy). v1.0 = 0029 (HR work-graph: requirements.md → JSON + markdown) · 0030 (Specialist lifecycle: spawn / retire / promote-lessons). **v1.0 complete.** v0.3.1 = 0032 (deployment hardening — wait-for-terminal-state primitive + pre-flight quota check + response-body discipline; AnonForum 2026-05-21 findings). v0.3.2 = 0033 (MCP-vs-CLI capability matrix; closes ADR-0032 §E bonus finding).

---

*Edit this file as the project evolves. It is the single source of "where to look next" for any agent or human entering this project.*
