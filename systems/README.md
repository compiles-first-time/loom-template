# `systems/` — the EMBER systems atlas

> **What this is, in one picture:** the city's utility map plus the dig permits. Every pipe (system), what feeds what (edges), a "call before you dig" service that tells you what breaks if you cut here (`checklist`), and the written procedure for each kind of job (`runbooks/`). Per [ADR-0065](../adr/0065-systems-atlas-and-impact-map.md) (the map) and [ADR-0066](../adr/0066-agent-ready-change-discipline.md) (the procedures, the machine pack, the hook).
>
> **What this is not:** code. Game code lives in `core/` (the verbs) and content in `data/` (the nouns) per GAME_INFRA_SPEC.md R1. This directory is the architecture ledger *about* them.

| Path | Role | Edit? |
|---|---|---|
| [`registry/*.md`](./registry/) | **Source of truth.** One file per domain; a `## Nodes` table and an `## Edges` table each | Yes — through `add-node` / `add-edge` / `set-node` / `remove-*` (they validate and revert), or by hand with care |
| [`runbooks/*.md`](./runbooks/) | **Source.** One procedure per kind of change (add an item, a material, a spell, an enemy, a signal, a schema field …), validated against the registry | Yes — one file per runbook, format below |
| [`ATLAS.md`](./ATLAS.md), [`atlas/*.md`](./atlas/) | Generated for people: index, big picture, load-bearing systems, DIRECTOR decisions, signal table, findings; one page per domain with its wiring | **No** — `scripts/systems-map.sh render` (the hook denies hand edits) |
| [`explorer.html`](./explorer.html) | Generated interactive map: click a system, see what it affects (ember) and what affects it (blue), with how/where/why | No — same command |
| [`llm/`](./llm/) | Generated for models: `nodes.jsonl`, `edges.jsonl`, `runbooks.jsonl`, `summary.json` and a `README.md` written for an LLM — grep it, never load it whole | No — same command |
| [`codeowners.json`](./codeowners.json) | **Source.** Role → GitHub owner (team or username) for the generated CODEOWNERS | Yes — the Director's mapping |
| [`../.github/CODEOWNERS`](../.github/CODEOWNERS) | Generated review routing from every system's Where + Owner ([ADR-0067](../adr/0067-declared-versus-observed.md)) | No — same command |
| [`audits/`](./audits/) | Records: audit reports and the scripts that applied them | Append-only |

## The four questions the atlas answers

1. **What exists?** `scripts/systems-map.sh tree` / `find <text>` — 16 domains, tiered by containment (1 = domain, 2 = system, 3–4 = parts), each with a phase, status, owner, where it lives, and the spec section that names it.
2. **If I change X, what moves — how, where, why — and what do I do about it?** `scripts/systems-map.sh which <path>` turns a file into a system id; `checklist <id>` lists what to touch, what must be checked (direct hard downstream, with paths and owners), what should be checked, the deeper ripple, the signals, the DIRECTOR stops, the gates to run and the registry upkeep — in that order. `impact <id>` is the PR-ready report of the same walk.
3. **How is this kind of change done?** `scripts/systems-map.sh runbook <rb_id>` — the ordered procedure: each step names the system, the artifact to create/update/delete/check, and how to verify. `runbooks` lists them.
4. **What must the Director decide?** `ATLAS.md` §DIRECTOR decisions — every `candidate` system was asked for but is not in the spec; each needs a yes/no/later and a spec PR (R10, §14). `validate`'s warnings are the open design questions in mechanical form.

## Reading a row

```
| damage_model | Damage model | 2 | combat | 1 | spec | orchestrator | core/combat/damage.gd | §5 | Resolves hits… | The scoring table |
   id            name          tier  parent  phase status  owner         where                   spec  summary          analogy
```

- **Phase** `0`–`5` from spec §13, or `—` for candidates and non-goals.
- **Status** `spec` (named in GAME_INFRA_SPEC.md) · `implied` (required by something the spec says — cite the section) · `candidate` (asked for, not in the spec — Director decision) · `non-goal` (the spec says do not build; kept so the boundary is visible).
- **Owner** is a role from spec §7.1, never a person: `orchestrator`, `content-smith`, `world-builder`, `quest-writer`, `test-pilot`, `director`. Several are joined with `/`. An owner should be able to write the row's `Where` (§7.1 write scopes); the open mismatches are listed in `CLAUDE.md`.
- **Where** is the path the system lives at (`;`-separated when several). `which <path>` inverts it, so keep it precise: a file when there is one, a directory when the system owns the directory.
- **Analogy** is required on tiers 1–2: the map is meant to be read by pattern, not by prose.

## Reading an edge

```
| loot_rolls_on_death | listens | sig_actor_died | — | hard | Loot rolls when something dies |
   from                  how       to                via  strength  why
```

Every edge is written from the **dependent's** point of view — *loot listens to the signal*, *casting reads the spell definition* — except `emits`, written from the emitter. The tool turns both into **influence** (`A → B` = a change in A can affect B), so *affects* and *affected by* are graph walks, not reading exercises.

| How | Meaning |
|---|---|
| `listens` / `emits` | EventBus signals. Signals are nodes (`sig_*`, children of `event_bus`), so a listener is two hops from its emitter — exactly R2 |
| `reads` | reads the target's data or state. `reads <x>_defs` implies the lookup goes through `data_registry_loader`; that edge is not repeated on every reader |
| `references` | the row's data names the target's ids (`EnemyDef.loot_table`) |
| `calls` | a direct call — only inside one `core/` subtree or a pure helper (R2); the validator flags anything else |
| `renders` | presentation shows the target's state and never mutates it (R5) |
| `validates` | a gate or tool checks the target |
| `persists` / `transports` | saving and networking carry the target's state |
| `configures` / `extends` / `gated_by` | settings, specialization, and unlock or approval gates |

**Strength is a promise, not a mood.** `hard` = breaks or must change when the source changes. `soft` = should be reviewed. A dependency on a later-phase system is `soft` until that phase *only if* the earlier phase truly runs without it (say so in the `why`); otherwise leave it `hard` and let the phase-inversion warning stand — the four open findings on `gm_console` are the console-versus-clock question the Director must answer, and softening them would hide it.

## Runbooks — the procedure for a kind of change

A runbook turns "what moves" into "do this, in this order, verify with that". One file per runbook under `runbooks/`:

```markdown
# rb_add_item — Add an item

## Runbook
| Field | Value |
|---|---|
| Trigger | when this procedure applies |
| Primary | items |                      ← a registry id
| Roles | content-smith; world-builder |
| Director | none | or the decision the Director must make first
| Spec | §6.1, §11 |
| Not touched | equipment: only when slot != none (step 9); ... |
| Coverage | direct |                     ← default; `through-signals` for a runbook that changes the bus itself

## Steps
| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | create | items | data/_inbox/<id>.json | converter accepts it | ... |
```

Actions: `create` · `update` · `delete` · `check` · `run` · `decide` (a DIRECTOR stop; the only action allowed without a System). The validator makes runbooks honest: **every System cell must be a registry id**, and **every direct hard downstream of the Primary system must appear as a step or under `Not touched` with a reason**. A runbook that silently skips a system the map says is affected fails the check.

**One rule about signals, applied everywhere:** a listener reached *through* a system's own signal belongs to the signal, not to the system — adding a signal to the bus does not break the listeners of the other signals. The runbook coverage check, the hook's "direct hard downstream" and the checklist all compute it the same way (`coverageTargets`). A runbook that changes how the bus itself dispatches opts in with `Coverage: through-signals`, and every listener becomes a target. `render` publishes runbooks into `llm/runbooks.jsonl`; `checklist <id>` attaches the runbooks whose primary is (or contains) the system.

Write a runbook when a kind of change will happen more than once. The first 17 cover the §6 nouns (item, material, recipe, spell, status effect, enemy, loot table, quest, dialogue, NPC, biome, building piece), the two contracts (signal, schema field), a new verb, retiring content, and adding a system to the atlas itself.

## The change protocol (what an agent does)

1. Open the file — the PreToolUse hook says which system it belongs to, its direct hard downstream, the runbook, and the owner's write scope. (`which <path>` gives the same answer on demand.)
2. `scripts/systems-map.sh checklist <id>` — read §0 (stop conditions: candidate, non-goal, owner) and §2 (must-check).
3. Follow the runbook step by step when one applies.
4. Make the change inside the owner's write scope. A new signal or schema field is a spec PR in the same change (§5/§6, §14).
5. Run the phase's gates (§8), then `validate` and `render --check`, then `bash scripts/doctor.sh`.
6. Added, removed or rewired a system? `add-node` / `add-edge` / `set-node` / `remove-*`, then `render`.
7. `scripts/systems-map.sh audit-diff` before the PR: it maps the changed files to systems and lists every hard downstream nothing touched — confirm each in the PR text. One line in `docs/changelog.md`.

## Editing the registry

Prefer the mutation commands: they escape cells, pick the right file (a node goes to its parent's domain file; signal edges go to the foundation file), keep column order, refuse duplicates and ids that are not snake_case, and **re-validate after writing — if the ledger would have an error, the write is reverted and the reason printed** (`--force` keeps it, `--dry-run` shows the row). Ids are immutable (R7): retire and add rather than rename.

```bash
scripts/systems-map.sh add-node --id crit_tables --name "Crit tables" --parent damage_model --phase 1 --status implied --owner orchestrator --where core/combat/crit.gd --spec "§5" --summary "crit chance and multiplier"
scripts/systems-map.sh add-edge --from crit_tables --how reads --to damage_model --via "base damage" --strength hard --why "crits multiply the base hit"
scripts/systems-map.sh set-node crit_tables where=core/combat/crit_tables.gd
scripts/systems-map.sh remove-edge crit_tables reads damage_model
scripts/systems-map.sh remove-node crit_tables          # refused while parts or edges still reference it
```

Hand edits are fine too (one node = one line, one edge = one line) — run `validate` afterwards; the hook reminds you.

## The validator is the reviewer

`scripts/systems-map.sh validate` rejects dangling ids, tier mismatches, unknown vocabularies, edges without a *why*, runbook steps that name unknown systems, and any disagreement between the registry's `sig_*` rows and the spec's §5 table (R-EB1). It **warns** about design questions rather than typos: a spec system hard-depending on a candidate (scope leak), a Phase 1 system hard-depending on a Phase 3 one (phase inversion), a direct call across `core/` subtrees (R2 smell), a system with no wiring at all (island), a runbook that skips a hard downstream (coverage). Warnings are resolved in the registry, the runbook or the spec — never by deleting the row, and never by softening an edge that is truly hard.

`loom doctor` runs the validator and fails when the generated files (`ATLAS.md`, `atlas/`, `explorer.html`, `llm/`, `.github/CODEOWNERS`) are stale, so a PR cannot merge with a ledger that lies.

## Declared versus observed ([ADR-0067](../adr/0067-declared-versus-observed.md))

The registry says how systems depend on each other. Once game code exists, the code says so too. `scripts/systems-map.sh observe` reads every `.gd`, `.tres` and `.tscn` under the Godot root (the repo, or `game/` when `game/project.godot` exists), maps each file to its system with `which`, and reports:

- **observed but undeclared** dependencies — emits, connects, preloads, class use, `ext_resource` and id references the ledger does not have — each with the `add-edge` command that would declare it (or the code is wrong; decide, then act);
- **declared signal wiring not yet in code**, for systems that have code;
- **signals three ways**: declared in `event_bus.gd`, in the registry, in spec §5 — anything only in code is an R-EB1 gap;
- **files no system owns** — add a node or fix a `Where`;
- **architecture fitness checks** from spec §4, as violations: **R2** a `core/` subsystem reaching into another by preload, class use or `/root/` node path (allowed: `core/util/`, `core/events/`, `core/schemas/`, or a reviewed `calls` edge); **R3** a binary outside `art/` and `audio/`; **R4** global RNG or wall-clock time in `core/` (methods on a seeded `RandomNumberGenerator` are fine); **R5** presentation code emitting a gameplay signal; **R6** a function without typed parameters, a return type and a `##` docstring.

A deliberate exception is written where it happens and must say why:

```gdscript
var started: int = Time.get_ticks_msec()  # atlas: allow R4 — debug timing only, never feeds the sim
```

`observe --strict` exits non-zero on violations, undeclared dependencies or signals only in code. The doctor runs it in CI: violations are hard (the codebase's constitution), undeclared dependencies soft (a ledger to catch up). Without game code the check skips and says so.

## Ownership routing — CODEOWNERS

`render` derives `.github/CODEOWNERS` from every system's `Where` and `Owner` and from `systems/codeowners.json` (role → `@username` or `@org/team`). Directories come first and specific files last because GitHub applies the last matching line; each line is preceded by the system ids it comes from. To change who reviews a path, change the system's owner (`set-node <id> owner=<role>`) or the role's handle in the mapping, then `render`. The hook denies hand edits. Teams named in the mapping must exist in the organization, or GitHub marks the line "unknown owner" and assigns nobody — a solo Director maps every role to one username.

**Why one repository and one atlas, not one per system:** a Godot game is one `res://` tree and its resources reference each other by absolute path; the atlas's edges are mostly cross-domain, so a typical change is one atomic PR across several systems. Isolation comes from enforced boundaries — CODEOWNERS routes the review, §7.1 write scopes bound the roles, `observe` fails on undeclared crossings, `audit-diff` names what a change skipped — not from separate repositories. Details and the MCP question are in ADR-0067.
