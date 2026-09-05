Answer **"if I change this system, what else moves — how, where, and why — and what do I do about it?"** from the systems atlas, per [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md) and [ADR-0066](../../adr/0066-agent-ready-change-discipline.md). Use this before editing anything under `core/`, `data/`, `ui/` or `scenes/`, before a spec PR that touches §5 or §6, and whenever a task names more than one system. The answer is computed from `systems/registry/`, not recalled — do not answer impact questions from memory.

## Input

`$ARGUMENTS` — a system id (`damage_model`, `sig_actor_died`, `crafting`) or a file path. A path is resolved first; words are searched:

```bash
scripts/systems-map.sh which <path>     # file → system id (the PreToolUse hook prints this when you open a file)
scripts/systems-map.sh find "<words>"   # words → candidate ids
```

## What to do

**Step 1 — Get the checklist, then the report.** The checklist is the actionable form: what to touch, what MUST be checked (direct hard downstream with paths and owners), what SHOULD be checked, the deeper ripple by domain, upstream, signals, DIRECTOR stops, the gates for the phase, and the registry upkeep commands. The impact report is the PR-ready walk of the same graph in both directions.

```bash
scripts/systems-map.sh checklist <id>
scripts/systems-map.sh impact <id>
# narrower views:
scripts/systems-map.sh affects <id> --depth 2      # only what this can reach in two hops
scripts/systems-map.sh affected-by <id> --phase 1  # only what exists by Phase 1
scripts/systems-map.sh show <id>                    # the card: parts + direct edges
```

**Step 2 — Follow the runbook when one applies.** The checklist's §0 names it (`rb_add_item`, `rb_change_schema`, …). `scripts/systems-map.sh runbook <rb_id>` prints the ordered steps: system, artifact, verification. Every runbook is validated against the registry, so its steps cover every hard downstream of its primary system or say why not.

**Step 3 — Read the hard rows, not the count.** A hard edge breaks when the source changes; a soft edge degrades. Every row says **how** (listens, reads, references, …), **via** (the signal, field or path), and **why**. If a row's *why* no longer holds, the registry is wrong — fix the row in the same PR.

**Step 4 — Act on what the checklist says.**

- **Candidate or non-goal system** → stop. A DIRECTOR decision and a spec PR come first (R10, §14).
- **Signals crossing the change** → the payload stays the same, or spec §5 changes in the same PR (R-EB1) with the `sig_*` row (`rb_add_signal`).
- **Owners to loop in** → those roles review the PR; stay inside your role's write scope (§7.1).
- **Spec sections to re-read** → confirm the spec still describes the behavior after the change.

**Step 5 — Keep the ledger true.** If the change adds, removes or rewires a system, use the mutation commands — they escape, place the row in the right file, and revert if the ledger would become invalid:

```bash
scripts/systems-map.sh add-node --id <id> --name "…" --parent <parent> --phase <n> --status <s> --owner <role> --where <path> --spec "§x" --summary "…"
scripts/systems-map.sh add-edge --from <dependent> --how <how> --to <dependency> --strength <hard|soft> --why "…"
scripts/systems-map.sh validate          # zero errors; read the warnings — they are design questions
scripts/systems-map.sh render            # regenerates systems/ATLAS.md, atlas/, explorer.html and systems/llm/
scripts/systems-map.sh audit-diff        # before the PR: which systems the diff touches, which hard downstream it did not
scripts/systems-map.sh observe --strict  # code vs ledger: undeclared dependencies, signals only in code, R2–R6 violations (ADR-0067)
```

`loom doctor` fails when the registry has errors or the generated files are stale, so a PR cannot merge with a ledger that lies.

## Output

Paste the checklist's **MUST check** rows (or the report's summary table and hard rows) into the PR description under **Impact**, and the `audit-diff` gaps with a one-line confirmation each. The queries are traced to the event log (`systems_impact_query`) so the audit trail shows the question was asked.

## Verifier

`verifier_type: schema_check` — `scripts/systems-map.sh validate` exits 0 and `render --check` reports the generated files current; both run inside `loom doctor`.

## Boundaries

- The query commands report; the mutation commands are the only writer, and they refuse to leave the ledger invalid. Generated files under `systems/` are never edited by hand (the hook denies it).
- Do not add an edge without a *why* — the validator rejects it, and an edge nobody can explain cannot be reviewed.
- A warning is not a lint nit: phase inversions, scope leaks, R2 smells and runbook gaps are the design questions the ledger exists to surface. Resolve them in the registry, the runbook or the spec — not by deleting the row or softening an edge that is truly hard.
