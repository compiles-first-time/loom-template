---
id: 2026-07-28-event-schema-drift-and-unknown-as-zero
title: Event-schema drift is silent, and "unmeasured" must never render as zero
domain: [observability, process]
stack: [loom, observatory]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: IDEA
  sources: [IDEA, ADR-0040, ADR-0046]
  confidence: 0.95
created: 2026-07-28
updated: 2026-07-28
embedding_hash: null
---
# Event-schema drift is silent, and "unmeasured" must never render as zero

## What happened

IDEA projects each project's `memory/event-log/` into a dashboard. Measured
against 10,015 real events across five local Loom projects, **244 were being
dropped** — eleven event types the hooks genuinely emit that were missing from
the reader's known-type list.

They were the wrong 244. **Every event carrying a `rule` field was in the dropped
set**: 156 rule attributions (`LR-04` × 111, `ADR-0047` × 45). The single richest
governance signal in the log — which rule governed which decision — was being
received and discarded.

Dropped types included `destructive_actions_attempted`,
`destructive_action_decision`, `production_mutation_attempted`,
`credentials_attempted`, `external_service_setup_attempted`,
`browser_credential_automation_attempted`, and `claim`. Compliance and
permissions events, precisely.

The reader was not broken. It counted unknown types in an `unknownEventTypes`
map, exactly as designed. **The count was never displayed**, so no one looked.

Separately: no event anywhere carries a cost figure. `estimated_usd` and
`cost_usd` appear **zero times** in 10,015 events. Token counts exist on
`session_token_usage` only. A dashboard that renders derived cost naively would
show `$0.00` for every unmeasured node — indistinguishable from a step that was
genuinely free.

## Why it happened

**Drift is asymmetric and silent.** The emitter (hooks in the project) and the
reader (the projection) are in different repos on different release cadences.
Adding an event type to the emitter is a one-line change that breaks nothing —
the reader keeps working, keeps rendering, and keeps looking correct. There is no
failing test on either side, because neither side is wrong on its own.

The safety valve existed (`unknownEventTypes`) and was inert, because a counter
nobody surfaces is equivalent to no counter. **The failure was not missing
instrumentation; it was instrumentation with no consumer.**

## What we'd do differently (recommendations for loom-template)

- **Publish the emitted event-type list as a checked artifact**, and have readers
  assert against it. A test that fails when the hooks emit a type the aggregator
  does not handle turns a silent drift into a red build.
- **Surface the unknown count in the UI, not just in the state.** A rising
  unknown count is the drift alarm. If it is not on screen, it does not exist.
- **Never let unmeasured render as zero.** `$0.00`, `0 errors`, and `no rule` all
  read as *"we checked and there is nothing"* when they mean *"we did not
  check."* Use an explicit unknown, and make it visually distinct from a real
  zero. This is the same discipline ADR-0046 already applies by requiring a row
  with no actual to be `pending`, never `pass`.
- **Prefer deriving over logging for values that drift.** Cost is better computed
  from tokens against a rate table than written into the log: rate tables get
  corrected, and a derived figure improves retroactively while a logged one is
  wrong forever.
- **When adopting an existing log format, measure it before designing over it.**
  Reading the schema would have suggested cost was present. Counting 10,015 real
  events proved it was not.

## Related

- [ADR-0040](../adr/0040-observatory-projection-schemas.md) — projection schemas; additive-only
- [ADR-0046](../adr/0046-requirements-exceptions-testcase-registry.md) — `pending` ≠ `pass`, the same principle for test cases
