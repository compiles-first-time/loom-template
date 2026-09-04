# `systems/` — the EMBER systems atlas

> **What this is, in one picture:** the city's utility map. Every pipe (system), what feeds what (edges), and a "call before you dig" service (`scripts/systems-map.sh impact <id>`) that tells you what breaks if you cut here. Per [ADR-0065](../adr/0065-systems-atlas-and-impact-map.md).
>
> **What this is not:** code. Game code lives in `core/` (the verbs) and content in `data/` (the nouns) per GAME_INFRA_SPEC.md R1. This directory is the architecture ledger *about* them.

| File | Role | Edit? |
|---|---|---|
| [`registry/*.md`](./registry/) | **Source of truth.** One file per domain; a `## Nodes` table and an `## Edges` table each | Yes — this is the only thing you edit |
| [`ATLAS.md`](./ATLAS.md) | Generated catalog: counts, big-picture diagram, load-bearing systems, DIRECTOR decisions, signal table, per-domain trees and wiring | No — `scripts/systems-map.sh render` |
| [`explorer.html`](./explorer.html) | Generated interactive map: click a system, see what it affects (ember) and what affects it (blue), with how/where/why | No — same command |

## The three questions the atlas answers

1. **What exists?** `scripts/systems-map.sh tree` — 16 domains, tiered by containment (1 = domain, 2 = system, 3–4 = parts), each with a phase, status, owner, where it lives, and the spec section that names it.
2. **What is affected if X changes, how, where, why?** `scripts/systems-map.sh impact <id>` — downstream and upstream, grouped by distance, every row carrying *how* (listens, reads, references, …), *via* (the signal, field or path), *strength* (hard breaks, soft degrades) and *why*.
3. **What must the Director decide?** `ATLAS.md` §DIRECTOR decisions — every `candidate` system was asked for but is not in the spec; each needs a yes/no/later and a spec PR (R10, §14).

## Reading a row

```
| damage_model | Damage model | 2 | combat | 1 | spec | orchestrator | core/combat/damage.gd | §5 | Resolves hits… | The scoring table |
   id            name          tier  parent  phase status  owner         where                   spec  summary          analogy
```

- **Phase** `0`–`5` from spec §13, or `—` for candidates and non-goals.
- **Status** `spec` (named in GAME_INFRA_SPEC.md) · `implied` (required by something the spec says) · `candidate` (asked for, not in the spec — Director decision) · `non-goal` (the spec says do not build; kept so the boundary is visible).
- **Owner** is a role from spec §7.1, never a person: `orchestrator`, `content-smith`, `world-builder`, `quest-writer`, `test-pilot`, `director`. Several are joined with `/`.
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
| `reads` | reads the target's data or state |
| `references` | the row's data names the target's ids (`EnemyDef.loot_table`) |
| `calls` | a direct call — only inside one `core/` subtree or a pure helper (R2); the validator flags anything else |
| `renders` | presentation shows the target's state and never mutates it (R5) |
| `validates` | a gate or tool checks the target |
| `persists` / `transports` | saving and networking carry the target's state |
| `configures` / `extends` / `gated_by` | settings, specialization, and unlock or approval gates |

## The validator is the reviewer

`scripts/systems-map.sh validate` rejects dangling ids, tier mismatches, unknown vocabularies, edges without a *why*, and any disagreement between the registry's `sig_*` rows and the spec's §5 table (R-EB1). It **warns** about design questions rather than typos: a spec system hard-depending on a candidate (scope leak), a Phase 1 system hard-depending on a Phase 3 one (phase inversion), a direct call across `core/` subtrees (R2 smell), a system with no wiring at all (island). Warnings are resolved in the registry or the spec — never by deleting the row.

`loom doctor` runs the validator and fails when the generated files are stale, so a PR cannot merge with a ledger that lies.

## Keeping it true

When a change adds, removes or rewires a system: edit the table, `validate`, `render`, commit all three together. The `/impact` command (`.claude/commands/impact.md`) walks an agent through this before it edits `core/` or `data/`.
