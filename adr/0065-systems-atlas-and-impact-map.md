# ADR-0065: Systems atlas — a validated registry with computed impact analysis

**Status:** Proposed (awaiting DIRECTOR review — Nick)
**Date:** 2026-09-04
**Author:** Builder session that cloned Loom into EMBER — for Nick (Director)
**Confidence:** [H] that the problem is real and that a code-checked ledger beats prose for it; [M] on the vocabulary (twelve edge kinds, four statuses) — extend as the registry is used; [M] on the first population of the registry (740 nodes, 1,131 edges), which is a best-current-call reading of GAME_INFRA_SPEC.md plus the Director's list and will be corrected by use

## Context

EMBER is a co-op survival RPG with WoW-style systems. The Director asked for two things at once: an **exhaustive list of every system the game needs**, organized primary / secondary / tertiary, and a **way to know, as things get complex, what is affected by a change, how, where, and why** — so that nothing is built without clarity about what it touches.

The game's own spec already contains half the answer. GAME_INFRA_SPEC.md rules R1 (systems versus content) and R2 (systems talk only through the EventBus) mean the game is *designed* as a graph: nodes are systems and content types, edges are signals and data references, and §5's signal table *is* the API between systems. What was missing was the graph itself, written down where code can check it.

Prose cannot hold this. Loom learned the same lesson three times in one month: a format specified only in prose degraded to whatever the first author typed (ADR-0059, ADR-0060, ADR-0061 — *an unchecked convention drifts*). A dependency map kept as a document would be wrong within weeks, and a wrong map is worse than none because it is trusted.

Constraints in play: the Godot project's plain-text rule (R3) and Git-as-content-database (§10) — so the ledger must be text in Git; Loom's zero-dependency gate (ADR-0062) — so the tool must be plain Node; the Director's reading preferences — visual, pattern-first, analogy-driven — so the outputs must be diagrams, badges and an interactive map rather than paragraphs.

## Decision

**1. The registry is the source of truth** — [`systems/registry/*.md`](../systems/registry/), one markdown file per top-level domain (16 today), each with a `## Nodes` table and an `## Edges` table. Markdown tables on purpose: one node = one line, one edge = one line, so a diff is a reviewable list and GitHub renders the source with no tooling.

Every node carries: `id` (snake_case, R7-style), `name`, `tier` (1 domain → 2 system → 3–4 parts, by containment), `parent`, `phase` (0–5 from spec §13), `status`, `owner` (a spec §7.1 role, never a person), `where` (the path in the game repo), `spec` (the section that names it), `summary`, and — required on tiers 1–2 — an `analogy`.

Every edge carries: `from`, `how`, `to`, `via` (the signal, field or path the coupling runs through), `strength` (`hard` breaks, `soft` degrades) and a mandatory `why`.

**2. Status is a scope instrument, not a label.** `spec` = named in the spec; `implied` = required by something the spec says; `candidate` = asked for but **not** in the spec — a DIRECTOR decision and a spec PR (R10, §14) stand between it and being built; `non-goal` = the spec says do not build, kept on the map so the boundary is visible. The Director's request list contained many systems the spec does not (PvP, classes and talents, professions, currencies and markets, guilds, factions, procedural worlds, accounts). The registry records all of them as candidates; it decides nothing.

**3. Direction has one rule.** Edges are written from the dependent's point of view (*loot listens to actor_died*, *casting reads SpellDef*) except `emits`, written from the emitter. The tool normalizes both into **influence** edges (`A → B` = a change in A can affect B). *Affects* is a forward walk; *affected by* is a backward walk; both include the system's contained parts. EventBus signals are nodes (`sig_*`, children of `event_bus`), so a listener is two hops from its emitter — the shape R2 prescribes.

**4. The tool computes; it never recalls.** [`scripts/lib/systems-map.mjs`](../scripts/lib/systems-map.mjs) (zero dependencies) offers `validate`, `affects`, `affected-by`, `impact` (a PR-ready report with a review checklist), `show`, `tree`, `find`, `stats`, and `render`. Impact queries emit a `systems_impact_query` event (Rule 22 — the audit trail shows the question was asked). The [`/impact`](../.claude/commands/impact.md) command makes the query the first step before any edit under `core/`, `data/`, `ui/` or `scenes/`.

**5. The validator is the reviewer.** Errors (block): dangling ids, tier ≠ parent tier + 1, unknown vocabulary, an edge without a `why` or a `strength`, `emits`/`listens` that do not target a signal, and any disagreement between the registry's `sig_*` rows and the spec's §5 table (R-EB1 measured, not assumed). Warnings (design questions): a spec system hard-depending on a candidate (**scope leak**), a Phase-1 system hard-depending on a Phase-3 one (**phase inversion**), a direct call across `core/` subtrees (**R2 smell**), a system with no wiring (**island**). Info: feedback loops, and candidate signals awaiting a §5 row.

**6. Generated views are checked, never hand-edited.** `render` writes [`systems/ATLAS.md`](../systems/ATLAS.md) (index: counts, the tier-1 picture, load-bearing systems by blast radius, DIRECTOR decisions, the signal table derived from the ledger, findings), one page per domain under `systems/atlas/`, and [`systems/explorer.html`](../systems/explorer.html) (interactive: click a system, see downstream in ember and upstream in blue, with how/where/why). `loom doctor` fails on registry errors and on stale generated files (`systems-atlas`, `systems-atlas-rendered`), and surfaces open design findings as a soft check.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657), NeurIPS 2025) — 41.8% of measured failures are specification and system-design failures; 36.9% inter-agent misalignment, including context lost at handoff. An impact report is exactly the handoff packet a specialist needs before touching a coupled system. `[T1][V1]` (same basis ADR-0064 cites; not re-fetched in this session).
- **Internal, measured (V2):** the registry's own first validation run surfaced 58 findings before the phase bookkeeping was corrected — among them a real spec tension (the Phase 0 console has a `time <phase>` command, but the world clock lands in Phase 3), 12 signals the bus needs that §5 lacks, and the fact that `fall_damage` is a second emitter of `actor_damaged` where §5 lists only combat. None of these were visible in the prose. `[internal][H]`
- **Loom precedent:** ADR-0022 (bidirectional *Affects / Affected by* on every ADR, checked by doctor) and ADR-0059/0060/0061 (adherence, provenance, register completeness each degraded silently until code measured them). This ADR applies the same stance to the game's architecture. `[internal][H]`
- **Practitioner convergence (T4):** architecture-as-code dependency ledgers with generated views (C4/Structurizr, ArchUnit, Nx's project graph with `affected` queries) — independent vendors landing on "declare the graph, compute the blast radius, fail the build when the declaration drifts." `[T4][M]`
- **What would change this call:** measured evidence that impact reports are generated but not read (the `systems_impact_query` events exist while PRs still break unlisted systems) — then the discipline needs a harder gate, not a better document; or a registry that cannot keep up with the code (stale warnings dominate), which would argue for deriving edges from the code itself once `core/` exists.

## Cost model

Not applicable — no LLM loop. Every command is deterministic and runs in under a second on the current registry; validation and rendering cost $0 in CI.

## Consequences

**Locks in:** the registry as the only place the systems inventory lives; `candidate` as the status that separates *asked for* from *approved*; the §5 table and the `sig_*` rows moving together (R-EB1 mechanically enforced); generated files committed alongside the registry; `/impact` before edits to coupled code.

**Locks out:** hand-drawn architecture diagrams that nothing checks; a dependency list inside the spec (the spec stays the law; the atlas is the map of it); building a candidate system because it appears in the registry.

**Migration:** none — additive. When `core/` exists, a follow-up may derive `emits`/`listens` edges from `EventBus.emit`/`connect` calls and diff them against the ledger, turning the R2 check from declared to observed.

**Open for the DIRECTOR (surfaced by the tool, not decided here):**
1. The `time <phase>` console command versus the Phase 3 clock (stub clock in Phase 0, or move the clock earlier).
2. Twelve proposed signals for §5: `structure_placed`, `structure_destroyed`, `player_joined`, `player_left`, `level_up`, `currency_changed`, `reputation_changed`, `boss_phase_changed`, `weather_changed`, `zone_entered`, `need_threshold_crossed`, `trade_completed`.
3. 242 candidate systems across 16 domains — the scope of the game beyond the spec.
4. Where the Godot project root sits relative to Loom's directories (`.gdignore` on the governance folders, or the game under `game/`).

## Alternatives considered

- **A dependency section per system inside GAME_INFRA_SPEC.md.** Rejected — the spec is a contract with change control (§14); a 1,100-edge ledger inside it would make every wiring change a spec PR and would not be validated.
- **A graph database or YAML with a schema library.** Rejected — violates the plain-text-in-Git rule (R3, §10) or Loom's zero-dependency gate; markdown tables diff line-by-line and render on GitHub.
- **Deriving the graph from code only.** Not possible yet (Phase 0 has no `core/`), and even later it captures only calls and signals, not data references or design intent (`why`). Kept as the follow-up above.
- **Fewer tiers (systems only, no parts).** Rejected — the Director asked for primary / secondary / tertiary; and impact questions land on parts (`death_resolution`), not domains.
- **One giant ATLAS.md.** Tried; 389 KB was unreadable and near GitHub's render limit. Replaced by an index plus one page per domain.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- `systems/README.md` — how to read and edit the registry
- `systems/registry/00-foundation.md` — the EventBus signal rows and their wiring (and every other registry file)
- `scripts/lib/systems-map.mjs` — parser, validator, impact analysis, renderers
- `scripts/lib/systems-map.test.mjs` — the tests, including the live-registry gate
- `scripts/lib/doctor.mjs` — the `systems-atlas`, `systems-atlas-rendered`, `systems-atlas-design` checks
- `.claude/commands/impact.md` — the `/impact` skill
- `layers/L1-skeleton.md` — `systems/` added to the project skeleton
- `CLAUDE.md` — session ritual (impact before edits) and the atlas pointer

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- `GAME_INFRA_SPEC.md` — R1, R2, R7, §5 (the signal table the validator cross-checks), §7.1 (owner roles), §13 (phases), §14 (change control for candidates)
- `constitution/kernel-v6.md` — Rule 22 (every claim has provenance; impact queries are traced)
- `constitution/local-rules.md` — LR-05 (best-current-call, supersedable by evidence)
- [ADR-0022](./0022-xlsx-docs-convention.md) — bidirectional dependency tracking, the convention this generalizes
- [ADR-0059](./0059-skill-adherence-and-session-compliance.md), [ADR-0060](./0060-claim-provenance-verification.md), [ADR-0061](./0061-requirements-register-role-and-verifier-fields.md) — measured, not assumed
- [ADR-0062](./0062-governance-regression-gate.md) — the zero-dependency, $0 gate this tool runs inside
- [ADR-0064](./0064-decompose-gated-pipeline.md) — the plan is the artifact; impact reports feed context packets

## References

- GAME_INFRA_SPEC.md v0.1.0 (Director) — §4 R1/R2, §5, §7, §13, §14
- The Director's system list (2026-09-04 session) — the source of the candidate set
- [`systems/ATLAS.md`](../systems/ATLAS.md) §Findings — the live list of open design questions the tool maintains
