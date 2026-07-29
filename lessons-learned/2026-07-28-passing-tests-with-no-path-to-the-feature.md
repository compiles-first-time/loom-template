---
id: 2026-07-28-passing-tests-with-no-path-to-the-feature
title: A feature with passing tests and no path to it is not shipped
domain: [process, testing, dx]
stack: [loom]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: IDEA
  sources: [IDEA]
  confidence: 0.95
created: 2026-07-28
updated: 2026-07-28
embedding_hash: null
---
# A feature with passing tests and no path to it is not shipped

## What happened

Four features in IDEA were built, tested, and closed as done. All four were
**unreachable by a user**. They were found the only way they could be — by the
architect using the product and reporting that it did not work.

| Feature | Tests | Reachable |
|---|---|---|
| Observatory dashboard, projects page, settings | pass | **No** — nothing linked to them; URL-only |
| Conversation store (append-only, redacted, SHA-pinned) | pass | **No** — `/api/chat` never calls it |
| Conversation picker component | pass | **No** — never rendered |
| Local-model discovery + endpoint probe | pass | **No** — no UI calls the route |

Each had its own story, its own tests, and its own green run. The suite was at
581 passing while a user could not save a conversation, could not reach the
dashboard, and could not see a local model.

## Why it happened

**"Done" was measured against the library, not against the user.** Every story
asked "does this function behave correctly", which is a real question and the
wrong one to stop at. None asked "can a person get to this".

Three properties made it invisible:

1. **Unit tests cannot see a missing wire.** A store with perfect append
   semantics passes identically whether or not anything calls it. The absence of
   a caller is not a failing assertion; it is no assertion at all.
2. **Every story was closable in isolation.** The wiring belonged to no story,
   so it was nobody's definition of done — the classic seam defect, where the
   gap falls between two correct pieces.
3. **The demo path was never walked.** Each feature was verified through its
   test or its route directly, never by opening the app and looking for it.

## The missed requirements, in register terms

Written the way [ADR-0022](../adr/0022-xlsx-docs-convention.md) would have caught
them. Each is a `BE` that no one enumerated because the requirement stopped at
"the store works":

| ID | Type | Condition | Should have been |
|---|---|---|---|
| `BE` | Business Exception | A page exists but nothing links to it | Every route reachable from the app shell, or deliberately marked internal |
| `BE` | Business Exception | A persistence layer exists but no caller | The write path is exercised end to end, not just the writer |
| `BE` | Business Exception | A component exists but is never rendered | An unrendered component is dead code until proven otherwise |
| `SE` | System Exception | A save fails after retries | Surfaced in the UI, not only the server log |

The last one is the sharpest: the store already threw *"the turn was not saved"*
after retries, and no UI existed to display it. A correct error message with no
consumer is the same as no error message.

## What we'd do differently (recommendations for loom-template)

- **Add a reachability check to the definition of done.** For any user-facing
  capability: name the click path from the app's entry point. If the path is
  "type the URL", it is not shipped. Cheap enough to be a checklist line.
- **A story that adds a `lib/` module must name its caller.** Not build it
  necessarily — name it, and if there is not one yet, say which story adds it.
  Seams need an owner or they fall through.
- **Walk the demo path before closing a story.** Open the app as a user and do
  the thing. Most of these would have died in thirty seconds.
- **In the register, enumerate "exists but unreachable" as a standing `BE`** for
  any requirement whose solution adds a UI surface or a persistence layer.

## Related

- [`2026-07-28-event-schema-drift-and-unknown-as-zero.md`](./2026-07-28-event-schema-drift-and-unknown-as-zero.md) —
  same family: a counter that worked perfectly and was displayed nowhere
- [ADR-0046](../adr/0046-requirements-exceptions-testcase-registry.md) — a row
  with no actual is `pending`, never `pass`
