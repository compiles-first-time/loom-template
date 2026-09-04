# Content factory — agents stamp out spells, quests and props; inspectors check every unit

> **Analogy:** a factory line. The order, kitchen, inspection, shelf loop (agent content loop), the recipe tester who keeps every dish edible (balance), outsourced prop makers whose deliveries must pass the dress code (asset generation), the inspection desk at the end of the line (review), and the seasonal menu rotation (live content).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| content_factory | Content factory | 1 | — | 2 | spec | orchestrator | tools/; data/_inbox/; art/_inbox/ | §6.9, §9, §13 Phase 5 | The agent content loop, balance, asset generation, review, live content | A factory line where agents stamp out content and inspectors check every unit |
| agent_content_loop | Agent content loop | 2 | content_factory | 2 | spec | content-smith | data/_inbox/ | §6.9, §7.2 | Request to JSON to converter to gates to PR; the loop the architecture exists for | The order, kitchen, inspection, shelf loop |
| request_to_json | Request to JSON | 3 | agent_content_loop | 2 | spec | content-smith | data/_inbox/ | §6.9 | A plain-English request becomes schema-exact JSON, one file per def | — |
| balance_anchoring | Balance anchoring | 3 | agent_content_loop | 2 | spec | content-smith | data/ | §7.2 | Read three to five comparable defs before choosing numbers | — |
| converter_gate_run | Converter and gate run | 3 | agent_content_loop | 2 | spec | content-smith | tools/ | §7.2 | Run the converter, then G2, then G1 | — |
| pr_review_flow | PR review flow | 3 | agent_content_loop | 2 | spec | orchestrator | .github/ | §7.1 | The PR with .tres files, inbox JSON removed, ids listed, gates pasted | — |
| balance_tuning | Balance & tuning | 2 | content_factory | 2 | spec | content-smith/director | docs/balance_ranges.md; tools/balance/ | §8 G2 | Ranges, curves, difficulty, and candidate simulations | The recipe tester who keeps every dish edible |
| balance_ranges | Balance ranges | 3 | balance_tuning | 0 | spec | director | docs/balance_ranges.md | §8 G2 | Allowed numeric ranges per field that G2 enforces | — |
| stat_curves_level_scaling | Stat curves | 3 | balance_tuning | 2 | implied | content-smith | docs/balance_ranges.md | — | How numbers grow by level and tier | — |
| difficulty_curve | Difficulty curve | 3 | balance_tuning | 2 | implied | director | docs/balance_ranges.md | — | Intended difficulty by biome and boss | — |
| loot_economy_sim | Loot economy simulation | 3 | balance_tuning | — | candidate | test-pilot | tools/balance/loot_sim.gd | — | Monte Carlo over loot tables | — |
| combat_sim_harness | Combat simulation harness | 3 | balance_tuning | — | candidate | test-pilot | tools/balance/combat_sim.gd | — | Headless fights over many seeds | — |
| asset_generation | Asset generation | 2 | content_factory | 2 | spec | world-builder/content-smith | tools/gen/; art/_inbox/ | §9 | Icon and model generation through scripts and the import pipeline | Outsourced prop makers whose deliveries must pass the dress code |
| icon_generation_prompts | Icon generation prompts | 3 | asset_generation | 2 | spec | content-smith | art/_inbox/icon_requests.md | §7.2 | One-line prompts filed when an icon is missing | — |
| model_generation_api | Model generation API | 3 | asset_generation | 2 | spec | world-builder | tools/gen/ | §9 | Meshy or Tripo called only from tools with env keys | — |
| asset_intake_pipeline | Asset intake pipeline | 3 | asset_generation | 2 | spec | world-builder | art/_inbox/; tools/import_post.gd | §9, §11 | Generated files enter only through the import hook | — |
| icon_placeholder_fallback | Icon placeholder fallback | 3 | asset_generation | 2 | spec | content-smith | art/icons/_placeholder.png | §7.2 | Use the placeholder until the icon exists | — |
| content_review | Content review | 2 | content_factory | 1 | spec | test-pilot | tests/; tools/testing/ | §7.2 | Screenshot sets, lore voice, id listing, flaky-test policy | The inspection desk at the end of the line |
| screenshot_review_sets | Screenshot review sets | 3 | content_review | 1 | spec | test-pilot | tools/testing/screens.gd | §7.2 | The standard camera set for review | — |
| lore_voice_check | Lore voice check | 3 | content_review | 3 | spec | quest-writer | docs/lore_bible.md | §7.2 | Would a player skip this line? Tighten until no | — |
| id_listing_in_pr | Id listing in PR | 3 | content_review | 2 | spec | content-smith | .github/ | §7.1 | New ids listed in every content PR | — |
| flaky_test_policy | Flaky test policy | 3 | content_review | 0 | spec | test-pilot | tests/ | §7.2 | A test that would not pass 100 of 100 does not merge | — |
| live_content_ops | Live content operations | 2 | content_factory | — | candidate | director | data/; docs/ | — | Patches, seasonal drops, data-only hotfixes | The seasonal menu rotation |
| content_patches | Content patches | 3 | live_content_ops | — | candidate | director | data/ | — | Content-only releases | — |
| seasonal_drops | Seasonal drops | 3 | live_content_ops | — | candidate | director | data/events/ | — | Event-timed content | — |
| hotfix_data_only | Data-only hotfixes | 3 | live_content_ops | — | candidate | orchestrator | data/ | — | Fix numbers without an engine build | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| request_to_json | reads | data_schemas | schema shape | hard | The JSON must match the schema exactly |
| request_to_json | reads | inbox_json | drop location | hard | Files land in the inbox |
| request_to_json | reads | id_convention | ids | hard | New ids follow R7 |
| balance_anchoring | reads | items | comparable items | hard | Anchoring reads existing items |
| balance_anchoring | reads | spell_defs_content | comparable spells | hard | Anchoring reads existing spells |
| balance_anchoring | reads | enemy_defs | comparable enemies | hard | Anchoring reads existing enemies |
| balance_anchoring | reads | balance_ranges | limits | hard | Numbers stay inside the ranges |
| converter_gate_run | reads | json_to_tres_converter | convert | hard | The loop runs the converter |
| converter_gate_run | reads | g2_data_integrity | G2 | hard | The loop runs G2 |
| converter_gate_run | reads | g1_unit_tests_gut | G1 | hard | The loop runs G1 |
| pr_review_flow | reads | ci_cd | gates on PR | hard | The PR is checked by CI |
| pr_review_flow | reads | write_scope_enforcement | scope check | hard | The orchestrator rejects out-of-scope diffs |
| balance_ranges | reads | game_infra_spec | §8 G2 | hard | The ranges document is required by G2 |
| stat_curves_level_scaling | reads | level_curve | player curve | hard | Curves describe the level curve |
| stat_curves_level_scaling | reads | enemy_stats_scaling | enemy bands | hard | Curves describe enemy bands |
| difficulty_curve | reads | boss_encounters | boss tuning | hard | Bosses are the difficulty milestones |
| difficulty_curve | reads | enemy_stats_scaling | bands | hard | Difficulty is expressed through stat bands |
| loot_economy_sim | reads | weighted_rolls | roll function | hard | The sim calls the real roll |
| loot_economy_sim | reads | loot_table_defs | tables | hard | The sim rolls the real tables |
| loot_economy_sim | reads | deterministic_sim | seeds | hard | The sim sweeps seeds |
| combat_sim_harness | reads | deterministic_sim | seeds | hard | Fights are seeded |
| combat_sim_harness | reads | damage_model | real formula | hard | The harness uses the real damage model |
| combat_sim_harness | reads | casting | real casting | hard | The harness uses the real casting verbs |
| icon_generation_prompts | reads | icon_conventions | target path | hard | Prompts name the path the icon must land at |
| model_generation_api | reads | env_secrets | API keys | hard | Keys come from the environment (R-SEC1) |
| model_generation_api | reads | model_naming | target path | hard | Generated models are named by id |
| model_generation_api | gated_by | dependency_policy_r10 | external API | hard | An asset API is a dependency recorded in §9 |
| asset_intake_pipeline | extends | import_hook | intake step | hard | Intake is the import hook applied to generated files |
| icon_placeholder_fallback | reads | placeholder_assets | placeholder | hard | The fallback is the placeholder |
| screenshot_review_sets | reads | camera | standard shots | hard | The set is captured with the camera rig |
| screenshot_review_sets | reads | art_bible_palette | comparison target | hard | Reviews compare against the palette |
| lore_voice_check | reads | lore_bible | voice | hard | The check is against the bible |
| lore_voice_check | reads | dialogue_nodes_choices | lines | hard | The check reads dialogue lines |
| id_listing_in_pr | reads | id_convention | ids | hard | Listed ids follow the convention |
| flaky_test_policy | reads | g1_unit_tests_gut | tests | hard | The policy governs unit tests |
| flaky_test_policy | reads | deterministic_sim | seeded | soft | Seeded tests are how flakiness is avoided once the sim exists in Phase 1 |
| content_patches | reads | content_versioning | versions | hard | A patch is a content version |
| content_patches | reads | save_migrations | old saves | hard | Patches must keep old saves loading |
| seasonal_drops | reads | holiday_defs | events | hard | Drops are tied to events |
| hotfix_data_only | reads | systems_content_split | data only | hard | Hotfixes are possible because content is data (R1) |
| hotfix_data_only | reads | data_dir_as_db | store | hard | A hotfix is a data commit |
