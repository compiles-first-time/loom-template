---
id: audit-adr0008-admission-check-unwired-a1f01
source: internal-audit
proposed_by: critic-monthly-audit
date: 2026-08-04
affects: [scripts/lib/doctor.mjs, layers/L2-agents.md, adr/0008-context-admission-check.md]
risk: medium
collapse_risk: true
source_tier: "internal"
---

# Wire the ADR-0008 pre-dispatch context admission check (stale since v0.2)

## Proposed change
Operationalize the Critic's pre-dispatch context admission check — its stated responsibility #1 — in one of the two landing spots the docs promised (doctor glue or an observability hook). Currently zero code references it.

## Motivation
First monthly internal audit, finding 3: promised in layers/L2-agents.md ("orchestration glue lands in PR-5... or a later observability PR"); both landing spots have since matured; never built. `[internal-audit][80-95%]` collapse_risk: true — this touches the governance/eval layer.

## Affected files
- scripts/lib/doctor.mjs
- layers/L2-agents.md

## Critic review

## Human Replica recommendation

## User decision

verdict: approve
decided_by: Nick Noel
decided_at: 2026-08-04
note: Wired the mechanical floor (scripts/lib/admission-check.mjs, 20 tests) for all three ADR-0008 axes; distractor axis explicitly deferred to Critic judgment (no embedding index). ADR-0008/critic.md/L2 reference it.