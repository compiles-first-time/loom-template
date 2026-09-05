# ADR-0067: Declared versus observed — code-derived dependencies, architecture fitness checks, ownership routing, and one repository

**Status:** Proposed (awaiting DIRECTOR review — Nick)
**Date:** 2026-09-05
**Author:** Builder session — for Nick (Director)
**Confidence:** [H] that a declared ledger must be checked against what the code actually does, or it drifts (ADR-0065/0066 lesson, measured twice); [M] on the regex-level GDScript analysis — it catches the patterns the spec names and will miss dynamic ones; [M] on CODEOWNERS as the routing mechanism — GitHub's semantics are documented, the team mapping is the Director's to fill in; [H] on one repository rather than one per system

## Context

The Director asked three things: apply the recommendation from the atlas review (derive dependencies from code and diff them against the ledger; run the spec's architecture rules as fitness tests; generate CODEOWNERS from the registry), make the scaffolding keep every system accurate and compatible through developing, testing and deploying, and answer whether each system should have its own repository or its own mapping and MCP server.

ADR-0065 declared the graph; ADR-0066 made it actionable for agents. Both rest on a ledger people and models *write*. The failure mode of any written ledger is that the code moves and the ledger does not; the two audits so far found the gap by reading, which does not scale. Once `core/`, `data/` and `scenes/` exist, the code itself says which signals are emitted and connected, which scripts load which, which defs reference which ids. That is the second source the ledger needs.

Spec §4 states rules that are architectural, not stylistic: systems talk only through the EventBus (R2), everything is plain text except art and audio (R3), the simulation is deterministic with seeded RNG and no wall clock (R4), presentation never mutates or emits (R5), every function is typed and documented (R6). Today nothing checks them but a reviewer's eye; §8's gates check parse, tests, data and boot.

## Decision

**1. `observe` compares the code with the ledger** ([`scripts/lib/systems-observe.mjs`](../scripts/lib/systems-observe.mjs)). It scans the Godot project (the repo root, or `game/` when `game/project.godot` exists), extracts facts from GDScript (`signal` declarations, `EventBus.<s>.emit`/`.connect` in both syntaxes, `preload`/`load`, `class_name` and class use, `/root/` node paths, RNG and wall-clock calls, function signatures and `##` docstrings) and from `.tres`/`.tscn` (the def's `id`, its script, `ext_resource` paths, `res://` references, id references in fields and entries), maps every file to its system through `which`, and reports: **observed dependencies the ledger does not declare** (with the `add-edge` command to declare each), **declared signal wiring not yet seen in code** for systems that have code, **signals compared three ways** (code, registry, spec §5), and **files no system owns**. It never edits anything.

**2. The spec's architecture rules run as fitness checks.** R2: a `core/` subsystem reaching into another by preload, class use or node path, unless a reviewed `calls` edge is declared or the target is `core/util/`, `core/events/` or `core/schemas/`. R3: a binary outside `art/` and `audio/`. R4: global RNG (`randf()`, `randi_range()` …, but not methods on a seeded `RandomNumberGenerator`) or wall-clock calls inside `core/`, except `core/util/` and `core/debug/`. R5: a script under `ui/`, `art/`, `audio/` or an actor's animation or camera folder emitting an EventBus signal. R6: a function with an untyped parameter, no return type, or no `##` docstring above it, engine callbacks excepted. A line may carry `# atlas: allow R4 — reason`; the reason is mandatory and the exception is listed in the report, so every exception is reviewable. Violations fail `--strict` and are **hard** in the doctor; undeclared dependencies are **soft** (the ledger catching up). Without game code the check skips — it is scaffolding that arms itself the day Phase 0 lands `core/`.

**3. CODEOWNERS is generated, never written.** `render` derives [`.github/CODEOWNERS`](../.github/CODEOWNERS) from every system's `Where` and `Owner` plus [`systems/codeowners.json`](../systems/codeowners.json), a role → GitHub owner mapping the Director controls (teams or usernames; the shipped default names `@compiles-first-time/ember-<role>` teams and a `_default`). Broad directories come first and specific files last because GitHub applies the last match; each line is preceded by the system ids it comes from. The doctor's staleness check covers it and the hook denies hand edits. This is the review-routing half of ownership; §7.1's write scopes remain the writing half.

**4. The scaffolding for develop, test and deploy is the same four checks at three moments.** At the edit: the hook names the system and its hard downstream. Before the PR: `checklist`, the runbook, `audit-diff` (what the diff touched versus what it should have), and `observe --strict` (what the code does versus what the ledger says). In CI: `loom doctor` already runs in the governance gate on every PR, and it now carries `systems-observed` and `systems-declared-vs-observed` beside the atlas checks; when Phase 0 creates the Godot gates workflow (§8 G0–G3), `observe --strict` belongs next to G0. Compatibility between systems is the contracts: §5 payloads and §6 schema versions, both cross-checked (the validator against §5; the converter and G2 against §6; `observe` against the emitted and connected names).

**5. One repository, with enforced boundaries — not one per system.** A Godot game is one `res://` tree; every `.tres` and `.tscn` refers to files by absolute `res://` path, so splitting systems across repositories breaks the references or forces submodules and release choreography for what today is one atomic change. The atlas shows why that cost would be paid constantly: 1,171 edges, most cross-domain; adding a material touches items, recipes, loot tables, nodes and art in one PR. Polyrepo earns its keep for independently *deployable* units with separate release cadences; in EMBER that is at most the Phase 4 dedicated server, and Godot builds it from the same project as a headless export preset, so it stays in the repository too. The isolation people want from separate repositories — nobody breaks my system without my knowing — comes from boundaries the repository enforces: CODEOWNERS routes the review, §7.1 write scopes bound the roles, `observe` fails the build on an undeclared crossing, and `audit-diff` names what a change did not touch. If a second product ever shares EMBER's engine layer, that layer becomes a Godot addon with its own repository; that is the only split that pays.

**6. One atlas, not one mapping per system; one atlas MCP server, if any, not one per system.** A mapping per system duplicates every edge in two places and they drift apart (ADR-0066). Per-system MCP servers would each wrap the same registry, and every connected server's tool descriptions sit in the model's context on every turn, so ten servers cost ten tool lists for one graph. What does improve accuracy is a **scoped context packet per task** generated from the one ledger — checklist, runbook, node card, write scope, files — with §7.1's roles as the worker axis. A single atlas MCP server exposing `which`, `checklist`, `runbook`, `impact`, `observe` and `audit-diff` as tools would let OpenHands and other harnesses use them natively instead of through a shell; the CLI is already tool-shaped for that. It is a new server under R10 and §9, so it is a spec PR for the Director, recorded here as a recommendation, not built.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Internal, measured (V2):** the checked-in fixture project (`scripts/lib/fixtures/godot-sample/`) carries six deliberate violations and one allowed exception; the tests assert each is found and nothing else is (the first RNG pattern also flagged `rng.randf_range()`, the compliant form — caught by the tests, fixed with a lookbehind). Against the fixture registry, `observe` finds exactly the three planted undeclared dependencies, recognizes the two declared ones, reports the one declared-but-unwired listener, and splits signals into only-in-code, only-in-registry and only-in-spec. `[internal][H]`
- **Internal, measured (V2):** the generated CODEOWNERS routes 803 lines from the registry's 715 systems; it renders deterministically and matches on disk. `[internal][H]`
- **Primary:** Potvin & Levenberg, *Why Google Stores Billions of Lines of Code in a Single Repository*, Communications of the ACM 59(7), 2016 — atomic cross-project changes, one source of truth, and tooling that computes reverse dependencies are the monorepo's advantages; the costs are tooling scale far beyond this project's size. `[T1][V1]` (well-known; not re-fetched in this session.)
- **Tooling (T2):** Godot's project model — a single `res://` root, resources referenced by absolute `res://` path, exports as presets of one project, reusable code shipped as addons — is the structural reason one repository is the right unit for a Godot game. `[T2][M]` (from the engine's documented project structure; not re-fetched.)
- **Tooling (T2):** MCP clients send every connected server's tool definitions with each request; tool-list size is a per-turn context cost, which is why one server with six tools beats N servers with one. `[T2][M]`
- **Primary:** Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* (arXiv:2503.13657) — inter-agent misalignment and lost handoff context dominate failures; the scoped packet, not the number of agents, is what helps. `[T1][V1]` (basis shared with ADR-0064/0065/0066.)
- **Practitioner convergence (T4):** ArchUnit and eslint-plugin-boundaries (architecture rules as tests), Nx `affected` and Bazel `rdeps` (diff → affected targets), GitHub CODEOWNERS (path → reviewer) — independent tools landing on the same three moves this ADR adopts. `[T4][M]`
- **What would change this call:** false positives from the regex analysis blocking legitimate work (then move to a real GDScript parser, e.g. tree-sitter-gdscript, as a declared dependency under R10); a second shipped product sharing the engine layer (then the addon split in Decision 5); the Director choosing per-user rather than per-team ownership (then the mapping changes, not the generator).

## Cost model

Not applicable — no LLM loop. `observe` is a single pass over the project's text files; the fixture runs in well under a second and the live check skips until game code exists. All checks run in CI at $0.

## Consequences

**Locks in:** two sources for the dependency graph — declared and observed — with the diff as a doctor check; the §4 rules as executable checks with reviewable exceptions; CODEOWNERS derived, never hand-written; one repository with enforced boundaries; one atlas.

**Locks out:** a ledger that can quietly disagree with the code once code exists; `# atlas: allow` without a reason; a hand-edited CODEOWNERS; per-system repositories and per-system MCP servers as accuracy measures.

**Migration:** additive. The check is dormant until Phase 0 creates `core/`; the first real files will produce a backlog of undeclared dependencies and R6 findings that is itself the Phase 0 ledger reconciliation. When the Godot gates workflow exists, `observe --strict` joins it.

**Open for the DIRECTOR:**
1. Fill `systems/codeowners.json`: create the `ember-<role>` teams, or map every role to your username.
2. Whether `observe --strict` should gate CI from the first Phase 0 commit (recommendation: yes for violations, advisory for undeclared dependencies until the ledger catches up, which is how the doctor is set today).
3. Whether to add a single atlas MCP server (spec §9, R10) so non-Claude harnesses get the six atlas tools natively.

## Alternatives considered

- **A real GDScript parser now.** Rejected for now — a third-party dependency under R10 for patterns regexes catch; kept as the upgrade path if false positives appear.
- **Deriving the whole registry from code and dropping the declared ledger.** Rejected — code cannot say *why*, *which phase*, *which owner* or *what is a candidate*; and there is no code yet.
- **One repository per system.** Rejected (Decision 5): breaks `res://` references, turns one atomic change into release choreography, and buys isolation that boundaries provide more cheaply.
- **One MCP server per system.** Rejected (Decision 6): N tool lists in context for one graph; the packet is what scopes accuracy, not the server.
- **Hand-written CODEOWNERS.** Rejected — the registry already knows owner and path; a second copy drifts.
- **Blocking on undeclared dependencies from day one.** Deferred — the first real code will surface a backlog; blocking would stall Phase 0. Violations of §4 rules do block.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- `scripts/lib/systems-observe.mjs` — extractors, comparison, fitness checks, report
- `scripts/lib/systems-observe.test.mjs` — the fixture-driven tests and the CODEOWNERS tests
- `scripts/lib/systems-map.mjs` — the CODEOWNERS renderer, the `observe` and `codeowners` commands, `render` writing CODEOWNERS
- `scripts/lib/doctor.mjs` — `systems-observed` and `systems-declared-vs-observed`; CODEOWNERS in the staleness check
- `scripts/lib/systems-guard.mjs` — the hook denies hand edits of the generated CODEOWNERS
- `systems/codeowners.json` — the role → owner mapping
- `.github/CODEOWNERS` — generated
- `systems/README.md` — declared versus observed, allow-comments, ownership routing
- `.claude/commands/impact.md` — `observe --strict` in the pre-PR steps
- `CLAUDE.md` — commands and ADRs in flight
- `AGENTS.md` — workflow contract
- `docs/changelog.md` — the line recording this change

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- `GAME_INFRA_SPEC.md` — §3 (the layout and `res://` root), §4 R2–R6 (the rules checked), §5 (signals compared), §7.1 (roles → owners), §8 (where `observe --strict` joins the gates), §9 and R10 (an MCP server is a spec change), §12 (ids, never node paths)
- `constitution/kernel-v6.md` — Rule 22 (`systems_observe` events; every exception carries a written reason)
- `constitution/local-rules.md` — LR-05
- [ADR-0065](./0065-systems-atlas-and-impact-map.md) — the declared graph this is compared against
- [ADR-0066](./0066-agent-ready-change-discipline.md) — `which`, the hook, the doctor checks and the generated-file discipline this extends
- [ADR-0062](./0062-governance-regression-gate.md) — the zero-dependency, $0 gate this runs inside

## References

- The Director's request (2026-09-05): apply the recommendation, generate CODEOWNERS, keep systems accurate and compatible through develop/test/deploy; one repository or one per system, one MCP or one per system
- [`scripts/lib/fixtures/godot-sample/`](../scripts/lib/fixtures/godot-sample/) — the fixture project with planted violations
- GitHub Docs, *About code owners* — last-match semantics, teams and usernames as owners `[T2]`
