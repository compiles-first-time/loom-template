# Observatory (L9) redesign — approved mockup

`mockup.html` is the **approved, clickable design prototype** for the L9 Observatory redesign. It is a single self-contained HTML file (inline CSS + JS, no external requests, light + dark themes) — open it directly in a browser.

It is a **design reference, not production code**: the data is representative-but-real (real BR registers, the actual Kernel V6 + local rules, real ADRs), and nothing is wired to a backend — edits live only in the browser and reset on reload. The production build implements this design **proof-first**, one panel at a time.

- **Design + decisions + build plan:** [`handoff/2026-07-16-observatory-ux-redesign.md`](../../../handoff/2026-07-16-observatory-ux-redesign.md)
- **Lesson from the cycle:** [`lessons-learned/2026-07-16-mockup-first-adversarial-review.md`](../../../lessons-learned/2026-07-16-mockup-first-adversarial-review.md)

## What it demonstrates

Progressive disclosure (operator Overview → architect drill-down drawers), the **run/execution** as the spine, written-out requirements with an honest re-run flow, a Constitution viewer wired to the Governance log, decision provenance, and an editable **Models & Budget** panel (task→model routing, per-model caps → fallback, and durable-execution checkpoint/resume) — the one panel that writes back to real config in the production build.

## Encoding note

The file is intentionally **pure ASCII** (typographic characters are numeric HTML entities) so it renders correctly regardless of how it is served. Keep it that way when editing.
