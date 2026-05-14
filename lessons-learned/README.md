# Lessons-Learned

> Append-only record of failures and their resolutions. One file per lesson.

---

## Why this directory exists

Per [§D.5 of the spec](../spec/loom-spec-v0.1-full.md), every Loom project keeps an exception registry. Failures here are first-class — they're the input to the Update Bus, the EAC's research, and the Critic's monthly audits.

## File naming

```
YYYY-MM-DD-<short-kebab-case>.md
```

Example: `2026-05-14-figma-rate-limit-workaround.md`

## File format

```markdown
---
date: YYYY-MM-DD
agent: <who hit it>
severity: low | medium | high | critical
share: false  # set true to propose for cross-project propagation
---

# <Short title>

## What happened
<concise description of the failure>

## Why it happened
<root cause; don't blame, diagnose>

## What we did
<the workaround, fix, or escalation>

## What we'd do differently
<the lesson — the heuristic future agents should apply>

## Related
<links to ADRs, event log entries, code changes>
```

## Cross-project propagation

If `share: true`, the lesson is automatically proposed to the Update Bus inbox for other Loom projects. The Critic and Human Replica review before propagation.

## Retention

Never delete. If a lesson is superseded by a better understanding, write a new lesson that links back, but do not edit the original.
