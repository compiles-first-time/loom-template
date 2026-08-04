---
id: 2026-08-04-tests-must-never-write-live-project-memory
title: Tests and harnesses must never write to live project memory — the class, not the instance
domain: [testing, observability, governance]
stack: [loom, node]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: loom-template (first monthly internal audit, 2026-08-04)
  sources: [internal audit finding 8, PR #87 synthetic-event scrub, PR #89 ticket-seeder removal]
  confidence: 0.95
created: 2026-08-04
updated: 2026-08-04
embedding_hash: null
---
# Tests and harnesses must never write to live project memory

## What happened

The same failure class occurred **twice in two days** before anyone named it as a class: (1) ~746 synthetic test-session events (`live-test-*`, `test-run-*`, `smoke-test-*`) polluted `memory/event-log/`, feeding fake reputation rows into the Observatory (scrubbed, PR #87); (2) one day later, `scripts/lib/ticket.test.mjs` was found re-seeding 12 roadmap tickets into the live event log **on every `npm test` run**, clobbering legitimate board transitions and capable of resurrecting human-deleted tickets (removed, PR #89). Each instance was fixed individually; the first monthly internal audit flagged that no lesson generalized the pattern — so a third instance would have needed another audit to notice.

## Why it happened

Test code and live memory share one write API (`appendEvent`, `emitTicket`) and one location (`memory/event-log/`). Nothing structural distinguishes "a test exercising the emitter" from "a session recording reality," so the default failure mode is silent contamination of the audit trail — the exact resource Rule 22 depends on.

## What we'd do differently — the rule

**Tests, harnesses, seeds, and demos must not write to `memory/`, `orchestration/`, `update-bus/`, or any other live project state.** Concretely:
- A test that exercises an emitter asserts on its **return value or a temp path**, never on the real log (see `scripts/test.mjs`'s `CLAUDE_SESSION_ID`-guarded synthesis for the one sanctioned exception, which tags itself).
- Anything that "populates a panel for demo purposes" is sample data — Loom removed the sample-data class deliberately (PR #87); do not reintroduce it via tests.
- Review tell: an import of `appendEvent`/`emitTicket`/`mechanicalRecord` inside a `*.test.mjs` or seed script is a red flag unless it targets a temp dir.
- If a third instance appears, this lesson's existence means the auto-suggest/dedup machinery should catch it — cite this file in the fix.
