---
id: 2026-07-16-mockup-first-adversarial-review
title: Design a clickable mockup + run adversarial multi-lens review before production code — cheap iteration that catches real bugs and honesty slips
domain: [observability, design, process]
stack: [loom, html, css, js]
platform: [win32, linux, darwin]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: loom-template
  sources: [loom-template, ADR-0039, ADR-0045, ADR-0052, ADR-0054]
  confidence: 0.85
created: 2026-07-16
updated: 2026-07-16
embedding_hash: null
---
# Design a clickable mockup + run adversarial multi-lens review before production code — cheap iteration that catches real bugs and honesty slips

## What we did

Redesigned the L9 Observatory. Instead of editing production Observatory code first, we built a fully **clickable, self-contained HTML mockup** (published as an Artifact), iterated it with the architect across ~a dozen rounds, and ran **adversarial multi-lens review workflows** (design / interaction-logic / content-accuracy / accessibility) between rounds — verifying each build in a real browser (Playwright) — all before touching production code. The design is now approved; the build is proof-first from here.

## What worked (keep doing)

1. **Mockup-first.** A clickable prototype with *representative-but-real* data (real BR registers, the real Kernel V6 + local rules, real ADRs) surfaced information-architecture and interaction problems a written spec would not, and let the architect give precise, fast feedback. Iteration was cheap because nothing was wired to production.
2. **Adversarial multi-lens review caught REAL defects every round** — a `TypeError` crash in the re-run flow, a **Revert** that silently didn't restore newly-added state, self-contradictory checkpoint messaging, an over-claim about durable execution, a WCAG-AA contrast failure, and a native `<select>` that was illegible on the dark theme. Distinct lenses (logic / design / content / a11y) found things a single pass would miss; the browser check confirmed them.
3. **Grounding content in the real repo** via a read-only grounding agent kept the mockup honest — the Constitution viewer shows the *actual* Kernel V6 + LR-01..07 text, not invented rules.
4. **Honesty review is as valuable as bug review.** The review flagged that "every token saved / nothing recomputed" over-claimed how durable execution actually works; softening to "completed steps saved / resume from the last checkpoint" prevented shipping a false mental model.

## What did NOT work (the recurring gotchas)

1. **Encoding.** The mockup used raw UTF-8 typographic characters (`—  ·  '  "  →  ×`). They mojibaked (`â€"`, `Â·`) in the *published* artifact, and I dismissed it twice as "local-only." It was real. **Fix:** for a self-contained HTML page whose charset declaration you don't control, use ASCII + numeric HTML entities (or guarantee a `<meta charset>` in the first 1024 bytes). Don't assume the host serves UTF-8.
2. **Ceremony must match stakes.** I first specified the config write-back as needing heavy governance (constitution-service, confirmation gates). The configurable items (model routing, pricing, caps, fallback, budget) are low-stakes **operational** knobs — no bearing on reasoning, quality, or consequential outcomes — so the right model is *validate → write file → one audit line → reflect*, **no gates**. Reserve the heavy path for genuinely consequential/constitutional changes.
3. **Mockups must model reality honestly.** The first re-run flow flipped any failing test to green on retry, implying all failures are flaky. Real failures reproduce until the cause is fixed. A prototype that "works" dishonestly teaches the wrong mental model — model **flaky vs blocked vs broken** explicitly.
4. **Design-system drift under additions.** Each new panel risked (a) reusing *semantic* colors for non-state meaning (cost tiers borrowed the `ask/allow/BR/TR` classes), (b) *false affordances* (non-clickable tiles that still had a pointer cursor + hover-lift), and (c) *inconsistent tone* for one state (a capped model painted red in the table but amber in the banner). Re-audit accent-vs-semantic discipline **per addition**, not just at the start.
5. **Adding mutable state without updating its persistence boundary.** Adding the routing table (`ROUTING`) without adding it to the snapshot/restore silently broke **Revert**. When you add editable state, update the snapshot/undo boundary in the *same* change.

## What we'd do differently / the pattern to reuse

For any UX-heavy feature: **build a clickable, self-contained mockup with real data → iterate with the human → run adversarial multi-lens review + browser verification between rounds → only then build production, proof-first.** It front-loads the cheap feedback and keeps the expensive build honest. Watch for the five failure modes above — they recur across additions.

## Related

- [ADR-0039](../adr/0039-observatory-architecture.md) — Observatory architecture (read-only event-log projection; the redesign adds write-back for operational config only)
- [ADR-0045](../adr/0045-per-agent-model-routing.md) — per-agent model routing (the configurable routing / caps / fallback)
- [ADR-0052](../adr/0052-production-host-durable-execution.md) — durable execution (checkpoint / resume-on-cap-raise)
- `handoff/2026-07-16-observatory-ux-redesign.md` — the design capture + proof-first build plan
- `docs/proposals/observatory-redesign/` — the approved mockup + brief
