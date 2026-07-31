---
date: 2026-07-18
agent: session (Opus 4.8, 1M)
severity: low
share: true
upstream: loom-template
---

# The Observatory showed an "old" dashboard: local checkout was ~15 commits behind `origin/main`, and the "new" redesign was a mockup

## What happened

While standing up a new project on top of the template, we started the L9 Observatory (`node observatory/server.mjs`, `localhost:4040`) for live visibility. The dashboard rendered fine, but the architect noticed it was an **older UI** than "the new dashboard committed to the repo yesterday."

Diagnosis found **two independent causes stacked**, and only separating them made the picture clear:

1. **Local checkout was behind `origin/main`.** Local `HEAD` *and* the (stale) local `origin/main` ref were both `b9fc882`; the *actual* `origin/main` was `154196e` — ~15 commits ahead, including real Observatory UI work the local repo had never `git fetch`ed (e.g. `ce0f9d6` "Reputation panel + cold-start status card", the Deliberation panel, efficacy-harness merges #81/#83). The server serves `observatory/public/` from the local working tree, so it rendered the older UI. Confirmed: `observatory/public/index.html` and `js/app.mjs` differ between the local tree and a fresh `origin/main` clone.
2. **The "L9 UX redesign" commit (`154196e`, 2026-07-17) was a mockup, not an implementation.** It touched only 4 docs files — `docs/proposals/observatory-redesign/mockup.html` (a static comp), a README, a handoff, and a lesson. Zero changes to `observatory/public/` or `server.mjs`. The redesign is *approved but unbuilt*; no running Observatory reflects it.

## Why it matters

"Is the new UI live?" is ambiguous and easy to get wrong. A redesign can exist as (a) a merged implementation, (b) a merged *mockup/proposal*, or (c) unmerged on a branch — and, orthogonally, **the process serving the UI may be running stale code from a checkout that never fetched.** Concluding "the dashboard is old/broken" without separating these chases the wrong fix: restarting the server when the real gap is `git fetch`, or trying to `git pull` a feature that was never implemented.

The Observatory is also a **long-lived, auto-started process**. Static assets (`public/*.html`, `*.mjs`) are read fresh per request (`router.mjs` → `serveStatic` does `fs.readFile` per request), **but server-side changes (`server.mjs`, `lib/aggregator.mjs`, `lib/router.mjs` — e.g. a new projection/panel) require a restart.** So even after a `git pull`, a new panel that needs an aggregator projection won't appear until the process is restarted.

## What we'd do differently

1. **Check origin freshness first** when a repo-state claim is in doubt: `git fetch` (or clone-and-compare), then `git log HEAD..origin/main --oneline`. The local `origin/*` ref is only as fresh as the last fetch.
2. **Separate "served file differs" from "was it implemented":** `diff` the served asset against `origin/main`, and read the commit `--stat` to see whether it touched `observatory/public|server.mjs` vs only `docs/*` (mockup).
3. **Treat the Observatory as restart-required on server-side updates.** Candidate hardening: a build-hash/commit banner in the dashboard header (or a `loom doctor` soft-check) that warns when the running server's commit ≠ the working-tree commit.
4. **Auto-start staleness is a recurring shape** — an always-on process silently serving old code after the repo advances. Kindred to the "half-bootstrapped project" silent-degradation class.

## Related

- `observatory/server.mjs` (long-lived process, `LOOM_PROJECT_ROOT` root); `observatory/lib/router.mjs` `serveStatic` (reads files fresh per request — static assets are not the staleness source, the checkout is)
- Redesign proposal (mockup, on `origin/main`, absent from local until fetched): `docs/proposals/observatory-redesign/mockup.html`
- Kindred silent-degradation / auto-start lesson: [2026-07-08-bootstrap-ps1-getdate-asutc-ps51](./2026-07-08-bootstrap-ps1-getdate-asutc-ps51.md)
