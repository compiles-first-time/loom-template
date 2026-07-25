---
id: 2026-07-20-port-mockup-to-live-adapter
title: Port an approved mockup to a live client by keeping render code verbatim + a data adapter with honest live/sample badging
domain: [observability, design, process]
stack: [loom, html, css, js]
platform: [win32, linux, darwin]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: loom-template
  sources: [loom-template, ADR-0039, ADR-0040, ADR-0046, ADR-0053]
  confidence: 0.85
created: 2026-07-20
updated: 2026-07-20
embedding_hash: null
---
# Port an approved mockup to a live client by keeping render code verbatim + a data adapter with honest live/sample badging

Follow-on to [[2026-07-16-mockup-first-adversarial-review]]: the approved Observatory-redesign mockup
was only ever a design prototype — the live `observatory/public/` was never rebuilt, so another machine
running the template still generated the *old* dashboard. This cycle ported the mockup into the live client.

## What worked

- **Split, then keep the render code verbatim; touch only the data layer.** A script split the
  self-contained mockup into `index.html` / `css/observatory.css` / `js/app.mjs`. In `app.mjs` we changed
  *only*: (1) `const`→`let` for the eight data vars we feed with real data, (2) a `deriveViewModel(state)`
  adapter appended at the bottom, (3) the SSE/`/api/state` bootstrap, (4) a dynamic banner + per-panel
  badge. Every render function, drawer, and interaction is byte-for-byte the approved design. Minimal-diff
  = low risk, exact fidelity. Result: the design shipped exactly as approved, bigger font, 481/481 tests green.
- **Honest live/sample model (Rule 22).** Each panel derives from the real aggregator slice when it has
  data, else falls back to the mockup's representative sample — and is **badged live or sample** so
  representative data is never shown as real. A fresh clone shows the beautiful populated sample (every
  panel badged *sample*); the template's own dogfooded repo shows real data (Requirements, Agents,
  Decisions, Work, Cost, Activity all *live*). Nothing fake is ever labelled real.
- **Ground the adapter in the real state shape first.** Read `aggregator.mjs` + `reputation.mjs` for the
  exact field names (`verifier_pass`, `smoothed_pass_rate`, `by_requirement` rollup, `activity.feed`
  item shape, `deliberations.decisions`, …) *before* writing mappings — no guessing, no silent nulls.
- **Verify against real data, not just empty states.** Playwright against the live server exercised the
  template's own event log (92 requirement cases → 14 BRs, 4 reputation agents, 17 tickets, 2 decisions,
  300 activity events), so the live path was actually exercised — that's how the duplication bug below surfaced.

## What did not work (caught in verification)

- **Sample-presentation tricks become bugs once the data is real.** The mockup padded its Activity feed
  to look fuller: `FEED.concat(FEED.map(f => ({...f, time:f.time+'0'})))`. Wired to live data that
  **double-rendered every real event** (80 rows for 40 events). **Grep the render code for sample-padding /
  duplication before wiring live data.**
- **Going live surfaces instrumentation gaps honestly.** Cost-by-model shows `unknown` because
  `loop_cost_summary` carries no per-model field. Real, not hidden — a Phase-B instrumentation item.
- **Don't mistake reconnect-backoff logs for a defect.** EventSource flooded the console with
  `ERR_CONNECTION_REFUSED` when the page loaded during the server-startup window and across dev reloads.
  The endpoint was healthy the whole time (`200` + `text/event-stream` + `keep-alive`, `state_init`
  delivered). Verify the endpoint directly rather than trusting cumulative console noise; in normal use the
  server is up first and the stream holds.
- **`color-mix()` / `text-wrap` lint warnings are fine** on current browsers — verbatim from the approved
  mockup CSS; not worth diverging from the approved design to silence a linter.

## How to apply

For any approved self-contained mockup → live port: **keep render code verbatim, add a `deriveViewModel`
adapter + per-panel live/sample badge, ground the adapter in the real state shape, verify against real
data, and grep the render for sample-padding before wiring.** Panels with no real source yet stay sample
+ badged (here: Runs, Models & Budget, Constitution citation-counts) until instrumented.
