---
id: audit-l8-spec-mirror-missing-c3d03
source: internal-audit
proposed_by: critic-monthly-audit
date: 2026-08-04
affects: [spec/loom-spec-v0.1-full.md, layers/L8-discovery.md]
risk: low
collapse_risk: false
source_tier: "internal"
---

# L8 discovery content was never mirrored into the full spec (promised "when v0.5 closes")

## Proposed change
Mirror layers/L8-discovery.md's substantive content into spec/loom-spec-v0.1-full.md §B.9, or amend the promise if the spec's structure has moved on.

## Motivation
Audit finding 5: v0.5 closed long ago (project at v1.0.0); the spec has zero hits for §B.9/Discovery. `[internal-audit][80-95%]`

## Affected files
- spec/loom-spec-v0.1-full.md

## Critic review

## Human Replica recommendation

## User decision

verdict: approve
decided_by: Nick Noel
decided_at: 2026-08-04
note: Retired the mirror promise: layers/ is the canonical spec-as-codebase surface; monolith B.9 mirror not required.