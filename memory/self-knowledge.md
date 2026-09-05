# Project Self-Knowledge

> Each agent has its own self-knowledge file in `agents/<name>/self-knowledge.md`. This file is the **project-level** self-knowledge — shared facts, project identity, working agreements.

---

## Project identity

- **Name:** `ember` (codename; lowercase-safe for paths)
- **Description:** A cooperative survival RPG for 2–10 players per server — gather, craft, build and fight through hostile stylized biomes with WoW-style systems (spells, gear tiers, status effects, quests, boss gates). Godot 4.x + GDScript. Governed by `GAME_INFRA_SPEC.md`; built on the Loom substrate cloned 2026-09-04.
- **Initialized:** `2026-09-04` (Loom template initialized `2026-06-14`)
- **Author:** Nick (the Director)
- **Data tier (default):** T0 (PUBLIC) unless otherwise noted
- **Upstream:** `loom-template` is fetch-only (LR-08); improvements flow Loom → EMBER, never back.

## Goals

1. Finish Phase 0 (studio setup) per spec §13 — engine pinned, gates G0–G3 green in CI, EventBus + schemas + converter + console, one sample of each noun.
2. Get DIRECTOR decisions on the atlas's open questions: repo layout (Godot root vs Loom folders), the Phase 0 console's dependencies (clock, inventory, spawning), the 12 proposed §5 signals (7 required by spec systems, 5 candidates), the §7.1 write-scope gaps (`actors/`, `audio/`, `data/npcs/`), and the 230 candidate systems.
3. Keep the systems atlas true: every change to `core/`, `data/`, `ui/`, `scenes/` starts with `checklist <id>` (the hook names the id), follows the runbook when one exists, and ends with the registry updated through `add-node` / `add-edge` and `render`.

## Working agreements

- Edits over rewrites
- ADRs for consequential choices
- Provenance tags on every non-trivial claim
- Confidence calibration on every output

## Known constraints

*(things that scope decisions — budget, hardware, deadlines)*

## Glossary (project-specific)

*(domain-specific terms; general Loom glossary is in Appendix A of the spec)*

---

*Update this file as the project's self-understanding evolves. The Memory-Keeper agent will surface it during retrieval.*
