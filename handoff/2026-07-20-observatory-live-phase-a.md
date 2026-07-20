# Handoff — Observatory redesign is LIVE (Phase A shipped); Phase B/C next

> **Date:** 2026-07-20 · **Branch:** `observatory-live-redesign` · **Status:** Phase A **done + verified**, PR open (Nick merges).
> **Supersedes context in:** [`handoff/2026-07-16-observatory-ux-redesign.md`](2026-07-16-observatory-ux-redesign.md) (the design spec). The design there is now **built and live**, not just a mockup.
> **Lesson from this cycle:** [`lessons-learned/2026-07-20-port-mockup-to-live-adapter.md`](../lessons-learned/2026-07-20-port-mockup-to-live-adapter.md).

## Why this mattered

The approved redesign was only ever a mockup (`docs/proposals/observatory-redesign/mockup.html`). The
live `observatory/public/` was never rebuilt — so another machine running the template still generated the
**old** dashboard. Phase A makes the approved redesign the actual live client.

## What shipped (Phase A) — 3 files, tests green

Ported the mockup **verbatim** into the live client, wired to the real `/api/state` + SSE, bigger font.

- **`observatory/public/index.html`** — new shell: the mockup's topbar/nav/main/drawer + a live-status pill + the module script.
- **`observatory/public/css/observatory.css`** — the mockup's CSS + font bump (body 15.5→16.5px, tables 14→14.5px) + `.status-dot`.
- **`observatory/public/js/app.mjs`** — the mockup's render code **unchanged**, plus a `deriveViewModel(state)` adapter and the SSE/`/api/state` bootstrap (the `_header`/`_footer` were assembled around the split mockup script).

### The honest live/sample model (Rule 22)

Each panel derives from the real aggregator slice when it has data, else falls back to the mockup's
representative sample — and is **badged `live` or `sample`** in its header so nothing representative is ever
shown as real. Global banner reflects the same.

- **Live when the project has emitted it:** Requirements (`requirements.cases`→`by_requirement`), Agents
  (`reputation.agents` scores on faithful role metadata), Decisions (`deliberations.decisions`), Governance
  (`compliance.destructive_ops`), Cost (`cost.by_session` by model), Work (`kanban.tickets`), Activity (`activity.feed`).
- **Sample + badged (no real source yet):** Overview narrative/tiles, Runs, Models & Budget, Constitution
  citation-counts (rule *text* is real/faithful).

### Verified (Playwright, against the template's own dogfooded event log)

0 console errors; both themes clean; live path exercised with real data (92 cases→14 BRs all passing, 4
agents incl. `critic` 0.967 / `memory-keeper` 0.900, 17 tickets, 2 decisions, 300 activity events, drawers
open with real cases). `node scripts/test.mjs` → **481/481** across 23 files.

## Known gaps / honest scope (→ Phase B/C)

- **Cost-by-model shows `unknown`** — `loop_cost_summary` carries no per-model field (instrument in B).
- **Re-run buttons** on live requirement cases are the mockup's UI affordance, **not** wired to real test
  execution yet (a non-flaky case just shows "reproduced"). Wire or disable in B.
- **Project name / actor** in the topbar are still the mockup's literals (`loom-template` / `Nick Noel`) —
  make them read from config/state so each project's dashboard self-labels.
- **Pre-existing (NOT this PR):** `loom doctor` has one hard failure `mcp-yaml-json-alignment` between
  `.claude/settings.json` and `tools/mcp-servers/config.yaml` — inherited from `main`, unrelated to these
  3 frontend files. Fix separately with `node scripts/lib/mcp-yaml-to-settings.mjs`.

## Next

- **Phase B — instrument the missing signals:** per-model cost tagging; run/session grouping (there is no
  first-class `run_id`/execution yet — Runs stays sample until there is); agent-tagged tool calls or a
  documented limitation; claim/chain-of-thought capture for the node-drill-down viz.
- **Phase C — Insights viz** (the architect is a visual learner and wants this to tune instructions):
  start with the **feasible-now static system-structure network** (agents ↔ tools ↔ ADRs ↔ layers ↔ rules,
  parsed from `SKILL.md` `tools:` + ADR links + rule citations — needs no new instrumentation) and a
  **per-run/session trace timeline**; skip the chord diagram. Self-contained inline SVG/Canvas.
