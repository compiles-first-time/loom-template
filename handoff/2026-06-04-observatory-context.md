# Loom collaboration handoff — 2026-06-04 (Observatory context)

> Successor to [`handoff/2026-05-25-loom-v0.3.3-context.md`](./2026-05-25-loom-v0.3.3-context.md). Read that one for the Ravenwise findings and specialist-invocation discipline; this doc captures **what changed since 2026-05-25** + the L9 Observatory dashboard.

**Audience:** the Claude instance that opens this project in a new chat after 2026-06-04. Secondarily: Nick, when reviewing what's been captured.

---

## TL;DR — paste into a new chat to bootstrap context

```
This is the Loom template project (compiles-first-time/loom-template).
I am Nick, the architect. You are the builder.

Loom is at v0.3.4 on main (39 PRs merged). The L9 Observatory dashboard
is in a cascade of 3 open PRs (#40 base + #41 ADRs + #42 polish), plus
a handoff-doc PR (#43). 41 ADRs, 6 LRs, 10 layers (L0-L9), 19 agents.

Since the last handoff: v0.3.4 shipped RAG research (ADR-0037 + LR-06
token-cost awareness), hook-capture-gap detection (ADR-0038), bootstrap
PAT-collection (ADR-0036 §E). Then the Observatory: a zero-dep,
localhost-only, real-time dashboard rendering JSONL events + Update Bus
proposals via SSE. 15 files, 10 panels, dark/light toggle, responsive.

Read in this order before generating output:
1. handoff/2026-06-04-observatory-context.md (this file)
2. handoff/2026-05-20-loom-v1.0-context.md (foundational conventions)
3. CLAUDE.md (project index — layer map now includes L0-L9)

What's next: merge the 4 observatory PRs, test with real sessions,
wire Update Bus integration (ADR-0041 implementation), spec mirror
catch-up, 8 deferred specialists (v0.4.1).

Don't start building until Nick says go. Propose first; he decides.
```

---

## What changed since 2026-05-25

### v0.3.4 on main (PRs #37–#39, merged 2026-06-01)

| PR | ADR(s) | What |
|---|---|---|
| #37 | 0037 | **RAG research arc** — comprehensive evidence review of retrieval patterns. New LR-06: token-cost-aware orchestration. L3 + L5 layer amendments (retrieval pipeline evidence basis, cost-bounded loop discipline). |
| #38 | 0038 | **Hook capture gap detection** — SessionStart hook now detects and warns when event-log capture has gaps (stale `.last-discovered-at` sentinel, missing today's JSONL file). Closes the silent-audit-degradation follow-up from Ravenwise Root cause 2. |
| #39 | 0036 §E | **Bootstrap PAT-collection integration** — bootstrap `-SetupCredentials` switch detects keyring availability, prompts for OS keyring usage, chains into `collect-credentials.ps1`. PROV-EX-08 added to provisioning specialist. PS 5.1 null-coalescing fix. |

### Observatory dashboard (PRs #40–#42, open in cascade)

**PR #40** — The L9 Observatory base. 15 files, 1910 lines, zero npm dependencies.

- `observatory/server.mjs` — Node.js HTTP + SSE server. Replays last 7 days of JSONL on startup, watches for new events via `fs.watch`, pushes deltas to connected browsers.
- `observatory/lib/` — aggregator (15 event handlers, 8 projections), file-watcher (byte-offset tailing), redactor (wraps `secret-patterns.mjs`), router.
- `observatory/public/` — vanilla HTML/CSS/JS SPA. 10 panels: Overview, Agents, Tasks, Cost, Failures, Deploys, Compliance, Update Bus, Testing, Systems.
- `observatory/config.yaml` — port 4040, 7-day replay, per-model cost rates.
- `scripts/observatory.ps1` + `.sh` — cross-platform launch scripts.
- `layers/L9-observatory.md` — layer spec.
- `adr/0039-observatory-architecture.md` — architecture decision (Proposed).

**PR #41** — ADR-0040 (projection schemas) + ADR-0041 (Update Bus integration).

- ADR-0040 formalizes the 8 projection schemas (sessions, agents, tasks, cost, failures, deploys, compliance, update_bus) with additive-only evolution policy.
- ADR-0041 defines inbound (inbox file parsing → projection) and outbound (decision write-back → inbox file) integration protocol. Replaces the stub decision endpoint specification.

**PR #42** — Observatory polish.

- Dark/light theme toggle in header (persists to localStorage).
- Responsive layout (nav collapses to horizontal scroll on mobile).
- CLAUDE.md: L8 + L9 added to layer map, ADRs in flight refreshed, handoff pointer updated.
- loom-spec.md: L8 + L9 added to quick navigation table.

### Net additions to the substrate since v0.3.3

- **5 new ADRs**: 0037 (RAG research), 0038 (hook capture gap), 0039 (observatory architecture), 0040 (projection schemas), 0041 (Update Bus integration)
- **1 new LR**: LR-06 (token-cost-aware orchestration)
- **1 new layer**: L9 (Observatory)
- **15 new files** in `observatory/` directory
- **2 new scripts**: `scripts/observatory.{ps1,sh}`
- **Layer map now L0–L9** (was L0–L8)
- **Total ADRs**: 41 (0000–0041; 3 Proposed, rest Accepted)
- **Total agents**: 6 base + 13 specialists = 19

---

## Open work / PRs as of 2026-06-04

### Open PRs (merge in order)

| PR | Branch | Title | Depends on |
|---|---|---|---|
| #40 | `v0.5/observatory-infrastructure` | L9 Observatory base | main |
| #41 | `v0.5/observatory-adrs` | ADR-0040 + ADR-0041 | #40 |
| #42 | `v0.5/observatory-polish` | Dark/light toggle, responsive, CLAUDE.md + spec | #41 |
| #43 | `docs/handoff-2026-06-04` | This handoff doc | #42 |

These are a standard cascade — merge #40 first, then #41, #42, #43. GitHub may show conflicts on CLAUDE.md lines; web-UI resolution is fine (established pattern).

### Untracked artifacts (not part of PRs)

- `docs/build-hierarchy.mjs` + `docs/loom-agent-hierarchy.xlsx` — xlsx build artifacts from a separate task. Not committed.
- `package.json` + `package-lock.json` (root) — exceljs dependency for the xlsx build. Not committed.

---

## Critical decisions + idioms NEW since 2026-05-25

These are additive to the prior handoffs' sections.

### L9 is a separate layer from L6

L6 defines what to measure and the eval harness. L9 defines how measurements reach a human. Conflating them would violate single-responsibility. This is a deliberate architectural choice (ADR-0039 §Layer assignment).

### Observatory is read-only by default

The dashboard writes to exactly one place: the `user_decision` sub-object in Update Bus inbox files, and only when the user explicitly clicks Accept/Reject. This satisfies Kernel Rule 19 (self-modification only via transparent, consent-based process). All other data flows are read-only (JSONL tailing, file watching, SSE push).

### Redaction boundary before the browser

All event data passes through `observatory/lib/redactor.mjs` before reaching the browser. The redactor wraps `scripts/lib/secret-patterns.mjs` (HIGH-confidence token detection) and adds defense-in-depth scrubbing for emails, IP addresses, and user-path segments. The aggregator's constructor takes the redactor as a dependency; projections never hold raw strings.

### LR-06 token-cost-aware orchestration (ADR-0037)

New local rule established by the RAG research arc. Before running multi-agent operations (workflows, fan-outs, iterative retrieval), estimate the cost and surface it to the architect. Prefer targeted agents over workflow fan-outs. Run a canary agent before fleet fan-out. Use the cheapest model sufficient for mechanical tasks. This applies to the observatory's future multi-source aggregation patterns if they involve LLM calls.

### Projection schemas are additive-only (ADR-0040)

New fields may be added to any projection; existing fields are never removed or have their type changed. Breaking changes require a superseding ADR. This gives downstream consumers (panels, API clients, export tools) a stable contract.

### Hook capture gap detection is proactive (ADR-0038)

The SessionStart hook now actively checks for gaps: stale `.last-discovered-at` sentinel, missing today's JSONL file, long gaps between events. Warnings surface in the event log and are visible in the observatory's Compliance panel. This closes the silent-audit-degradation follow-up from the Ravenwise Root cause 2 lesson.

---

## What's known to be incomplete

| Item | Why deferred | Where it lands |
|---|---|---|
| **ADR-0041 implementation** (inbound inbox parsing + outbound decision write-back) | ADR written but code not yet modified. Router still has stub handler. | Follow-up PR after observatory cascade merges |
| **Work-graph + manifest reading** in Tasks and Agents panels | Currently placeholder when files don't exist. Needs `orchestration/work-graph.json` and `agents/specialists/_registry/manifest.yaml` integration. | Follow-up PR |
| **Real-session observatory test** | Need to run observatory alongside an active Claude Code session to verify live SSE streaming end-to-end | Manual test by Nick (reviewer item on PR #40) |
| **Spec mirror catch-up** (§B.9 Discovery + amendments to §B.3, §B.5, §B.6) | Deliberately deferred from v0.4–v1.0 to keep PR scope contained. Now also needs §B.10 Observatory. | Standalone spec-catchup PR |
| **8 deferred specialists** (search, cron, cdn, dns, push-notifications, analytics, feature-flags, A/B testing) | v0.4 plan disagreement: validate first 12/13 with real sessions before adding more | v0.4.1 |
| **Anthropic upstream issue** for dynamic subagent registry reload | Requires Nick's GitHub account | ADR-0020 has draft text |
| **mcp-yaml-json-alignment drift on main** | Surfaced during 2026-05-25 doctor run; small fix | One-line fix PR |

---

## What's likely next

In rough order of priority:

1. **Merge the 4 observatory PRs** (#40 → #41 → #42 → #43). Standard cascade merge in GitHub UI.
2. **Test observatory with a real active session.** Run `scripts/observatory.ps1` while Claude Code is active; verify live SSE streaming + panel rendering.
3. **Implement ADR-0041** — wire the Update Bus inbox parsing into the aggregator startup + file-watch, and replace the stub decision handler with actual file write-back.
4. **Wire work-graph + manifest reading** into the Tasks and Agents panels.
5. **Spec mirror catch-up.** Consolidated PR adding §B.9 (Discovery), §B.10 (Observatory), amendments to §B.3 (specialist registry), §B.5 (credential hierarchy), §B.6 (work-graph).
6. **v0.4.1** — 8 deferred specialists, once the 13 starters are validated.
7. **File the Anthropic upstream issue** for dynamic subagent registry reload.

---

## Read order for a fresh Claude instance

If you can read only 5 files, in order:

1. **This file** — what changed since v0.3.3
2. [`handoff/2026-05-20-loom-v1.0-context.md`](./2026-05-20-loom-v1.0-context.md) — foundational collaboration conventions (Architect/Builder model, cascade PRs, xlsx convention, LR-05, constitution-as-text, etc.)
3. [`CLAUDE.md`](../CLAUDE.md) — project index (layer map L0–L9, ADRs in flight)
4. [`adr/0039-observatory-architecture.md`](../adr/0039-observatory-architecture.md) — observatory design decisions
5. [`layers/L9-observatory.md`](../layers/L9-observatory.md) — layer spec

If you have room for 5 more:

6. [`adr/0040-observatory-projection-schemas.md`](../adr/0040-observatory-projection-schemas.md) — the 8 projection schemas (stable API contract)
7. [`adr/0041-update-bus-observatory-integration.md`](../adr/0041-update-bus-observatory-integration.md) — Update Bus integration protocol (not yet implemented)
8. [`handoff/2026-05-25-loom-v0.3.3-context.md`](./2026-05-25-loom-v0.3.3-context.md) — Ravenwise test-bed findings + specialist-invocation discipline
9. [`adr/0037-retrieval-pipeline-evidence-review.md`](../adr/0037-retrieval-pipeline-evidence-review.md) — RAG research arc + LR-06 token-cost awareness
10. [`constitution/local-rules.md`](../constitution/local-rules.md) — all 6 LRs

---

*Frozen snapshot 2026-06-04. Loom is at v0.3.4 on main + 4 observatory PRs in cascade (#40–#43). L9 Observatory shipped as zero-dep dashboard. 41 ADRs, 6 LRs, 10 layers, 19 agents.*
