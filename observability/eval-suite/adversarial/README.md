# Adversarial eval corpora

Labeled hostile-input corpora that measure Loom's filters the BR_13 way —
governed (protection on) vs ungoverned (off) — and, critically, **document
what each mechanical floor cannot catch** so "the filter passed" never silently
means "the floor is sufficient."

| Corpus | Filter under test | Floor (mechanical) | Judgment (agent) | Runner |
|---|---|---|---|---|
| [`tier-filter-corpus.mjs`](./tier-filter-corpus.mjs) | research-scout source-tier filter (L7/ADR-0007/0009) | `scripts/lib/source-tier-classifier.mjs` — obvious UGC/social/undated-anon rejects + recognized tier-1 | disguised hosts, injection-in-abstract, fabricated benchmarks (→ admission-check + scout ≥2-source cross-validation) | `scripts/lib/source-tier-classifier.test.mjs` |

Origin: inbox item `improve-adversarial-corpus-tier-filter-e5b05` (2026-08 internal audit, ranked the highest-leverage improvement). Extends the proven BR_13 harness pattern (`observability/eval-suite/requirements/BR_13.md`) from the destructive-op guard to the intake filter.

**Adding a corpus:** one file per filter; each entry carries `expected`, a `catch` class (`mechanical` | `judgment`), and a `note` naming the true catch stage for judgment cases. The test must assert both that the floor catches every mechanical case AND that it never false-decides a judgment case — over-reach is as much a failure as a miss.
