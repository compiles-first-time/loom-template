---
id: improve-nist-owasp-coverage-mapping-f6a06
source: internal-audit
proposed_by: critic-monthly-audit
date: 2026-08-04
affects: [observability/eval-suite/critic-checklists/security.md, observability/eval-suite/critic-checklists/compliance.md]
risk: low
collapse_risk: false
source_tier: "internal"
---

# Evaluate: NIST AI RMF + OWASP LLM Top-10 coverage mapping (third-party checklist audit)

## Proposed change
Produce a coverage matrix of Loom's controls against NIST AI RMF and the OWASP LLM Top-10; every unmet control becomes a candidate ADR. The checklist being externally authored is the point — it finds the blind-spot class self-reflection cannot.

## Motivation
Audit ranked #2 by leverage/effort: cheap cross-referencing exercise, feeds existing (idle) critic checklists, derisks ADR-0054's named Phase-3 security review. Requires pulling and tiering the primary sources per ADR-0009 before Accept. `[internal-audit][60-80%]`

## Affected files
- observability/eval-suite/critic-checklists/

## Critic review

## Human Replica recommendation

## User decision
