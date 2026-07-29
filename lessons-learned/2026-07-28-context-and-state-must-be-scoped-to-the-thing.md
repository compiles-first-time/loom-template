---
id: 2026-07-28-context-and-state-must-be-scoped-to-the-thing
title: If the user picked a project, everything after must be scoped to it
domain: [process, ux, architecture]
stack: [loom]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: IDEA
  sources: [IDEA]
  confidence: 0.9
created: 2026-07-28
updated: 2026-07-28
embedding_hash: null
---
# If the user picked a project, everything after must be scoped to it

## What happened

Two failures, one cause, both found in the first minutes of real use.

**1. Opening a project gave the model nothing.** The architect opened
`loom-template` and asked about its files. The assistant replied:

> I don't have any context about your specific project, codebase, or system
> architecture. I don't have access to your files… could you share relevant
> files?

It was correct to say so — no file had been attached. But the user had *just
selected the project*. From their side they had already answered "which
codebase"; the system asked again in the least useful way, by pretending not to
know.

**2. Switching projects kept the previous conversation.** Open project A, chat,
switch to project B — the same chat is still there. Nothing rebound to B.

## Why it happened

**Project selection was treated as navigation, not as scope.** Picking a project
changed which page you were on; it did not change what the chat *was about*. So
the chat had no project, and having no project it had no files, no history, and
nothing to rebind when the project changed.

The deeper error is that "the active project" existed in the user's head and in
the URL, but was never a parameter of the thing they were using. Any state that
is not scoped to the entity it belongs to will eventually be shown against the
wrong one — the only question is when.

Worth separating from the "unreachable feature" failure: that one was a missing
wire between two correct pieces. This one is a **missing dimension** — the state
was correct and complete for a world with one project.

## The missed requirements, in register terms

| ID | Type | Condition | Should have been |
|---|---|---|---|
| `BE` | Business Exception | A project is open and the model is asked about it, with nothing attached | Repo context is offered or attached by default — selection is the answer to "which codebase" |
| `BE` | Business Exception | The user switches projects mid-conversation | The conversation rebinds, or is explicitly carried with a visible notice. Silently keeping it is the one wrong answer |
| `BE` | Business Exception | The user returns to a project they used earlier | Prior conversations for *that* project are listed |
| `TR` | Technical Requirement | Conversations need somewhere to live per project | A store initialised on first write — not assumed to exist in the template |

The fourth is the one that would have been missed even by a careful reviewer:
the template does not ship a conversations directory, so a per-project store has
to be **created on first use**. A design that assumes the directory exists fails
on every newly created project — the exact case the feature is for.

## What we'd do differently (recommendations for loom-template)

- **When a design introduces a selectable entity (project, environment, tenant),
  enumerate every piece of state that must now carry it** — and write the
  switching case as an explicit exception row. Switching is where scope bugs
  live; nobody tests it because nothing "fails".
- **Selection is an answer. Do not ask again.** If the user chose a project,
  downstream steps start from it rather than from empty.
- **A per-entity store must define its initialisation.** "The directory will be
  there" is an assumption that is false exactly once per new entity, which is
  the moment it matters.
- **Prefer scoping state at the seam it is created**, not at the point it is
  displayed. Scoping at display means every future reader must remember to.

## Related

- [`2026-07-28-passing-tests-with-no-path-to-the-feature.md`](./2026-07-28-passing-tests-with-no-path-to-the-feature.md) —
  found in the same session, the same way: by using the product
