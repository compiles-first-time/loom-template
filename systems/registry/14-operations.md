# Operations — the pit crew, the inspectors, and the maintenance logs

> **Analogy:** airport security lanes (gates), the assembly line's automatic inspection station (CI), shipping the boxed game (release), the dashboard warning lights and the black box (monitoring), the same film on a phone and in IMAX (hardware scalability), the key cabinet with a sign-out sheet (security), the binders every new hire reads (documentation), and the crew's radios and job cards (agent harness).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| operations | Operations | 1 | — | 0 | spec | test-pilot/orchestrator | tests/; .github/workflows/; tools/; docs/ | §8, §13 | Gates, CI, release, monitoring, hardware scalability, security, documentation, agent harness | The pit crew, the inspectors, and the maintenance logs |
| validation_gates | Validation gates | 2 | operations | 0 | spec | test-pilot/orchestrator | .github/workflows/gates.yml; tests/; tools/ | §8 | G0 to G5 plus determinism and performance checks | Airport security lanes: nothing boards without passing |
| g0_style_parse | G0 style and parse | 3 | validation_gates | 0 | spec | test-pilot | .github/workflows/gates.yml | §8 G0 | gdformat, gdlint and a headless import check | — |
| g1_unit_tests_gut | G1 unit tests | 3 | validation_gates | 0 | spec | test-pilot | tests/unit/ | §8 G1 | GUT unit tests with seeded RNG | — |
| g2_data_integrity | G2 data integrity | 3 | validation_gates | 0 | spec | orchestrator/test-pilot | tools/validate_data.gd | §8 G2 | Ids, references, paths, enums and ranges | — |
| g3_smoke_boot | G3 smoke | 3 | validation_gates | 0 | spec | test-pilot | .github/workflows/gates.yml | §8 G3 | Main scene boots headless for 30 s with zero ERROR lines | — |
| g4_bot_playtest | G4 bot playtest | 3 | validation_gates | 1 | spec | test-pilot | tools/testing/bot.gd | §8 G4 | Scripted walk, gather, craft, fight; assert outcomes and no floor falls | — |
| g5_vision_review | G5 vision review | 3 | validation_gates | 1 | spec | test-pilot | tools/testing/screens.gd | §8 G5 | Screenshot set reviewed against the art bible; advisory | — |
| determinism_replay_tests | Determinism replay tests | 3 | validation_gates | 1 | implied | test-pilot | tests/integration/ | §4 R4 | Same seed and intents produce the same state | — |
| perf_budget_tests | Performance budget tests | 3 | validation_gates | — | candidate | test-pilot | tests/perf/ | — | Frame time under budget on a benchmark scene | — |
| ci_cd | CI / CD | 2 | operations | 0 | spec | test-pilot | .github/workflows/ | §2, §8 | The PR workflow that runs the gates, plus build and governance jobs | The assembly line's automatic inspection station |
| pr_gates_workflow | PR gates workflow | 3 | ci_cd | 0 | spec | test-pilot | .github/workflows/gates.yml | §8 | G0 to G3 on every PR | — |
| export_build_pipeline | Export build pipeline | 3 | ci_cd | 1 | implied | test-pilot | .github/workflows/build.yml | §2 | Export desktop builds in CI | — |
| loom_doctor_gate | Loom governance gate | 3 | ci_cd | 0 | implied | orchestrator | .github/workflows/governance-gate.yml | — | Loom's governance gate, doctor and atlas check on every PR | — |
| nightly_soak_builds | Nightly soak builds | 3 | ci_cd | — | candidate | test-pilot | .github/workflows/ | — | Long headless server runs | — |
| release_distribution | Release & distribution | 2 | operations | 1 | implied | orchestrator | export_presets.cfg; docs/changelog.md | §2 Windows and Linux | Versioning, builds, server distribution, and candidate patching, Steam and mods | Shipping the boxed game |
| mobile_console_ports | Mobile and console ports | 3 | release_distribution | — | non-goal | director | — | §1 non-goals | Desktop only; revisit after Phase 5 | — |
| patching_updates | Patching & updates | 3 | release_distribution | — | candidate | director | docs/release_process.md | — | How builds and data-only content patches ship, with save migrations when needed | — |
| steam_platform | Steam platform | 3 | release_distribution | — | candidate | director | addons/godotsteam/ | — | Steamworks integration | — |
| mod_support | Mod support | 3 | release_distribution | — | candidate | director | data/; addons/ | — | Player-made content through the same data pipeline | — |
| monitoring_telemetry | Monitoring & telemetry | 2 | operations | 1 | implied | orchestrator | server/metrics; core/debug/ | — | Client overlays, server metrics, logs, crashes, alerts, analytics | The dashboard warning lights and the black box |
| server_health_metrics | Server health metrics | 3 | monitoring_telemetry | 4 | implied | orchestrator | server/metrics | — | Tick time, players, memory, save latency | — |
| log_aggregation | Log aggregation | 3 | monitoring_telemetry | — | candidate | orchestrator | server/ | — | Collect server logs centrally | — |
| crash_reporting | Crash reporting | 3 | monitoring_telemetry | — | candidate | orchestrator | tools/crash/ | — | Client and server crash bundles | — |
| alerting | Alerting | 3 | monitoring_telemetry | — | candidate | orchestrator | server/ | — | Notify the host on unhealthy metrics | — |
| gameplay_analytics | Gameplay analytics | 3 | monitoring_telemetry | — | candidate | director | server/analytics/ | — | Aggregate gameplay events for tuning | — |
| hardware_scalability | Hardware range & scalability | 2 | operations | 1 | implied | orchestrator | project.godot; core/settings/graphics.gd | §1 mid-range PCs | Specs, presets, scaling, fallbacks, benchmark, frame budget | The same film on a phone and in IMAX: different quality, same story |
| frame_time_budget | Frame time budget | 3 | hardware_scalability | 1 | implied | orchestrator | docs/balance_ranges.md | §1 | Milliseconds per frame per system on the target machine | — |
| min_recommended_specs | Minimum and recommended specs | 3 | hardware_scalability | 1 | implied | director | docs/hardware_targets.md | §1 | The hardware the game targets | — |
| graphics_quality_presets | Graphics quality presets | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | §1 | Low, medium and high bundles | — |
| resolution_scaling | Resolution scaling | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | — | Render scale | — |
| lod_shadow_scaling | LOD and shadow scaling | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | — | LOD bias and shadow quality | — |
| low_end_fallbacks | Low-end fallbacks | 3 | hardware_scalability | — | candidate | orchestrator | art/shaders/ | — | Simplified shader paths | — |
| benchmark_scene | Benchmark scene | 3 | hardware_scalability | — | candidate | test-pilot | tools/testing/benchmark.tscn | — | A fixed scene for measuring | — |
| security_secrets | Security & secrets | 2 | operations | 0 | spec | orchestrator | .env.example; tools/ | §4 R-SEC1, R10, §9 | Secrets in env, the dependency policy, Loom's secrets doctor | The key cabinet with a sign-out sheet |
| env_secrets | Environment secrets | 3 | security_secrets | 0 | spec | orchestrator | .env.example | R-SEC1 | Keys only in environment variables; never in code, data, logs or commits | — |
| dependency_policy_r10 | Dependency policy (R10) | 3 | security_secrets | 0 | spec | director | GAME_INFRA_SPEC.md | §4 R10, §2, §9 | A new addon, library, service or API requires a spec-change PR | — |
| loom_secrets_doctor | Loom secrets doctor | 3 | security_secrets | 0 | implied | orchestrator | scripts/secrets-doctor.sh | — | Loom's retrospective secret scan | — |
| documentation | Documentation | 2 | operations | 0 | spec | director/orchestrator | docs/ | §3, §13 | The spec, changelog, tech debt, migrations, engine version, the atlas | The binders on the shelf every new hire reads |
| game_infra_spec | GAME_INFRA_SPEC.md | 3 | documentation | 0 | spec | director | GAME_INFRA_SPEC.md | §0, §14 | The single source of truth; contract changes are PRs to it | — |
| changelog | Changelog | 3 | documentation | 0 | spec | orchestrator | docs/changelog.md | §7.1 | One line per task; version tags are cut from it (spec §7.1: every role may append) | — |
| tech_debt_log | Tech debt log | 3 | documentation | 0 | spec | orchestrator | docs/tech_debt.md | §4 R9 | Debt filed instead of fixed out of scope | — |
| migrations_doc | Migrations doc | 3 | documentation | 2 | spec | orchestrator | docs/migrations.md | §6 | Schema version notes | — |
| systems_atlas | Systems atlas | 3 | documentation | 0 | implied | orchestrator | systems/ | — | This registry and its generated atlas; the impact map | — |
| agent_harness | Agent harness | 2 | operations | 0 | spec | orchestrator | .claude/; .agents/; .mcp.json | §7, §9, Appendix B | Skills, write scopes, the Godot MCP bridge, Loom's governance layer | The crew's radios and job cards |
| skills_materialized | Skills materialized | 3 | agent_harness | 0 | spec | orchestrator | .claude/skills/; .agents/skills/ | §7.2 | content-smith, world-builder, quest-writer and test-pilot as portable skills | — |
| write_scope_enforcement | Write scope enforcement | 3 | agent_harness | 0 | spec | orchestrator | scripts/write-scope-check.sh; .github/workflows/gates.yml | §7.1 | The orchestrator rejects diffs outside a role's write scope | — |
| godot_mcp_bridge | Godot MCP bridge | 3 | agent_harness | 0 | spec | orchestrator | .mcp.json | §9 | Run scenes headless, capture output, run tests | — |
| loom_governance_layer | Loom governance layer | 3 | agent_harness | 0 | implied | orchestrator | constitution/; scripts/; layers/ | Appendix B | Loom's constitution, hooks, doctor and atlas on top of the spec | — |
| subagent_mirrors | Subagent mirrors | 3 | agent_harness | — | candidate | orchestrator | .claude/agents/ | §7.2 | Optional subagents mirroring the four skills | — |
| harness_adapters | Harness adapters (CLAUDE.md, AGENTS.md) | 3 | agent_harness | 0 | spec | orchestrator | CLAUDE.md; AGENTS.md; .claude/; .agents/ | Appendix B, §13 item 2 | The always-loaded adapters that point any harness at the spec, the session ritual, the write scopes and the atlas | — |
| g6_feel_gate | G6 feel gate | 3 | validation_gates | — | candidate | test-pilot | tools/testing/feel.gd; tests/perf/ | — | Scripted movement run on the benchmark scene: tick cost, input-to-sim latency, determinism replay and prediction error under simulated latency headless; frame pacing, hitches and tick-locked visuals on the reference machine (ADR-0068) | The test drive with a stopwatch: the car is not done because it starts, it is done when it corners smoothly at the numbers on the sheet |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| g0_style_parse | validates | gdscript_static_typing | gdformat, gdlint | hard | G0 is the style law run by machine |
| g1_unit_tests_gut | validates | deterministic_sim | seeded tests | hard | Unit tests are seeded so they replay |
| g1_unit_tests_gut | validates | damage_formula | property tests | hard | Damage math is property-tested |
| g1_unit_tests_gut | validates | weighted_rolls | property tests | hard | Loot weights are property-tested |
| g1_unit_tests_gut | validates | stat_formulas | property tests | hard | Stat formulas are property-tested |
| g1_unit_tests_gut | reads | addon_management | GUT addon | hard | The test framework is an addon |
| g2_data_integrity | extends | data_validator_g2 | the gate | hard | G2 is the validator run as a gate |
| g2_data_integrity | validates | items | item files | hard | G2 checks every item |
| g2_data_integrity | validates | spell_effect_content | spells and effects | hard | G2 checks every spell and effect |
| g2_data_integrity | validates | enemies | enemy files | hard | G2 checks every enemy |
| g2_data_integrity | validates | biome_defs | biome files | hard | G2 checks every biome |
| g2_data_integrity | validates | prereq_dag | no cycles | hard | G2 rejects prerequisite cycles |
| g2_data_integrity | validates | npc_defs | npc files | soft | G2 will check NPCs once they have a schema |
| g3_smoke_boot | validates | engine_platform | boot | hard | Smoke proves the project boots |
| g4_bot_playtest | validates | locomotion | walk | hard | The bot walks |
| g4_bot_playtest | validates | melee_weapons | fight | hard | The bot fights one enemy |
| g4_bot_playtest | reads | intent_schema | scripted intents | hard | The bot plays by sending intents |
| g5_vision_review | reads | art_bible_palette | palette | hard | Review compares against the art bible |
| g5_vision_review | reads | screenshot_review_sets | screenshots | hard | Review consumes the standard set |
| determinism_replay_tests | validates | deterministic_sim | replay equality | hard | The test is the proof of R4 |
| determinism_replay_tests | reads | replay_recorder | recorded intents | soft | Recorded sessions become tests |
| perf_budget_tests | reads | frame_time_budget | budget | hard | The test asserts the budget |
| perf_budget_tests | reads | benchmark_scene | scene | hard | The test runs the benchmark scene |
| pr_gates_workflow | reads | validation_gates | gates | hard | The workflow runs the gates |
| export_build_pipeline | reads | export_presets | presets | hard | CI exports the presets |
| loom_doctor_gate | reads | loom_governance_layer | doctor and gate | hard | The job runs Loom's checks |
| loom_doctor_gate | reads | systems_atlas | validate and render --check | hard | The job fails on a broken or stale atlas |
| nightly_soak_builds | reads | dedicated_server_build | server | hard | Soak runs the server |
| patching_updates | reads | save_migrations | old saves | hard | A patch must keep old saves loading |
| steam_platform | reads | authentication_provider | steam auth | soft | Steam brings its own identity |
| steam_platform | gated_by | dependency_policy_r10 | steamworks | hard | Steamworks is a new dependency |
| mod_support | reads | content_pipeline | same pipeline | hard | Mods enter through the same pipeline |
| log_aggregation | reads | server_cli_headless | logs | hard | Logs come from the server process |
| crash_reporting | reads | export_build_pipeline | symbols | hard | Crash bundles need build symbols |
| crash_reporting | reads | in_game_bug_report | bundles | soft | Player reports share the format |
| alerting | reads | server_health_metrics | thresholds | hard | Alerts fire on metrics |
| frame_time_budget | reads | fixed_tick_sim | tick cost | hard | The sim tick is part of the budget |
| frame_time_budget | reads | min_recommended_specs | target machine | hard | The budget is measured on the target machine |
| graphics_quality_presets | reads | lod_shadow_scaling | switches | hard | Presets bundle scaling switches |
| graphics_quality_presets | reads | resolution_scaling | switches | hard | Presets bundle render scale |
| resolution_scaling | reads | project_settings | scaling mode | hard | Render scale is a project setting |
| lod_shadow_scaling | reads | lod_texture_budgets | budgets | hard | Scaling respects asset budgets |
| low_end_fallbacks | reads | master_toon_shader | simplified path | hard | Fallbacks are shader variants |
| benchmark_scene | reads | gray_box_island | scene | soft | The benchmark can be the island |
| env_secrets | reads | game_infra_spec | R-SEC1 | hard | The rule is in the spec |
| dependency_policy_r10 | reads | game_infra_spec | §2, §9 | hard | The policy is the spec's dependency sections |
| loom_secrets_doctor | reads | env_secrets | patterns | hard | The doctor scans for leaked secrets |
| changelog | reads | game_infra_spec | §7.1 | soft | The changelog rule is in the roster table |
| tech_debt_log | reads | game_infra_spec | R9 | soft | The debt rule is R9 |
| migrations_doc | reads | schema_versioning | versions | hard | Notes are per schema version |
| systems_atlas | reads | game_infra_spec | statuses and sections | hard | Every status and spec column derives from the spec |
| systems_atlas | reads | event_bus | §5 cross-check | hard | The atlas validates its signals against the bus |
| skills_materialized | reads | game_infra_spec | §7.2 | hard | Skills are copied from the spec |
| write_scope_enforcement | reads | skills_materialized | roles | hard | Scopes are per role |
| write_scope_enforcement | reads | game_infra_spec | §7.1 | hard | The scope table is in the spec |
| godot_mcp_bridge | reads | engine_platform | headless runs | hard | The bridge drives the engine |
| godot_mcp_bridge | gated_by | dependency_policy_r10 | MCP server choice | hard | The server choice is recorded in §9 |
| loom_governance_layer | extends | agent_harness | harness variant | hard | Loom is one of the harnesses in Appendix B |
| loom_governance_layer | reads | systems_atlas | impact discipline | soft | Loom's doctor runs the atlas checks |
| subagent_mirrors | reads | skills_materialized | prompts | hard | Mirrors point at the skills |
| g2_data_integrity | validates | loot_table_defs | loot table files | hard | G2 checks every loot table file: item ids, weights |
| g2_data_integrity | validates | quest_defs | quest files | hard | G2 checks every quest file: prereqs, objective targets, rewards, dialogue |
| g2_data_integrity | validates | dialogue_nodes_choices | dialogue files | hard | G2 checks every dialogue file: gotos resolve, speakers exist |
| g2_data_integrity | validates | recipe_defs | recipe files | hard | G2 checks every recipe file: output, inputs, station, unlock |
| g4_bot_playtest | validates | gathering | — | soft | §8 lists gather in G4 from Phase 1 while §13 lands gathering in Phase 3 — soft until the §8/§13 inconsistency is resolved by a spec PR |
| g4_bot_playtest | validates | crafting | — | soft | §8 lists craft in G4 from Phase 1 while §13 lands crafting in Phase 3 — soft until the spec PR |
| g3_smoke_boot | validates | gray_box_island | — | soft | Phase 0 boots an empty project; the island is what boots from Phase 1 |
| patching_updates | reads | changelog | — | hard | Patch notes are cut from the changelog |
| graphics_quality_presets | reads | user_settings_store | — | hard | The chosen preset is a saved setting |
| server_health_metrics | reads | tick_rate_sync | — | hard | Tick rate is the first health metric |
| server_health_metrics | reads | sessions_players | — | hard | Player count and session churn are health metrics |
| gameplay_analytics | reads | event_bus | — | hard | Analytics subscribe to the bus and record events off the tick |
| mod_support | reads | content_database_git | — | hard | Mods would be extra data/ trees |
| pr_gates_workflow | reads | godot_version_pin | — | hard | CI installs the pinned engine version |
| export_build_pipeline | reads | godot_version_pin | — | hard | Builds use the pinned engine version |
| g0_style_parse | validates | plain_text_formats | — | soft | The headless import rejects binaries outside art/ and audio/ |
| graphics_quality_presets | reads | min_recommended_specs | — | hard | The medium preset is defined at the recommended spec |
| loom_doctor_gate | reads | loom_secrets_doctor | — | hard | The governance job runs the secrets scan |
| harness_adapters | reads | game_infra_spec | — | hard | The adapters restate the spec's digest and point at it |
| harness_adapters | reads | systems_atlas | — | hard | The ritual runs validate, which, checklist and impact |
| g6_feel_gate | validates | locomotion | latency, determinism | hard | The gate measures input-to-sim ticks and replays a recorded walk |
| g6_feel_gate | validates | third_person_rig | frame pacing | hard | The gate measures frame time and hitches during the camera soak |
| g6_feel_gate | validates | interpolation_prediction | error under latency | hard | The gate measures prediction error and corrections under a simulated network |
| g6_feel_gate | validates | render_interpolation | tick-locked visuals | hard | The gate fails a transform that only changes on ticks |
| g6_feel_gate | reads | benchmark_scene | scene | hard | The gate runs on the benchmark scene |
| g6_feel_gate | reads | frame_time_budget | budgets | hard | The gate asserts the budgets in docs/balance_ranges.md |
| determinism_replay_tests | validates | pure_movement_step | replay | hard | Replay tests are the proof that the step is pure |
