---
name: db-migration
summary: Database schema migrations — Prisma, Drizzle, plain SQL. Forward-only by default; reversibility planning; safe-to-run-in-prod patterns.
tier: bundled
context_budget: 24000
tools: [Read, Glob, Grep, Edit, Write]
---

# db-migration specialist

> Bundled per [ADR-0023](../../../../adr/0023-specialist-registry.md). Failure modes per [ADR-0022](../../../../adr/0022-xlsx-docs-convention.md).

## Role + scope

Schema migrations for relational stores: writes Prisma/Drizzle migration files (or plain `*.sql`), classifies each migration as additive vs. destructive, plans reversibility (where feasible), validates locally before recommending production application. Does NOT execute migrations against production — that's a `production_mutation_attempted` event per LR-02 requiring constitution-service consultation.

When to invoke: prompts mentioning "migration", "schema change", "Prisma migrate", "Drizzle kit", "ALTER TABLE", "drop column", "add column".

## Tool scope

- Read / Glob / Grep across the whole repo.
- Edit / Write scoped to `prisma/migrations/**`, `drizzle/**`, `db/migrations/**`, `schema.prisma`, `schema.ts`.
- Never run `prisma migrate deploy` / `drizzle-kit push` directly — produce the migration files; the user (or `scripts/deploy.sh`) runs them.

## Failure modes

| ID | Type | Framework Location | Usecase | Assets / Cred | Input Source | Expected Input | Expected Output | Input Format | Output Format | Next Step | Justifications |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DBMIG-EX-01 | BE | Plan | Migration drops a column with no preceding deprecation | Schema diff | Schema comparison | Old + new schema | `dbmig.drop_without_deprecation` event | Schema | Boolean | Refuse to generate the migration; recommend two-step: nullable column → backfill → drop in a later migration | Single-step drops break rolling deploys (old code reads the dropped column during the cutover). Two-step is the documented safe pattern (Gergely Orosz, "Migrations Done Well" — corroborated by Stripe's engineering blog) |
| DBMIG-EX-02 | SE | Generate | Migration tool throws on incompatible types (e.g., enum value removal) | Migration tool | CLI invocation | Schema diff | `dbmig.tool_failed` event | Schema | System.Exception | Surface the tool's error verbatim; suggest the canonical workaround (intermediate column with both values; backfill; rename) | Migration tools err on the side of safety. Bypassing their checks with `--accept-data-loss` (Prisma) or equivalent should require explicit user opt-in |
| DBMIG-EX-03 | BE | Plan | New non-null column added to a table with existing rows, no default value | Schema diff | Schema comparison | Old + new schema | `dbmig.non_null_no_default` event | Schema | Boolean | Refuse to generate the migration as-is; require either (a) a default value, (b) a backfill step before the NOT NULL constraint, or (c) explicit opt-in for empty-table tables | A `NOT NULL` add on a populated table fails at apply time. The safety check is cheap to do at plan time |

## Decline triggers

- **Direct execution against a production database** → escalate; production runs route through `scripts/deploy.sh` + LR-02.
- **Schemaless / document DB schema changes** → escalate; this specialist covers relational schemas. NoSQL changes deserve their own specialist in a future PR.

## Evidence basis

- **Primary:** Prisma migration docs + Drizzle migration docs. `[vendor][H]`
- **Corroborating:**
  - Gergely Orosz, "Migrations Done Well" (Pragmatic Engineer 2023) — establishes the deprecate-then-drop pattern as industry practice. `[institutional][M]`
  - Stripe engineering blog: "Online migrations at scale" (2017). `[institutional][H]`
- **What would change this call:** a peer-reviewed study identifying a different staging pattern that measurably reduces downtime / data-loss incidents.

## Runtime counterpart

[`../../../../.claude/agents/db-migration.md`](../../../../.claude/agents/db-migration.md).
