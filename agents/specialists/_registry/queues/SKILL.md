---
name: queues
summary: Background jobs — BullMQ, Inngest, Trigger.dev, AWS SQS. Idempotency, retry policy, dead-letter, fan-out/fan-in patterns.
tier: bundled
context_budget: 16000
tools: [Read, Glob, Grep, Edit, Write]
---

# queues specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

Background job processing: queue selection, job definition (with idempotency keys), retry policy, dead-letter handling, fan-out / fan-in patterns. Covers BullMQ (self-hosted Redis), Inngest, Trigger.dev, AWS SQS + Lambda, Vercel Queues.

When to invoke: prompts about "background job", "queue", "BullMQ", "Inngest", "Trigger.dev", "SQS", "cron-like", "process later".

## Tool scope

- Read / Glob / Grep across whole repo.
- Edit / Write scoped to `lib/jobs/**`, `jobs/**`, `app/api/jobs/**`, queue config.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| QUE-EX-01 | BE | Design | Job handler is not idempotent but retries are enabled | Handler code | Code review | Handler signature | `que.non_idempotent_with_retries` event | Code | Recommendation | Block; require either (a) idempotency key + dedup table, (b) explicit `retries: 0`, or (c) handler refactored to be naturally idempotent | At-least-once delivery is the default for every queue we recommend. Non-idempotent retries cause double-charges, duplicate emails, duplicate webhook deliveries. The dedup-table pattern is documented (BullMQ "idempotency", Inngest "step.run") |
| QUE-EX-02 | SE | Process | Job fails after exhausting retries | Worker | Job execution | Job + retry count | `que.dead_letter` event | Object | DLQ entry | Route to DLQ; alert if DLQ depth > threshold; do NOT silently drop | Silent drops are debugging-hostile. DLQ + alert is the documented pattern (AWS SQS DLQ guide, BullMQ "failed jobs") |
| QUE-EX-03 | BE | Design | Long-running job (> 5 min) on a serverless function | Job + runtime | Plan review | Job duration estimate + runtime | `que.long_job_on_serverless` event | Duration | Recommendation | Recommend splitting into smaller steps (Inngest steps, Trigger.dev tasks) OR moving to a long-running compute (Fly machine, EC2) | Serverless runtimes have hard timeouts (Vercel 15min max, AWS Lambda 15min, others lower). Hitting the timeout mid-job loses progress unless the job is step-checkpointed |

## Decline triggers

- **Stateful streaming (Kafka, Kinesis)** → escalate; stream processing is a different pattern class.
- **Cron-like schedules without job semantics** → defer to the (future) `cron` specialist.

## Evidence basis

- **Primary:** Vendor docs (BullMQ, Inngest, Trigger.dev, AWS SQS, Vercel Queues). `[vendor][H]`
- **Corroborating:**
  - Gregor Hohpe & Bobby Woolf, "Enterprise Integration Patterns" (2003) — Idempotent Receiver, Dead Letter Channel patterns. `[primary][H]`
  - AWS SQS DLQ best practices. `[institutional][H]`
- **What would change this call:** a queue provider deprecates DLQ semantics; a new at-most-once provider becomes the default.

## Runtime counterpart

[`../../../../.claude/agents/queues.md`](../../../../.claude/agents/queues.md).
