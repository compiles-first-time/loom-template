# EMBER — Core Infrastructure Spec

> Codename **EMBER** (rename anytime — keep it lowercase-safe for file paths).
> Co-op survival RPG. Valheim-scale multiplayer, WoW-style systems, stylized look.

| Field | Value |
|---|---|
| Spec version | 0.1.0 |
| Status | Draft — adopted at Phase 0 |
| Current phase | Phase 0 (studio setup) |
| Owner | Nick (the Director) |
| Authority | This file is the **single source of truth**. CLAUDE.md and AGENTS.md are thin adapters that point here. On any conflict, this file wins. |

---

## 0. How to use this file

- **Agents:** read this file at the start of every session. When you make or refuse a change, cite the rule ID (R1, G2, etc.) that justifies it.
- **Humans:** sections 1–4 are the philosophy, 5–12 are the contracts, 13–14 are process. Skim tables first — they carry most of the meaning.
- Anything marked **DIRECTOR** is a decision only the human makes. Agents stop and ask.

---

## 1. Product definition

A cooperative survival RPG for **2–10 players per server**. Players gather, craft, build, and fight through hostile stylized biomes, progressing via WoW-style systems: spells, gear tiers, status effects, quests, and boss gates. Hardcore-leaning stakes. Third-person 3D.

**Hard constraints**

- Runs well on mid-range PCs. Windows + Linux desktop first.
- Stylized / non-photorealistic. One consistent art style enforced by a master shader.
- All game content is data (see R1). New content must never require engine-code changes.
- Solo-maintainable: every system must be understandable by one person + AI agents.

**Non-goals (do not build, do not prepare for)**

- MMO scale (thousands of concurrent players), sharding, matchmaking services.
- Photorealism, cutting-edge rendering research.
- Mobile or console ports (revisit after Phase 5).
- Prerendered video cutscenes. Story moments are in-engine.

---

## 2. Tech stack (pinned)

| Layer | Choice | Why | Notes |
|---|---|---|---|
| Engine | Godot 4.x (latest stable at setup) | Open source; scenes/resources are plain text; headless CLI; built-in small-scale multiplayer | Record the exact version in `docs/ENGINE_VERSION.txt` at Phase 0. Upgrading engine versions is a DIRECTOR decision. |
| Language | GDScript, **static typing required** | Lowest reading load; best agent-tool support | C# only if a hard dependency demands it (spec change required, R10) |
| Tests | GUT (Godot Unit Test) | Mature, headless-runnable, MCP-runner support exists | GdUnit4 is an acceptable alternative — pick ONE in Phase 0, never mix |
| Lint / format | gdtoolkit (`gdformat`, `gdlint`) | Deterministic style = clean diffs for agents | Run in CI (G0) |
| VCS | Git + GitHub | The content database (see §10) and the agent workspace | Trunk + short-lived branches; changes land via PR |
| CI | GitHub Actions | Runs gates G0–G3 on every PR | Workflow: `.github/workflows/gates.yml` |
| Agent bridge | godot-mcp (an MCP server for Godot) | Lets agents launch scenes, run tests, read debug output | Several implementations exist; Phase 0 task: pick one that supports *run project headless*, *capture debug output*, *run tests*, and record the choice + config here |

---

## 3. Repository layout

```
res://                      # the Godot project root
  addons/                   # third-party plugins (GUT, godot-mcp editor side, etc.)
  core/                     # SYSTEMS — the verbs. Code lives here and only here.
    events/event_bus.gd     #   the group chat between systems (§5)
    schemas/                #   Resource class definitions (ItemDef, SpellDef, ...)
    combat/                 #   damage, effects, casting
    survival/               #   hunger, stamina, day/night
    crafting/
    quests/
    saving/
    debug/console.gd        #   the GM console: give / spawn / tp (§13)
  data/                     # CONTENT — the nouns. Plain data only. NO code.
    items/    spells/    effects/    enemies/
    loot_tables/    recipes/    quests/    dialogue/    biomes/
    _inbox/                 #   raw JSON from generators, before conversion (§6)
  scenes/                   # levels and prefabs (.tscn)
  actors/                   # player / NPC scenes
  ui/                       # Control-node layouts (text, agent-editable)
  art/                      # models/ textures/ icons/ shaders/  (+ art/_inbox/)
  audio/
  tests/                    # unit/  integration/
  tools/                    # editor + pipeline scripts (import hook, validators)
docs/                       # this spec, lore_bible.md, art_bible.md, migrations.md
.claude/                    # Claude Code adapter home (skills/, agents/, settings)
.agents/                    # OpenHands skills home (skills/)
.github/workflows/          # CI
```

**Placement rule of thumb:** if it changes when you add a *new spell*, it belongs in `data/`. If it changes when you add a *new kind of thing spells can do*, it belongs in `core/`.

---

## 4. Architecture rules — the constitution

- **R1 — Systems/content split.** Code in `core/` never hardcodes content ("if item == sword"). Content in `data/` never contains logic. Systems read data and execute it. *(Kitchen staff and recipe cards: new dish = new card, never a new kitchen.)*
- **R2 — Event bus only.** Systems communicate exclusively by emitting/listening on `EventBus` (§5). No system calls another system directly. Allowed exceptions: parent↔child node calls inside a single scene, and pure utility/helper functions.
- **R3 — Plain text everything.** Scenes `.tscn`, resources `.tres`, config, data: text formats only, committed to Git. Binary files allowed only under `art/` and `audio/`.
- **R4 — Deterministic simulation.** Gameplay math is pure and seedable: RNG is passed in (`RandomNumberGenerator` with explicit seed), never `randf()` grabbed globally inside `core/`. No wall-clock time in simulation logic. Combat resolves on the fixed physics tick.
- **R5 — Simulation / presentation split.** Flow is always *input → simulate → present*. Presentation (VFX, sound, UI) reads state and reacts to events; it never mutates gameplay state. This is what makes server-authoritative multiplayer a Phase 4 upgrade instead of a rewrite.
- **R6 — Static typing + docstrings.** Every function has typed parameters and return values, and a one-line docstring saying what it does and which events it emits.
- **R7 — IDs.** Every content entry has a globally unique snake_case string id with a category prefix: `item_iron_sword`, `spell_fireball`, `enemy_greydwarf`, `quest_first_hunt`. IDs never change after shipping in a save file (add a new id + migration note instead).
- **R8 — Gates before done.** No task, PR, or agent turn is "done" until the gates for the current phase pass (§8).
- **R9 — Small diffs.** One concern per PR. Agents do not refactor outside the task's blast radius. If you notice unrelated debt, file it in `docs/tech_debt.md` instead of fixing it now.
- **R10 — No new dependencies without a spec change.** Adding an addon, library, service, or API requires a PR that also edits §2 or §9 of this file, approved by the DIRECTOR.
- **R-SEC1 — Secrets.** API keys live in environment variables / `.env` (gitignored). `.env.example` documents the names. Keys never appear in code, data, logs, or commits.

---

## 5. EventBus contract v1

**File:** `res://core/events/event_bus.gd`, registered as autoload `EventBus` (an autoload is Godot's term for a global script that is always loaded).

**The one rule (R-EB1):** adding, removing, or changing a signal requires updating this table *in the same PR*. The table below IS the API between systems.

| Signal | Payload | Emitted by | Typical listeners |
|---|---|---|---|
| `actor_spawned` | `actor_id: String, kind: String` | spawn system | quests, AI director |
| `actor_damaged` | `target_id: String, source_id: String, amount: float, damage_type: String` | combat | UI, VFX, AI |
| `actor_healed` | `target_id: String, source_id: String, amount: float` | combat | UI, VFX |
| `actor_died` | `actor_id: String, killer_id: String` | combat | quests, loot, XP, VFX |
| `spell_cast` | `caster_id: String, spell_id: String, target_id: String, target_pos: Vector3` | casting | VFX, SFX, AI |
| `effect_applied` | `target_id: String, effect_id: String, duration_s: float, source_id: String` | effects | UI (buff bars), VFX |
| `effect_expired` | `target_id: String, effect_id: String` | effects | UI |
| `item_acquired` | `actor_id: String, item_id: String, count: int` | inventory | quests, UI |
| `item_consumed` | `actor_id: String, item_id: String, count: int` | inventory | survival, UI |
| `item_crafted` | `actor_id: String, item_id: String, count: int, station_id: String` | crafting | quests, UI, SFX |
| `quest_started` | `quest_id: String` | quest system | UI, dialogue |
| `quest_objective_progressed` | `quest_id: String, objective_index: int, progress: int, required: int` | quest system | UI |
| `quest_completed` | `quest_id: String` | quest system | UI, rewards |
| `day_phase_changed` | `phase: String` (`dawn`/`day`/`dusk`/`night`) | world clock | lighting, spawns, AI |
| `world_saved` / `world_loaded` | `slot: String` | save system | UI |

**Phase 4 note:** in multiplayer these become server-emitted and replicated to clients. Designing around them now is the forward-compat move (§12).

---

## 6. Data schemas v1 — the nouns

**Conventions (all schemas):**

- Every def carries `id: String` (R7), `display_name: String`, `schema_version: int = 1`.
- Canonical storage: Godot custom Resources (`.tres`) whose `class_name` scripts live in `res://core/schemas/`.
- External generators (agents, asset APIs) may drop **JSON** into `data/_inbox/`; the tool `tools/json_to_tres.gd` converts and files them. Agents run the converter; humans never hand-convert.
- Referential integrity is enforced by gate **G2** (§8): every referenced id, icon path, and model path must exist.
- Schema changes bump `schema_version` and get a note in `docs/migrations.md`.

### 6.1 ItemDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id / display_name / schema_version | — | ✔ | conventions above |
| description | String | ✔ | flavor + function, 1–2 sentences |
| icon | String (path) | ✔ | `res://art/icons/items/<id>.png` |
| model | String (path) |  | world/equip mesh; empty = icon-only item |
| stack_size | int | ✔ | 1 for equipment |
| weight | float | ✔ | kg |
| rarity | enum: common/uncommon/rare/epic | ✔ | drives UI color |
| slot | enum: none/head/chest/legs/hands/feet/main_hand/off_hand/trinket | ✔ | `none` = not equippable |
| tags | Array[String] |  | `weapon`, `food`, `ore`, ... |
| stats | Dictionary |  | e.g. `{ "damage": 12, "armor": 0, "attack_speed": 1.2 }` |
| on_use_effect | String (effect id) |  | for consumables |

### 6.2 RecipeDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id, schema_version | — | ✔ | |
| output_item | String (item id) | ✔ | |
| output_count | int | ✔ | |
| station | String | ✔ | `hands`, `workbench`, `forge`, ... |
| inputs | Array[{item_id: String, count: int}] | ✔ | |
| craft_time_s | float | ✔ | |
| unlocked_by | String |  | quest id or item id that unlocks it; empty = known from start |

### 6.3 SpellDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id / display_name / schema_version / description / icon | — | ✔ | |
| cast_time_s | float | ✔ | 0 = instant |
| cooldown_s | float | ✔ | |
| cost | {resource: String, amount: float} | ✔ | resource: `mana`/`stamina`/`health` |
| range_m | float | ✔ | |
| delivery | enum: projectile/beam/self/target/ground_aoe | ✔ | each enum value = a verb that exists in `core/combat/` |
| effects | Array[{effect_id: String, magnitude: float}] | ✔ | what lands on the target(s) |
| projectile_speed | float |  | delivery=projectile only |
| aoe_radius_m | float |  | delivery=ground_aoe only |
| vfx / sfx | String (path) |  | empty = default per element |
| element | enum: physical/fire/frost/nature/arcane/shadow | ✔ | drives resistances + default VFX |

### 6.4 StatusEffectDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id / display_name / schema_version / icon | — | ✔ | |
| kind | enum: dot/hot/stat_mod/stun/slow/shield | ✔ | each = a verb in `core/combat/effects` |
| magnitude | float | ✔ | damage per tick, % slow, shield amount... |
| tick_interval_s | float |  | dot/hot only |
| duration_s | float | ✔ | |
| stacking | enum: none/refresh/stack_count | ✔ | |
| element | enum (as SpellDef) | ✔ | |

### 6.5 EnemyDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id / display_name / schema_version | — | ✔ | |
| scene | String (path) | ✔ | the actor prefab |
| health / damage / armor | float | ✔ | |
| move_speed | float | ✔ | m/s |
| behavior | enum: passive/territorial/aggressive/pack | ✔ | each = an AI verb |
| loot_table | String (loot table id) | ✔ | |
| xp | int | ✔ | |
| biomes | Array[String] | ✔ | where it may spawn |
| day_phases | Array[String] |  | empty = any |

### 6.6 LootTableDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id, schema_version | ✔ | | |
| entries | Array[{item_id: String, weight: float, min: int, max: int}] | ✔ | weights are relative |
| guaranteed | Array[{item_id: String, count: int}] |  | always drops |

### 6.7 QuestDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id / display_name / schema_version | — | ✔ | |
| giver_npc | String |  | empty = auto-granted |
| prereqs | Array[String] (quest ids) |  | |
| objectives | Array[{type: enum kill/collect/reach/talk/craft, target_id: String, count: int}] | ✔ | `target_id` must resolve per type (enemy id, item id, marker id, npc id, item id) |
| rewards | {xp: int, items: Array[{item_id, count}]} | ✔ | |
| dialogue | String (dialogue id) |  | |
| journal_text | String | ✔ | what the player reads |

### 6.8 DialogueDef
| Field | Type | Req | Notes |
|---|---|---|---|
| id, schema_version | ✔ | | |
| nodes | Array[{node_id: String, speaker: String, text: String, choices: Array[{text: String, goto: String, condition: String}]}] | ✔ | `goto: "end"` terminates; `condition` is a simple expression over quest/item state (grammar defined in Phase 3) |

### 6.9 Worked example — a generator's JSON for Fireball (lands in `data/_inbox/`)
```json
{
  "schema": "SpellDef", "schema_version": 1,
  "id": "spell_fireball", "display_name": "Fireball",
  "description": "Hurls a searing orb that ignites the target.",
  "icon": "res://art/icons/spells/spell_fireball.png",
  "cast_time_s": 1.5, "cooldown_s": 6.0,
  "cost": { "resource": "mana", "amount": 20 },
  "range_m": 25.0, "delivery": "projectile", "projectile_speed": 18.0,
  "element": "fire",
  "effects": [
    { "effect_id": "effect_direct_fire", "magnitude": 40 },
    { "effect_id": "effect_burning", "magnitude": 4 }
  ]
}
```
`tools/json_to_tres.gd` validates this against 6.3, converts it, and files it at `data/spells/spell_fireball.tres`. Hot-reload makes it castable immediately via the debug console. **This loop is the whole point of the architecture.**

---

## 7. Agent roster, permissions, and skills

### 7.1 Roster

| Agent | Mission | May write | Never touches | Definition of done |
|---|---|---|---|---|
| **orchestrator** | Plan, delegate, review, merge | Anywhere, via PR | Secrets, force-push, engine version | All gates green; spec updated if any contract (§5/§6/§7/§8) changed |
| **content-smith** | Turn plain-English requests into balanced ItemDef/SpellDef/EffectDef/EnemyDef/LootTable data | `data/**`, generated icons into `art/icons/**`, `docs/changelog.md` | `core/**`, `scenes/**` | G1 + G2 pass; new ids listed in the PR description |
| **world-builder** | Compose scenes, terrain, biomes, placement | `scenes/**`, `art/**` placement, `data/biomes/**` | `core/**` gameplay logic | Scene loads headless with zero errors (G3); screenshot attached |
| **quest-writer** | Quests, dialogue, lore consistent with `docs/lore_bible.md` | `data/quests/**`, `data/dialogue/**`, `docs/lore/**` | `core/**`, combat data | G2 passes; every objective target_id resolves; reads in the lore voice |
| **test-pilot** | Author and run tests, bot playthroughs, screenshot reviews; triage failures | `tests/**`, `tools/testing/**`, `.github/workflows/**` | Game code (proposes fixes as suggestions for orchestrator) | New tests deterministic (seeded, R4); no flaky tests merged |

**Permission enforcement:** the orchestrator rejects any diff that steps outside an agent's "may write" column, citing this table.

### 7.2 Skill definitions (portable)

The four blocks below use the cross-harness Agent Skills format (folder name = skill name; `SKILL.md` with `name` + `description` frontmatter). **Phase 0 task:** materialize each block to `.claude/skills/<name>/SKILL.md` (Claude Code) and `.agents/skills/<name>/SKILL.md` (OpenHands). Same content, two mailboxes.

```markdown
---
name: content-smith
description: Create or balance game content (items, spells, effects, enemies, loot tables, recipes) as data files from a plain-English request. Use whenever the Director asks for new spells, weapons, armor, enemies, drops, or stat tuning.
---
Inputs: the request, GAME_INFRA_SPEC.md §6 schemas, docs/art_bible.md, existing data/ for balance reference.
Procedure:
1. Read 3–5 comparable existing defs to anchor numbers. State your balance reasoning in one short paragraph.
2. Emit JSON to data/_inbox/ matching the schema exactly (§6). One file per def. Ids follow R7.
3. Run tools/json_to_tres.gd, then gate G2, then G1.
4. If an icon is missing, write a one-line generation prompt for it into art/_inbox/icon_requests.md and use res://art/icons/_placeholder.png until it exists.
Output contract: PR containing the .tres files, the inbox JSON removed, new ids listed, gates output pasted.
Self-check: Does every enum value already exist as a verb in core/? If not, STOP — that is a systems request for the orchestrator, not content (R1).
```

```markdown
---
name: world-builder
description: Build or edit scenes, terrain, biomes, and placement in the Godot project. Use for landscape, dungeon, village, spawn-point, and set-dressing requests.
---
Inputs: the request, scenes/, data/biomes/, docs/art_bible.md (palette + proportions), §11 art contract.
Procedure:
1. Work in .tscn text or via the godot-mcp scene tools. Reuse existing prefabs before creating new ones.
2. Respect §11: 1 unit = 1 meter; every mesh passes the import hook (collision + master material auto-applied).
3. Boot the scene headless (G3) and capture a screenshot set for review.
Output contract: PR with the scene diff + screenshots + a 3-line description of what changed and why.
Self-check: Zero errors/warnings in the headless log; no hardcoded gameplay logic added to scene scripts (R1/R2).
```

```markdown
---
name: quest-writer
description: Write quests, dialogue trees, and lore entries as data files in the game's voice. Use for any story, quest chain, NPC dialogue, or lore request.
---
Inputs: the request, docs/lore_bible.md, data/quests/ + data/dialogue/ for voice reference, §6.7–6.8 schemas.
Procedure:
1. Re-read the lore bible section relevant to the region/NPC. Match its voice; never contradict established facts — propose lore additions in docs/lore/ instead.
2. Emit QuestDef + DialogueDef JSON to data/_inbox/; every objective target_id must reference an existing enemy/item/marker/npc id.
3. Convert, then run G2. Read the dialogue aloud-in-your-head test: would a player skip this? Tighten until no.
Output contract: PR with quest + dialogue .tres, journal text under 60 words per entry, gates output pasted.
Self-check: Do prereq chains form a DAG (no cycles)? Does every reward item exist?
```

```markdown
---
name: test-pilot
description: Write and run tests, headless smoke runs, scripted bot playthroughs, and screenshot reviews; triage failures into actionable reports. Use after any merge, before any release, or when the Director says "test it".
---
Inputs: the change under test, tests/, tools/testing/, §8 gates.
Procedure:
1. For new verbs in core/: add GUT unit tests with seeded RNG (R4). Property-style checks preferred for math (damage, loot weights).
2. Run gates in order G0→G3 (plus G4/G5 when phase ≥ 1). Never mark done on a red gate (R8).
3. On failure: minimal repro, suspected file, and one-paragraph diagnosis. File as an issue for the orchestrator; do not fix game code yourself.
4. For screenshot review: capture the standard camera set, compare against art_bible palette, flag anything broken/clipping/off-palette.
Output contract: gate results table + failures triaged with repro steps.
Self-check: Would this test pass 100/100 runs? If not, it does not merge.
```

---

## 8. Validation gates — the QA line

| Gate | What | How (canonical command — verify exact flags against the installed Godot version in Phase 0 and pin them here) | Blocking? |
|---|---|---|---|
| **G0** | Parse, format, import | `gdformat --check .` + `gdlint .` + headless import/script check | ✔ |
| **G1** | Unit tests | `godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit` | ✔ |
| **G2** | Data integrity | `godot --headless -s tools/validate_data.gd` — unique ids, all references resolve, icon/model paths exist, enum values legal, numbers within `docs/balance_ranges.md` | ✔ |
| **G3** | Smoke | Boot main scene headless 30 s; exit code 0; zero `ERROR` lines in log | ✔ |
| **G4** | Bot playtest (Phase 1+) | Scripted inputs: walk, gather, craft, fight one enemy; assert HP/inventory outcomes; assert player never falls through floor | ✔ from Phase 1 |
| **G5** | Vision review (Phase 1+) | Standard screenshot set → model review against art bible | Advisory |

CI (`.github/workflows/gates.yml`) runs G0–G3 on every PR. "Done" = current phase's blocking gates green (R8).

---

## 9. MCP servers, APIs, and secrets

- **`.mcp.json`** (repo root — Claude Code project scope) declares the godot-mcp server chosen in Phase 0. OpenHands users configure the same server in the app's MCP settings. Record the final config block here once chosen.
- **Asset-generation APIs** (e.g., Meshy/Tripo for 3D props, Scenario/SD for icons): called **only** from scripts in `tools/`, keys from env (R-SEC1), outputs land in `data/_inbox/` or `art/_inbox/` and enter the game only through the import pipeline (§11) — never hand-placed.
- No other external services exist. Adding one = spec change (R10).

---

## 10. Databases & persistence policy

| Phase | Persistence | Why |
|---|---|---|
| 0–3 | **Files only.** Content = `data/` in Git (Git *is* the content database: diffable, mergeable, agent-editable, time-travel included). Saves = JSON at `user://saves/<slot>/world.json` via `core/saving/` | Databases are none of those things; they would only slow the agent loop down |
| 4 | **SQLite** (godot-sqlite addon), one file per dedicated-server world: world state, player inventories, placed structures | Concurrent writes + crash safety once a real server exists |
| Later (only with spec change) | Cloud DB (e.g., Postgres/Supabase) **only if** accounts, cross-server characters, or leaderboards become real features | Until then it is pure overhead |

Save-file rule: saves store content **ids + state**, never copies of defs — so content patches apply to old saves (R7).

---

## 11. Art pipeline contract

- **Units:** 1 unit = 1 meter. Player capsule = 1.8 m. Door openings ≥ 2.2 m.
- **Import hook:** `tools/import_post.gd` runs on every imported mesh: normalize scale, generate collision (convex for props, trimesh for terrain), assign `art/shaders/toon_master.tres`. Built once in Phase 1; after that, "import/scale/collision/material" is automatic.
- **Style lock:** one master toon material + the palette in `docs/art_bible.md` (8 base colors + light/dark ramps). Any asset from any source passes through both → cohesion.
- **Icons:** 256×256 PNG, transparent background, path `res://art/icons/<category>/<id>.png` — filename **must equal** the content id (G2 checks this).
- **Model naming:** `art/models/<category>/<id>.glb`.

---

## 12. Multiplayer forward-compatibility (cheap now, priceless in Phase 4)

- All gameplay state lives in serializable data (dictionaries/resources), never only in node properties.
- Logic references actors by **id**, never by node path.
- Simulation advances on the fixed physics tick (R4).
- Player actions enter the sim as **command events** ("intent: cast spell_fireball at pos") — exactly the shape a server will receive from clients later.

---

## 13. Phases & current checklist

**Phase map:** 0 setup → 1 feel (gray-box island, controller, one enemy, one weapon) → 2 data spine (schemas live, hot-reload, console) → 3 survival loop (gather/craft/build/day-night/save) → 4 multiplayer (dedicated server, ~10 players) → 5 content factory (agents at scale).

**Phase 0 checklist (current):**

- [ ] Godot installed; empty project boots; exact version pinned in `docs/ENGINE_VERSION.txt`
- [ ] Repo initialized with the §3 layout; this spec + CLAUDE.md + AGENTS.md committed
- [ ] GUT (or GdUnit4 — DIRECTOR picks) installed; one trivial passing test
- [ ] gdtoolkit installed; G0 runs locally
- [ ] godot-mcp implementation chosen, configured in `.mcp.json`, config recorded in §9
- [ ] `EventBus` autoload created with the §5 signals (empty listeners are fine)
- [ ] Schema scripts for §6 created; `tools/json_to_tres.gd` + `tools/validate_data.gd` working
- [ ] One sample of each noun (1 item, 1 recipe, 1 spell, 1 effect, 1 enemy, 1 loot table, 1 quest, 1 dialogue) passing G2
- [ ] Debug console: `give <item_id> [n]`, `spawn <enemy_id> [n]`, `tp <x> <y> <z>`, `time <phase>`
- [ ] Skills materialized to `.claude/skills/` and `.agents/skills/`
- [ ] CI workflow running G0–G3 green on GitHub
- [ ] `docs/lore_bible.md` + `docs/art_bible.md` drafted (1–2 pages each — DIRECTOR writes the first pass, agents polish)

---

## 14. Change control

- This spec is versioned. Contract changes (§5 bus, §6 schemas, §7 roster, §8 gates, §2/§9 dependencies) require a PR that edits this file, with rationale, approved by the DIRECTOR.
- Agents must refuse tasks that violate the spec and cite the rule id. "The Director asked" does not override the spec — it triggers a spec-change conversation instead.

---

## Appendix A — Bootstrap prompt (paste into any harness, inside the repo)

> Read `GAME_INFRA_SPEC.md` in full. You are the **orchestrator** (§7.1). Execute the Phase 0 checklist (§13) top to bottom. Work in small commits, run the gates (§8) after each step, and stop to ask whenever you hit a DIRECTOR decision or anything ambiguous. Start by restating the checklist as your plan with time estimates.

## Appendix B — Harness mapping

| Concern | Claude Code | OpenHands | Other harnesses (LOOM variants, custom) |
|---|---|---|---|
| Always-loaded memory | `CLAUDE.md` (repo root) | `AGENTS.md` (repo root; legacy `.openhands/microagents/repo.md` also read) | Feed this spec as system context |
| Skills | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` | Plain markdown SOPs — same files |
| Subagents | `.claude/agents/*.md` (optional refinement) | Delegated tasks | Framework-native |
| MCP | `.mcp.json` (repo root) | App MCP settings | Varies; same godot-mcp server |
