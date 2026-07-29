---
id: 2026-07-28-read-the-decision-record-before-designing
title: Read the ADRs before designing — rediscovery is indistinguishable from progress
domain: [process, governance]
stack: [loom]
platform: [win32, linux, darwin]
severity: high
share: true
supersedes: null
provenance:
  origin_project: IDEA
  sources: [IDEA, ADR-0022, ADR-0046, ADR-0053, ADR-0056]
  confidence: 0.95
created: 2026-07-28
updated: 2026-07-28
embedding_hash: null
---
# Read the ADRs before designing — rediscovery is indistinguishable from progress

## What happened

While building IDEA, the architect described a requirements-and-exceptions format
and asked for it to be captured. Over two commits an architecture doc and five
stories were written: a three-tier requirement/solution/exception model, an SE/BE
split, a twelve-field schema, a requirements-to-test-case link, and a
requirements-elicitation agent.

All of it already existed in `loom-template`:

| Produced | Already decided |
|---|---|
| Three-tier register + SE/BE + 12 fields | **ADR-0022** (2026-05-20) — from the *same* source spreadsheet |
| Requirements → exceptions → test cases | **ADR-0046** (2026-07-05) |
| A trio of agents challenging each other | **ADR-0056** (2026-07-15) — which had already *rejected* that shape |
| Reward for agent effort | **ADR-0053** — which had already rejected effort as the metric |

Worse than duplicated: **subtly wrong.** The invented schema used `why` where
ADR-0022 had renamed the column to `Justifications` at the architect's request,
and it missed `TR` (Technical Requirement) entirely — inventing an ad-hoc
`technical:` block for exactly what `TR` rows already model. A downstream reader
would have parsed the wrong format.

A further pass found `.claude/commands/testcase.md` already implemented, and nine
`BR_NN` registers already authored.

## Why it happened

The work *felt* like progress the entire time. Every artifact was well-formed,
traced to a requirement, and defensible on its own. Nothing failed. No test broke.
The only signal that anything was wrong was absent context — and absence produces
no error.

Three specific causes:

1. **The source material was re-derived instead of looked up.** The spreadsheet
   was read carefully and a format was inferred from it. That format had already
   been inferred, ratified, and *amended by the architect* fifteen months of
   decisions ago. Reading the primary source is not a substitute for reading the
   decision about it.
2. **"Does this exist?" was never asked mechanically.** A single
   `ls adr/ | grep -i requirement` would have surfaced ADR-0046 in seconds. The
   question was skipped because the work felt novel.
3. **Confidence came from the artifact's quality, not from its novelty.** A
   well-written duplicate reads exactly like a well-written original.

## What we'd do differently (recommendations for loom-template)

- **Before writing any design artifact, grep the decision record.** `adr/`,
  `.claude/commands/`, `agents/`, and the relevant register directory. Cheap,
  seconds, and the only reliable defense — the failure mode produces no error to
  notice.
- **Treat "the user described a new idea" as weak evidence that it is new.**
  Architects re-raise things they decided months ago; that is normal, not a
  signal. The decision record is the authority on what exists, not the memory of
  whoever is in the conversation — including the human's.
- **When a design is derived from a primary source (a spreadsheet, a paper, a
  transcript), search for prior decisions *about that source* by name.** ADR-0022
  cites the Credit Validation spreadsheet explicitly. Searching for it would have
  landed directly on the answer.
- **Prefer reconciling to superseding.** Once the duplication was found, the
  correct move was to rewrite the new artifacts to *point at* the existing ADRs,
  not to keep both and let a reader pick.

## Related

- [ADR-0022](../adr/0022-xlsx-docs-convention.md) — the register format
- [ADR-0046](../adr/0046-requirements-exceptions-testcase-registry.md) — the test-case registry
- [`2026-07-10-discovery-must-be-authored-not-stamped.md`](./2026-07-10-discovery-must-be-authored-not-stamped.md) — same family: the artifact existing is not the artifact being real
