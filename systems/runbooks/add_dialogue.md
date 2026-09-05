# rb_add_dialogue — Add a dialogue tree (DialogueDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | An NPC or quest needs a conversation: nodes with speaker, text and choices, some gated by conditions. |
| Primary | dialogue_nodes_choices |
| Roles | quest-writer |
| Director | none — conditions use the Phase 3 grammar; anything the grammar cannot express is a grammar change (spec) |
| Spec | §6.8, §6.7 dialogue, §8 G2 |
| Not touched | voice_acting: candidate — recorded lines map to nodes only if approved |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_dialogue_def | core/schemas/dialogue_def.gd | nodes[] carry node_id, speaker, text, choices[] with text, goto, condition | — |
| 2 | check | npc_defs | data/npcs/ | every speaker is an npc id (or the player) | — |
| 3 | check | condition_grammar | core/conditions/grammar.gd | every condition parses in the grammar; it reads quest, item and flag state only | The grammar lands in Phase 3; until then leave conditions empty. |
| 4 | check | dialogue_conditions | data/dialogue/<id>.tres | gated choices carry their condition on the choice, and an ungated path to `end` always exists | — |
| 5 | check | world_state_flags | core/state/flags.gd | flags a condition reads are set by some quest or gate | A flag nobody sets is a branch nobody reaches. |
| 6 | check | lore_voice_check | docs/lore_bible.md | text matches the lore voice | — |
| 7 | create | dialogue_nodes_choices | data/_inbox/<id>.json | `dialogue_<npc>_<topic>`: nodes with node_ids; every goto resolves or is `end` | — |
| 8 | run | json_to_tres_converter | data/dialogue/<id>.tres | converter writes the .tres | — |
| 9 | check | dialogue_runner | core/dialogue/runner.gd | the tree runs from choice intents and sets flags only through quests | No code change for a new tree. |
| 10 | check | quest_defs | data/quests/<quest>.tres | the quest that shows this dialogue names it | — |
| 11 | check | dialogue_screen | ui/dialogue/ | text and choices render; long lines wrap | No code change. |
| 12 | run | g2_data_integrity | tools/validate_data.gd | passes: gotos resolve, speakers exist | — |
| 13 | run | gm_console | core/debug/console.gd | talk to the NPC; walk every branch to `end` | — |
| 14 | update | changelog | docs/changelog.md | one line | — |
