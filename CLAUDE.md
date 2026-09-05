# CLAUDE.md — EMBER

> **Project:** `ember` — co-op survival RPG (2–10 players per server), WoW-style systems, stylized, hardcore-leaning. **Godot 4.x + GDScript.**
> **Substrate:** Loom 1.0.0 · Kernel v6 · cloned from `loom-template` on `2026-09-04`. **LR-08:** never push to the template; upstream is fetch-only.
> **The law lives in [`GAME_INFRA_SPEC.md`](./GAME_INFRA_SPEC.md).** Read it before your first action each session. On any conflict the spec wins over this file. Cite rule ids (R1, G2…) when you act or refuse. Anything marked **DIRECTOR** is Nick's decision: stop and ask. Ambiguity: ask, don't guess.

This file is the entry point for Claude and Claude Code. Hard cap ~10 KB — detail lives in the spec, [`systems/`](./systems/), and [`layers/`](./layers/).

## Non-negotiables (digest — full text in spec §4)

1. Systems (`core/`) vs content (`data/`): content is data; code never hardcodes content. (R1)
2. Cross-system communication only via the `EventBus` autoload; its signal table is spec §5 and changes ship in the same PR (R2, R-EB1). The atlas checks this mechanically.
3. Plain-text formats everywhere except `art/` and `audio/`. (R3)
4. Deterministic sim: seeded RNG passed in, fixed-tick combat, no wall-clock in `core/`. (R4)
5. Input → simulate → present; presentation never mutates gameplay state. (R5)
6. Static typing + one-line docstrings. (R6) · Ids `snake_case`, category-prefixed, immutable once shipped. (R7)
7. Nothing is done until the current phase's gates pass. (R8) · Small diffs; park debt in `docs/tech_debt.md`. (R9)
8. New dependency, addon, service or API ⇒ spec-change PR first. (R10) · Secrets only via env. (R-SEC1)

## Session ritual

- **Start:** spec §13 (current phase + checklist), the tail of `docs/changelog.md`, and `scripts/systems-map.sh validate`.
- **Before editing `core/`, `data/`, `ui/` or `scenes/`:** the PreToolUse hook names the system you are opening; run `scripts/systems-map.sh checklist <id>` (or [`/impact <id>`](./.claude/commands/impact.md)) — what to touch, check and run, in order — and follow the runbook it names ([`systems/runbooks/`](./systems/runbooks/)). Paste the hard rows into the PR ([ADR-0065](./adr/0065-systems-atlas-and-impact-map.md), [ADR-0066](./adr/0066-agent-ready-change-discipline.md)).
- **End of any task:** run the gates, paste results, one line in `docs/changelog.md`, commit via PR. Stay inside your role's write scope (spec §7.1).

## Commands (verify flags once in Phase 0, then pin here)

```bash
gdformat --check . && gdlint .                                              # G0 style
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit   # G1 unit
godot --headless -s tools/validate_data.gd                                  # G2 data integrity
godot --headless res://scenes/main.tscn                                     # G3 smoke (30s, no ERROR lines)
godot --headless -s tools/json_to_tres.gd                                   # data/_inbox JSON → .tres
scripts/systems-map.sh checklist <id>   # also: which <path> | impact | runbook <rb_id> | audit-diff | validate | render  (ADR-0065/0066)
scripts/systems-map.sh add-node … | add-edge …   # registry edits that validate and revert; generated systems/ files are never hand-edited
bash scripts/doctor.sh && npm test                                          # Loom governance
```

## Write scopes (spec §7.1 — enforced on every diff)

| Role | May write | Never |
|---|---|---|
| orchestrator | anywhere, via PR | secrets, force-push, engine version |
| content-smith | `data/**`, `art/icons/**`, changelog | `core/**`, `scenes/**` |
| world-builder | `scenes/**`, `art/**`, `data/biomes/**` | `core/**` logic |
| quest-writer | `data/quests/**`, `data/dialogue/**`, `docs/lore/**` | `core/**`, combat data |
| test-pilot | `tests/**`, `tools/testing/**`, workflows | game code (suggest fixes only) |

Skills for the four game roles: `.claude/skills/<name>/SKILL.md` (materialize from spec §7.2 — a Phase 0 item). Loom's governance agents: [`AGENTS.md`](./AGENTS.md).

## The systems atlas ([ADR-0065](./adr/0065-systems-atlas-and-impact-map.md), [ADR-0066](./adr/0066-agent-ready-change-discipline.md))

[`systems/registry/*.md`](./systems/registry/) is the ledger: **715 systems in 16 domains** (tier 1 domain → 2 system → 3 parts), **1,171 wired edges**, each with how / via / strength / why. Status tells scope: `spec` · `implied` · **`candidate` = asked for but not in the spec → DIRECTOR decision + spec PR** · `non-goal`. [`systems/runbooks/`](./systems/runbooks/) holds **17 change runbooks**, each validated against the ledger: every system id exists and every hard downstream of the runbook's primary system is a step or an explained "not touched". For a model: [`systems/llm/`](./systems/llm/) (JSONL + a README written for LLMs — grep it, never load it whole). For a person: [`systems/ATLAS.md`](./systems/ATLAS.md) and [`systems/explorer.html`](./systems/explorer.html). Generated files are never hand-edited (the hook denies it); `loom doctor` fails on a broken or stale atlas.

## Current focus

**Phase 0 — studio setup.** Work spec §13 top to bottom. Bootstrap prompt: spec Appendix A. The atlas is the map of everything that comes after.

## Open questions (blocking — DIRECTOR)

- **Repo layout:** the Godot project root (`res://`) and Loom's governance folders share this root. Add `.gdignore` to `adr/`, `layers/`, `scripts/`, `systems/` and the rest so Godot ignores them, or move the game under `game/`? Also §3 lists no `data/building`, `data/npcs`, `data/encounters`, `data/markers`, `data/dungeons`, `data/stations` or `server/`, which the atlas needs — amend §3.
- **Phase 0 console:** `give`, `spawn`, `tp`, `time` need inventory (P2), spawning (P1), the actor registry (P1) and the clock (P3) — the four open findings in `validate`. Stub them in Phase 0, or move the console to Phase 2 (where §13's phase map already puts it)?
- **12 proposed signals** need §5 rows (R-EB1): 7 are required (spec/implied systems emit them), 5 are candidates — names in `systems/ATLAS.md` §EventBus and in `scripts/systems-map.sh validate`.
- **LR-08 (escalated by the Critic):** the seed branch received pushes after the founding one; the exception allowing that is a *proposal* in `constitution/local-rules.md`, deviations logged, until you ratify or reject it with a dated line.
- **Spec seams the atlas found:** §7.1 grants nobody `actors/**`, `audio/**`, `data/npcs/**`, `data/dungeons/**`, `data/markers/**`; §7.2 has content-smith write `art/_inbox/icon_requests.md`, which §7.1 does not grant; §8 runs G4's gather/craft from Phase 1 while §13 lands them in Phase 3. Amend the spec, or reassign owners in the registry.
- **230 candidate systems** — asked for, not in the spec; none is built until it is. Decide by domain in `systems/ATLAS.md` §DIRECTOR decisions.

## Loom governance (inherited — read L0 before any consequential action)

| Layer | File | When to read |
|---|---|---|
| L0 Constitutional | [L0](./layers/L0-constitutional.md) | before consequential actions |
| L1 Skeleton | [L1](./layers/L1-skeleton.md) | adding or moving files |
| L2 Agents · L3 Memory · L4 Tooling | [L2](./layers/L2-agents.md) · [L3](./layers/L3-memory.md) · [L4](./layers/L4-tooling.md) | agents · memory · MCP |
| L5 Orchestration · L6 Observability | [L5](./layers/L5-orchestration.md) · [L6](./layers/L6-observability.md) | task flows · debugging |
| L7 Extension · L8 Discovery · L9 Observatory | [L7](./layers/L7-extension.md) · [L8](./layers/L8-discovery.md) · [L9](./layers/L9-observatory.md) | self-change · onboarding · monitoring |

**Constitutional baseline** ([kernel v6](./constitution/kernel-v6.md), [local rules](./constitution/local-rules.md)): Rule 1 authorship · Rule 2 no unconsented narrowing · Rule 8 anti-paternalism · Rule 19 self-modification only by transparent consent · Rule 20 destructive ops need confirmation · Rule 22 every claim has provenance, every action a trace · LR-08 upstream isolation.

**Confidence calibration:** `<60%` stop and gather · `60–80%` human oversight · `80–95%` proceed and log · `>95%` autonomous. Always be ready to answer *what would raise confidence to 95%?* Use [`/claim`](./.claude/commands/claim.md) for non-trivial claims (provenance-capped, [ADR-0060](./adr/0060-claim-provenance-verification.md)).

**Working agreements:** edits over rewrites · no new files unless necessary · ADRs for consequential choices ([`adr/`](./adr/)) · lessons-learned for failures ([`lessons-learned/`](./lessons-learned/)) · verification-first (verifier gates, [ADR-0044](./adr/0044-verifier-gates-for-agent-tasks.md)) · an unchecked convention drifts — measured, not assumed · token-cost awareness ([LR-06](./constitution/local-rules.md#lr-06)) · specialists are invoked per [ADR-0034](./adr/0034-specialist-invocation-discipline.md) path 2b; credentials are acquired per [ADR-0042](./adr/0042-credential-setup-specialist.md) · a fresh session regenerates its handoff with `/handoff` ([ADR-0031](./adr/0031-handoff-maintenance-policy.md)) · the spec is model-agnostic and harness-adapted ([ADR-0048](./adr/0048-north-star-model-agnostic-spec-and-adapters.md)).

## ADRs in flight

- [ADR-0065](./adr/0065-systems-atlas-and-impact-map.md) — Systems atlas: validated registry + computed impact map. **Awaiting DIRECTOR review.**
- [ADR-0066](./adr/0066-agent-ready-change-discipline.md) — Agent-ready change discipline: runbooks, path→system resolver, checklist, registry mutation API, LLM pack, PreToolUse edit guard. **Awaiting DIRECTOR review.**
- [ADR-0057](./adr/0057-research-scout-update-bus-intake.md) — Research Scout (inherited from Loom, proposal-only; the weekly trigger stays un-armed).

Accepted ADRs inherited from Loom: 0003–0064 — index in [`adr/`](./adr/).
