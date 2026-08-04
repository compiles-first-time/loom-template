---
id: 2026-08-04-capability-claims-must-move-with-the-feature
title: When a feature changes, every layer of capability memory must change in the same PR — docs, layer files, AND assistant memory
domain: [dx, governance, memory]
stack: [loom, claude-code]
platform: [win32, linux, darwin]
severity: medium
share: true
supersedes: null
provenance:
  origin_project: loom-template (architect observation, 2026-08-04)
  sources: [architect direction 2026-08-04, layers/L9-observatory.md, CLAUDE.md layer map]
  confidence: 0.95
created: 2026-08-04
updated: 2026-08-04
embedding_hash: null
---
# Capability claims must move with the feature

## What happened

The pre-redesign Observatory had an Update Bus panel. The redesign (PR #85 → live-or-empty PR #87) rebuilt the client without it — the backend integration survived (aggregator inbox tracking + the ADR-0041 decision endpoint), the panel did not. Nobody updated the capability claims: `layers/L9-observatory.md` still lists "Update Bus" among shipped panels, `CLAUDE.md`'s layer map still says "reviewing Update Bus proposals," and the assistant's persistent session memory still described the panel. Result: the architect was told to look for a panel that does not exist ("visible on the Observatory's Update Bus panel") and could not find it.

## Why it happened

Capability truth lives in **at least three layers** — repo docs (layers/, CLAUDE.md, READMEs), decision records (ADRs), and **assistant session memory** — and a feature change only edited the code. Doc-vs-runtime drift was already a named audit class; this instance shows the class extends to memory *outside* the repo: an assistant that "remembers" a capability will keep asserting it long after the code moved on, and no in-repo check can see that memory.

## What we'd do differently — the rule

**A PR that adds, removes, or reshapes a user-facing capability must update every layer that claims the capability, in the same change:**
1. The layer doc (L0–L9) that lists the feature.
2. CLAUDE.md if its index/one-liners reference it.
3. The assistant's persistent memory for the project — updating it is part of the definition of done, not an afterthought.
4. Where a capability is *removed but its backend remains* (this case), say so explicitly — "backend integration real, no UI surface" — because half-true claims are the hardest drift to catch.

Review tell for the Critic: a diff that deletes or renames a view/panel/command with **no matching diff** in layers/, CLAUDE.md, or a memory-update note is incomplete. The monthly internal audit's doc-vs-runtime spot check should include one capability-claim probe ("pick a doc'd feature; click it").
