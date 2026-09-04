Answer **"if I change this system, what else moves — how, where, and why?"** from the systems atlas, per [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md). Use this before editing anything under `core/`, `data/`, `ui/` or `scenes/`, before a spec PR that touches §5 or §6, and whenever a task names more than one system. The answer is computed from `systems/registry/`, not recalled — do not answer impact questions from memory.

## Input

`$ARGUMENTS` — a system id (`damage_model`, `sig_actor_died`, `crafting`). If empty or not an id, find it first:

```bash
scripts/systems-map.sh find "<words>"
```

## What to do

**Step 1 — Run the report.** It walks influence edges both ways (downstream = *affects*, upstream = *affected by*), including the system's contained parts, and prints a review checklist.

```bash
scripts/systems-map.sh impact <id>
# narrower views:
scripts/systems-map.sh affects <id> --depth 2      # only what this can reach in two hops
scripts/systems-map.sh affected-by <id> --phase 1  # only what exists by Phase 1
scripts/systems-map.sh show <id>                    # the card: parts + direct edges
```

**Step 2 — Read the hard rows, not the count.** A hard edge breaks when the source changes; a soft edge degrades. Every row says **how** (listens, reads, references, …), **via** (the signal, field or path), and **why**. If a row's *why* no longer holds, the registry is wrong — fix the row in the same PR.

**Step 3 — Act on what the report says.**

- **Signals crossing the change** → the payload stays the same, or spec §5 changes in the same PR (R-EB1) and the `sig_*` row in `systems/registry/00-foundation.md` with it.
- **Owners to loop in** → those roles review the PR; a change that reaches `content-smith`'s data needs `content-smith`'s eyes.
- **Candidate systems in the blast radius** → they are not approved. Either leave them untouched or get the DIRECTOR decision first (R10, §14).
- **Spec sections to re-read** → confirm the spec still describes the behavior after the change.

**Step 4 — Keep the ledger true.** If the change adds, removes or rewires a system, edit the registry table (one node = one line, one edge = one line), then:

```bash
scripts/systems-map.sh validate          # zero errors; read the warnings — they are design questions
scripts/systems-map.sh render            # regenerates systems/ATLAS.md + systems/explorer.html
```

`loom doctor` fails when the registry has errors or the generated files are stale, so a PR cannot merge with a ledger that lies.

## Output

Paste the report's summary table and the hard rows into the PR description under **Impact**. The report is also traced to the event log (`systems_impact_query`) so the audit trail shows the question was asked.

## Verifier

`verifier_type: schema_check` — `scripts/systems-map.sh validate` exits 0 and `render --check` reports the generated files current; both run inside `loom doctor`.

## Boundaries

- The tool reports; it never edits the registry. Rewiring is a human-reviewed table edit.
- Do not add an edge without a *why* — the validator rejects it, and an edge nobody can explain cannot be reviewed.
- A warning is not a lint nit: phase inversions, scope leaks and R2 smells are the design questions the ledger exists to surface. Resolve them in the registry or in the spec, not by deleting the row.
