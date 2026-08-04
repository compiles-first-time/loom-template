---
id: audit-task-ledger-wiring-never-built-b2e02
source: internal-audit
proposed_by: critic-monthly-audit
date: 2026-08-04
affects: [orchestration/task-ledger.md, layers/L5-orchestration.md]
risk: low
collapse_risk: false
source_tier: "internal"
---

# Task-Ledger dispatch/completion wiring (v0.2 PR-2 promise) — build or formally retire

## Proposed change
Either wire subagent dispatch/completion updates into orchestration/task-ledger.md as v0.2 promised, or formally retire the promise (amend L5 to name hr-work-graph/ADR-0029 as the successor and mark the ledger historical).

## Motivation
Audit finding 4: the ledger has sat at "(none yet)" through weeks of real subagent usage; the doc was never reconciled with the ADR-0029 successor mechanism. Doc-truth violation either way. `[internal-audit][80-95%]`

## Affected files
- orchestration/task-ledger.md
- layers/L5-orchestration.md

## Critic review

## Human Replica recommendation

## User decision

verdict: approve
decided_by: Nick Noel
decided_at: 2026-08-04
note: Formally retired: superseded by ADR-0029 work-graph regeneration; L5 + task-ledger docs reconciled.