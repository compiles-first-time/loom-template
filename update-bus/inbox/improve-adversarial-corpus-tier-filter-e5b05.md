---
id: improve-adversarial-corpus-tier-filter-e5b05
source: internal-audit
proposed_by: critic-monthly-audit
date: 2026-08-04
affects: [observability/eval-suite/requirements/, update-bus/feeds.yaml, .claude/agents/research-scout.md]
risk: medium
collapse_risk: true
source_tier: "internal"
---

# Evaluate: seeded adversarial corpus for the research-scout tier filter (extends BR_13)

## Proposed change
Build a labeled hostile-feed corpus (prompt injection in abstracts, Rejected-tier dressed as Tier-2, fabricated benchmarks) and measure the scout/tier-filter catch rate with the proven BR_13 governed-vs-ungoverned harness pattern. Evaluate-framed.

## Motivation
Audit ranked this the highest-leverage improvement candidate: the harness machinery exists and is proven (it found the curl|sh gap pre-launch), and the timing window is exactly now — ADR-0057 merged but the weekly trigger unarmed. Grounding: OWASP LLM Top-10 (in-repo, normative) + NIST AI RMF Measure function (needs primary-source pull before Accept). `[internal-audit][60-80%]` collapse_risk: true (touches eval/governance).

## Affected files
- observability/eval-suite/requirements/ (new BR register)

## Critic review

## Human Replica recommendation

## User decision
