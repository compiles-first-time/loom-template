# Narrative — the storyteller's notebook and the town notice board

> **Analogy:** the errand board with checklists (quests), a choose-your-own-adventure page (dialogue), the show bible writers must obey (lore), the first-day orientation tour (onboarding), seasonal festivals on the town calendar (live events), and a scene staged live rather than filmed (in-engine story moments).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| narrative | Narrative | 1 | — | 2 | spec | quest-writer/orchestrator | core/quests/; core/dialogue/; data/quests/; data/dialogue/; docs/lore_bible.md | §6.7, §6.8 | Quests, dialogue, lore, onboarding, live events, in-engine story moments | The storyteller's notebook and the town notice board |
| quests | Quest system | 2 | narrative | 2 | spec | orchestrator/quest-writer | core/quests/; data/quests/ | §6.7, §5 quest_started, quest_objective_progressed, quest_completed | Definitions, objective types, tracking, prerequisites, rewards, journal | The errand board with checklists |
| quest_defs | Quest definitions | 3 | quests | 0 | spec | quest-writer | data/quests/ | §6.7 | giver_npc, prereqs, objectives, rewards, dialogue, journal_text | — |
| objective_types | Objective types | 3 | quests | 2 | spec | orchestrator | core/quests/objectives.gd | §6.7 objectives.type | kill, collect, reach, talk, craft; each resolves its target_id against a different content type | — |
| objective_tracking | Objective tracking | 3 | quests | 2 | spec | orchestrator | core/quests/tracker.gd | §5 quest_objective_progressed | Listens to the world, counts progress, emits progress events | — |
| prereq_dag | Prerequisite graph | 3 | quests | 2 | spec | orchestrator | core/quests/prereqs.gd | §6.7 prereqs | Prerequisite chains must form a DAG; cycles are a G2 failure | — |
| quest_rewards | Quest rewards | 3 | quests | 2 | spec | orchestrator | core/quests/rewards.gd | §6.7 rewards | XP and items granted on completion | — |
| quest_journal_text | Journal text | 3 | quests | 0 | spec | quest-writer | data/quests/ | §6.7 journal_text | What the player reads; under 60 words in the lore voice | — |
| quest_chains | Quest chains | 3 | quests | 2 | implied | quest-writer | data/quests/ | §6.7 prereqs | Multi-quest arcs expressed through prerequisites | — |
| shared_group_quests | Shared group quests | 3 | quests | 4 | implied | orchestrator | core/quests/shared.gd | §1 co-op | Whether progress is shared or per player in a party | — |
| repeatable_daily_quests | Repeatable quests | 3 | quests | — | candidate | director | core/quests/ | — | Quests that reset on the clock | — |
| dialogue | Dialogue system | 2 | narrative | 3 | spec | quest-writer/orchestrator | core/dialogue/; data/dialogue/ | §6.8 | Trees with conditional choices, run from intents | A choose-your-own-adventure page |
| dialogue_nodes_choices | Dialogue trees | 3 | dialogue | 0 | spec | quest-writer | data/dialogue/ | §6.8 | nodes with speaker, text and choices; goto end terminates | — |
| dialogue_conditions | Dialogue conditions | 3 | dialogue | 3 | spec | orchestrator | core/dialogue/conditions.gd | §6.8 condition | Choices gated by conditions over quest and item state | — |
| dialogue_runner | Dialogue runner | 3 | dialogue | 3 | implied | orchestrator | core/dialogue/runner.gd | §6.8 | Walks the tree from choice intents; sets flags through quests, never directly | — |
| barks_ambient_lines | Barks | 3 | dialogue | — | candidate | quest-writer | data/dialogue/ | — | One-liners NPCs say in passing | — |
| voice_acting | Voice acting | 3 | dialogue | — | candidate | director | audio/voice/ | — | Recorded lines | — |
| lore | Lore | 2 | narrative | 0 | spec | quest-writer/director | docs/lore_bible.md; docs/lore/ | §13 Phase 0, §7.2 | The bible, its proposed additions, naming, and a candidate codex | The show bible writers must obey |
| lore_bible | Lore bible | 3 | lore | 0 | spec | director | docs/lore_bible.md | §13 | The Director writes the first pass; agents polish, never contradict | — |
| lore_additions | Lore additions | 3 | lore | 0 | spec | quest-writer | docs/lore/ | §7.2 | Proposed additions filed for approval instead of contradicting the bible | — |
| naming_conventions_lore | Naming conventions | 3 | lore | 0 | implied | quest-writer | docs/lore_bible.md | — | Names of places, factions and people that ids and display names follow | — |
| lore_entries_codex | Codex entries | 3 | lore | — | candidate | quest-writer | data/lore/ | — | Discoverable in-game lore entries | — |
| onboarding_tutorial | Onboarding & tutorial | 2 | narrative | — | candidate | quest-writer/orchestrator | data/quests/; ui/hints/ | — | The first hour: tutorial quests and just-in-time hints | The first-day orientation tour |
| tutorial_quests | Tutorial quests | 3 | onboarding_tutorial | — | candidate | quest-writer | data/quests/ | — | Guided first quests that teach the loop | — |
| contextual_hints | Contextual hints | 3 | onboarding_tutorial | — | candidate | orchestrator | ui/hints/ | — | Tips shown the first time a situation occurs | — |
| live_events | Live events & holidays | 2 | narrative | — | candidate | director | data/events/; core/events_calendar/ | — | Holidays and seasonal events on a calendar | Seasonal festivals on the town calendar |
| holiday_defs | Holiday definitions | 3 | live_events | — | candidate | director | data/events/ | — | Data-defined holidays with date ranges and content | — |
| event_calendar | Event calendar | 3 | live_events | — | candidate | orchestrator | core/events_calendar/ | §4 R4 | What is active now; real dates must be fed in from outside the sim | — |
| seasonal_rewards | Seasonal rewards | 3 | live_events | — | candidate | content-smith | data/events/ | — | Items available only during an event | — |
| cinematics_in_engine | In-engine story moments | 2 | narrative | 3 | implied | world-builder | scenes/story/ | §1 non-goal prerendered | Story beats staged live in the engine | A scene staged live rather than a filmed clip |
| prerendered_cutscenes | Prerendered video cutscenes | 3 | cinematics_in_engine | — | non-goal | director | — | §1 non-goals | Story moments are in-engine, never video | — |
| scripted_sequences | Scripted sequences | 3 | cinematics_in_engine | 3 | implied | world-builder | scenes/story/ | — | Timed sequences of actor moves and lines | — |
| camera_cues | Camera cues | 3 | cinematics_in_engine | 3 | implied | world-builder | scenes/story/ | — | Camera moves inside sequences | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| quest_defs | reads | schema_quest_def | QuestDef | hard | Every quest file must match the schema |
| quest_defs | references | dialogue_nodes_choices | QuestDef.dialogue | hard | A quest names its dialogue |
| quest_defs | reads | lore_bible | voice and facts | soft | Quests are written in the bible's voice |
| objective_types | reads | schema_quest_def | objectives.type enum | hard | The five types are the schema's enum |
| objective_types | references | enemy_defs | kill target_id | hard | A kill objective names an enemy |
| objective_types | references | items | collect target_id | hard | A collect objective names an item |
| objective_types | references | markers_waypoints | reach target_id | hard | A reach objective names a marker |
| objective_types | references | items | craft target_id | hard | A craft objective names the item crafted |
| objective_tracking | reads | objective_types | type per objective | hard | The tracker counts per type |
| objective_tracking | reads | quest_defs | objectives and counts | hard | Required counts come from the quest |
| objective_tracking | reads | world_state_flags | progress counters | hard | Progress is saved as counters |
| objective_tracking | reads | interaction_system | talk completion | soft | Talk objectives complete through an interaction |
| prereq_dag | reads | quest_defs | QuestDef.prereqs | hard | The graph is built from prereqs |
| quest_rewards | reads | quest_defs | QuestDef.rewards | hard | Rewards are a quest field |
| quest_rewards | references | items | rewards.items | hard | Reward items must exist |
| quest_rewards | reads | inventory | grant items | hard | Reward items are added to the inventory |
| quest_journal_text | reads | schema_quest_def | journal_text | hard | Journal text is a schema field |
| quest_journal_text | reads | lore_bible | voice | hard | Journal text is written in the bible's voice |
| quest_chains | reads | prereq_dag | chain order | hard | A chain is a path in the prerequisite graph |
| shared_group_quests | reads | party_membership | who shares | hard | Sharing follows the party |
| shared_group_quests | reads | objective_tracking | shared counters | hard | Shared progress means shared counters |
| repeatable_daily_quests | reads | world_clock_ticks | reset | hard | Resets happen on the clock |
| repeatable_daily_quests | reads | quest_defs | repeatable flag | hard | A quest would declare itself repeatable |
| dialogue_nodes_choices | reads | schema_dialogue_def | DialogueDef | hard | Every dialogue file must match the schema |
| dialogue_nodes_choices | reads | lore_bible | voice | soft | Dialogue is written in the bible's voice |
| dialogue_conditions | reads | condition_evaluator | evaluate | hard | Conditions are evaluated by the shared grammar |
| dialogue_conditions | reads | dialogue_nodes_choices | condition strings | hard | Conditions are stored on choices |
| dialogue_runner | reads | dialogue_nodes_choices | tree | hard | The runner walks the tree |
| dialogue_runner | reads | intent_schema | choice intent | hard | Picking a choice is an intent |
| dialogue_runner | reads | dialogue_conditions | visible choices | hard | The runner hides choices whose condition fails |
| dialogue_runner | reads | world_state_flags | choice flags | soft | Choices can set flags |
| barks_ambient_lines | reads | npc_defs | speaker | hard | Barks belong to NPCs |
| barks_ambient_lines | reads | world_clock_ticks | time-of-day lines | soft | Some barks depend on the phase |
| voice_acting | reads | dialogue_nodes_choices | lines | hard | Recorded lines map to dialogue nodes |
| voice_acting | reads | sfx_events | playback | soft | Playback uses the audio system |
| lore_additions | reads | lore_bible | consistency | hard | Additions extend the bible without contradiction |
| naming_conventions_lore | reads | lore_bible | names | hard | Names come from the bible |
| naming_conventions_lore | reads | id_convention | ids from names | hard | Ids are derived from lore names |
| lore_entries_codex | reads | lore_bible | source | hard | Codex entries are excerpts of the bible |
| lore_entries_codex | reads | world_state_flags | discovered | hard | Discovery is a flag |
| tutorial_quests | extends | quest_defs | quest kind | hard | A tutorial is a quest |
| tutorial_quests | reads | player_controller | movement lessons | soft | Early lessons teach movement |
| contextual_hints | reads | world_state_flags | shown once | hard | Hints track whether they have been shown |
| contextual_hints | reads | interaction_system | prompts | soft | Hints attach to interaction prompts |
| holiday_defs | reads | event_calendar | active window | hard | A holiday is active on calendar dates |
| event_calendar | reads | world_clock_ticks | game time | hard | Game-time events read the clock |
| event_calendar | reads | seasons_calendar | seasons | soft | Seasonal events read the season |
| event_calendar | reads | deterministic_sim | no wall-clock in core | hard | Real-date holidays need wall-clock time, which R4 bans inside core/; the date must be injected from outside the sim |
| seasonal_rewards | references | items | reward items | hard | Rewards are items |
| seasonal_rewards | reads | holiday_defs | which event | hard | Rewards belong to an event |
| scripted_sequences | reads | dialogue_runner | lines | hard | Sequences play dialogue |
| scripted_sequences | reads | actor_registry | actors moved | hard | Sequences move actors by id |
| scripted_sequences | reads | sim_presentation_split | presentation only | hard | A sequence must not mutate gameplay state except through intents and flags (R5) |
| scripted_sequences | reads | condition_evaluator | trigger | soft | Sequences trigger on conditions |
| camera_cues | reads | camera | rig control | hard | Cues drive the camera rig |
| camera_cues | reads | scripted_sequences | timing | hard | Cues are timed inside sequences |
| quest_defs | references | npc_defs | giver_npc (optional) | soft | giver_npc is optional (empty = auto-granted); the Phase 0 sample quest has no giver |
| objective_types | references | npc_defs | talk target_id | soft | talk objectives name an npc id; unusable until NPCs land in Phase 3 |
| dialogue_runner | reads | interaction_system | interact target id | hard | Talking is an interact on an NPC |
| dialogue_runner | reads | schema_dialogue_def | goto end | soft | The runner follows goto and stops at end |
| objective_types | references | quest_items | — | soft | Collect objectives usually name quest items |
