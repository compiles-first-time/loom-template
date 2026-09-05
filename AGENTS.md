# AGENTS.md — EMBER agent roster (universal / OpenHands / Loom)

> Project `ember` · Godot 4.x + GDScript · **The law lives in `GAME_INFRA_SPEC.md`** — read it first each session; the spec wins on conflict; cite rule ids. This file is a thin adapter: how any harness plugs in. Hard cap ~5 KB.

## Game roles (spec §7.1) — write scopes enforced on every diff

| Role | Mission | May write | Never |
|---|---|---|---|
| **orchestrator** | plan, delegate, review, merge | anywhere, via PR | secrets, force-push, engine version |
| **content-smith** | items, spells, effects, enemies, loot, recipes as data | `data/**`, `art/icons/**`, changelog | `core/**`, `scenes/**` |
| **world-builder** | scenes, terrain, biomes, placement | `scenes/**`, `art/**`, `data/biomes/**` | `core/**` logic |
| **quest-writer** | quests, dialogue, lore | `data/quests/**`, `data/dialogue/**`, `docs/lore/**` | `core/**`, combat data |
| **test-pilot** | tests, bot playthroughs, screenshot review, triage | `tests/**`, `tools/testing/**`, workflows | game code (suggest fixes) |

Skills use the portable Agent Skills format — `SKILL.md` with `name` + `description`. Claude Code reads `.claude/skills/<name>/`; OpenHands reads `.agents/skills/<name>/`. Materialize both from spec §7.2 (a Phase 0 item) and keep the two directories identical.

## Workflow contract (any harness)

- **Start:** spec §13 (phase + checklist), the tail of `docs/changelog.md`, `scripts/systems-map.sh validate`.
- **Before touching `core/`, `data/`, `ui/`, `scenes/`:** the PreToolUse hook names the system you are opening; `scripts/systems-map.sh checklist <id>` says what to touch, check and run, and which runbook in `systems/runbooks/` to follow ([ADR-0065](./adr/0065-systems-atlas-and-impact-map.md), [ADR-0066](./adr/0066-agent-ready-change-discipline.md)). Candidates in the blast radius are unapproved. Registry edits go through `add-node` / `add-edge` (they validate and revert); generated `systems/` files and `.github/CODEOWNERS` are never hand-edited. `audit-diff` and `observe --strict` (code versus ledger, R2–R6 checks, [ADR-0067](./adr/0067-declared-versus-observed.md)) before the PR.
- **End of task:** run the gates (spec §8: G0 style, G1 GUT, G2 data, G3 smoke; G4/G5 from Phase 1), paste results, one changelog line, commit via PR.
- **DIRECTOR** items: stop and ask Nick. Ambiguity: ask, don't guess.
- **MCP:** the godot-mcp server (`.mcp.json`; chosen in Phase 0, recorded in spec §9) runs scenes headless, captures output, runs GUT. Prefer live runs over guessing from `.tscn` text.

## Loom governance agents (the warp — present in every Loom project)

Design at `agents/<name>/SKILL.md`, runtime at `.claude/agents/<name>.md` ([ADR-0012](./adr/0012-base-subagents.md)). Supervisor pattern: Magentic-One two-ledger ([`orchestration/`](./orchestration/)).

| Agent | Role |
|---|---|
| HR-Agent | the roster; registers and retires agents |
| EAC | researches a domain, writes a specialist skill, hands to HR |
| Human Replica | decides below Nick's escalation bar; always logs reasoning |
| Critic / Auditor | read-only quality gate before consequential commits |
| Memory-Keeper | every read and write to project memory |
| Requirements Analyst | elicitation gate until a register is mechanically complete ([ADR-0061](./adr/0061-requirements-register-role-and-verifier-fields.md)) |
| Constitution Service | read-only validator against Kernel v6 + local rules |
| Research Scout | weekly update-bus intake, proposal-only ([ADR-0057](./adr/0057-research-scout-update-bus-intake.md), proposed) |

Specialists (`agents/specialists/`) are spawned by the EAC per named need in an approved plan ([ADR-0064](./adr/0064-decompose-gated-pipeline.md)), dispatched by recorded reputation ([ADR-0053](./adr/0053-agent-reputation-and-dispatch.md)), and retired at end of lifecycle; their lessons persist in [`lessons-learned/`](./lessons-learned/). No agent-to-agent traffic across project boundaries — it goes through the Human Replica. **LR-08:** this project never pushes to `loom-template`.

*Detail per agent lives in its SKILL.md. This file is the index.*
