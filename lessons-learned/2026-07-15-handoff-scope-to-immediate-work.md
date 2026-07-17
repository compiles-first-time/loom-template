---
id: 2026-07-15-handoff-scope-to-immediate-work
title: Handoff/bootstrap prompts must be scoped to the immediate work — bundling "related" repos/context adds friction
domain: [auth, process]
stack: [loom]
platform: [win32, linux, darwin]
severity: low
share: true
supersedes: null
provenance:
  origin_project: loom-template
  sources: [loom-template, ADR-0053, ADR-0004, ADR-0031]
  confidence: 0.85
created: 2026-07-15
updated: 2026-07-15
embedding_hash: null
---
# Handoff/bootstrap prompts must be scoped to the immediate work — bundling "related" repos/context adds friction

## What happened

Authoring the handoff for a high-cap account, the bootstrap prompt told the new session to `git clone` **both** `loom-template` and `process-cartographer`. But the priority work (items 1–4: deliberation panel, Phase-1b checks, lessons-service, ADR-0053 projection) is **entirely in loom-template**, and the useful artifacts process-cartographer had produced (its 3 upstream lessons + the lessons-service proposal) were **already upstreamed into loom-template** (PR #76). process-cartographer was only needed for its *own* lower-priority M3/M4 build (item 5).

The architect caught it: *"wait why do we need process-cartographer?"* Cloning it up front was pure setup friction — a second repo, extra auth/deps on a fresh machine — for work that never touches it.

## Why it matters

A handoff's job is to make the next session productive **fast**. Bundling context or repos "for completeness" or "because it's related" works against that: it front-loads setup the immediate work doesn't need and can make the session think the extra repo is a prerequisite to start. It's the same over-inclusion the context-budget discipline ([ADR-0004](../adr/0004-context-budget.md)) guards against — load what the *task* needs, not everything related.

Worse (the deeper miss): we **fixed the handoff without capturing the lesson**. Fixing a symptom while leaving the recurring tendency unrecorded is exactly what lets it recur — the failure mode the lessons-learned registry exists to break.

## What we did

Corrected the handoff (PR #79): clone loom-template only for the priority work; clone process-cartographer **only** for item 5; noted its artifacts are already upstreamed. Then wrote this lesson.

## What we'd do differently

When authoring a handoff or bootstrap prompt:
1. **Scope STEP-0 setup to exactly what the *priority* items require.** Ask "does the first task actually touch this repo/file?" before adding any clone/read step.
2. **List auxiliary repos/inputs as explicitly OPTIONAL/deferred**, tied to the specific later item that needs them — never as an up-front requirement.
3. **When you fix a process slip, capture the lesson in the same breath** — the fix and the lesson-learned entry are one action, not two.

## Related

- [ADR-0004](../adr/0004-context-budget.md) — context budget (load what's needed, not everything related)
- [ADR-0031](../adr/0031-handoff-maintenance-policy.md) — handoff maintenance policy
- `handoff/2026-07-15-deliberation-panel-and-research-findings.md` — the corrected handoff
