# rb_add_quest — Add a quest (QuestDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | A new quest: giver, prerequisites, objectives, rewards, dialogue, journal text. |
| Primary | quest_defs |
| Roles | quest-writer; content-smith |
| Director | none — a new objective type is a verb (`rb_add_verb`); repeatable quests, tutorials and reputation rewards are candidates |
| Spec | §6.7, §6.8, §5 quest_started / quest_objective_progressed / quest_completed, §8 G2 |
| Not touched | repeatable_daily_quests: candidate; tutorial_quests: candidate — onboarding is not in the spec |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_quest_def | core/schemas/quest_def.gd | objectives[].type ∈ kill/collect/reach/talk/craft; rewards carry xp and items | — |
| 2 | check | npc_defs | data/npcs/<giver>.tres | giver_npc exists (or is empty for auto-grant) | Missing NPC: `rb_add_npc`. |
| 3 | check | objective_types | core/quests/objectives.gd | each target_id resolves per type: enemy id, item id, marker id, npc id, item id | — |
| 4 | check | items | data/items/ | rewards.items[].item_id and collect/craft targets exist | — |
| 5 | check | markers_waypoints | scenes/<zone>/markers | reach objectives name a marker that exists in a scene | World-builder places markers. |
| 6 | check | prereq_dag | data/quests/ | prereqs[] name existing quests and form no cycle | — |
| 7 | create | dialogue_nodes_choices | data/dialogue/<dialogue_id>.tres | the dialogue exists when the quest names one | `rb_add_dialogue` when new. |
| 8 | check | lore_voice_check | docs/lore_bible.md | journal_text and dialogue match the lore voice and naming conventions | — |
| 9 | create | quest_defs | data/_inbox/<id>.json | `quest_<name>`: giver_npc, prereqs, objectives, rewards, dialogue, journal_text | — |
| 10 | run | json_to_tres_converter | data/quests/<id>.tres | converter writes the .tres | — |
| 11 | check | quest_givers | data/npcs/<giver>.tres | the giver offers this quest (its quest list names it) | — |
| 12 | check | objective_tracking | core/quests/tracking.gd | required counts come from the def; progress advances on the right signals | No code change. |
| 13 | check | quest_rewards | core/quests/rewards.gd | rewards are granted once on quest_completed; items exist | — |
| 14 | check | xp_award | core/progression/xp.gd | rewards.xp follows the level curve for the quest's tier | — |
| 15 | check | quest_journal_screen | ui/journal/ | the journal shows the text and the objective progress | No code change. |
| 16 | run | g2_data_integrity | tools/validate_data.gd | passes: every referenced id resolves | — |
| 17 | run | gm_console | core/debug/console.gd | accept via the giver (or console), complete each objective, receive rewards; the three quest signals fire in order | — |
| 18 | update | changelog | docs/changelog.md | one line | — |
