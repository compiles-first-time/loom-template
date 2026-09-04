# Operations — the pit crew, the inspectors, and the maintenance logs

> **Analogy:** airport security lanes (gates), the assembly line's automatic inspection station (CI), shipping the boxed game (release), the dashboard warning lights and the black box (monitoring), the same film on a phone and in IMAX (hardware scalability), the key cabinet with a sign-out sheet (security), the binders every new hire reads (documentation), and the crew's radios and job cards (agent harness).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| operations | Operations | 1 | — | 0 | spec | test-pilot | tests/; .github/workflows/; tools/; docs/ | §8, §13 | Gates, CI, release, monitoring, hardware scalability, security, documentation, agent harness | The pit crew, the inspectors, and the maintenance logs |
| validation_gates | Validation gates | 2 | operations | 0 | spec | test-pilot | .github/workflows/gates.yml; tests/; tools/ | §8 | G0 to G5 plus determinism and performance checks | Airport security lanes: nothing boards without passing |
| g0_style_parse | G0 style and parse | 3 | validation_gates | 0 | spec | test-pilot | .github/workflows/gates.yml | §8 G0 | gdformat, gdlint and a headless import check | — |
| g1_unit_tests_gut | G1 unit tests | 3 | validation_gates | 0 | spec | test-pilot | tests/unit/ | §8 G1 | GUT unit tests with seeded RNG | — |
| g2_data_integrity | G2 data integrity | 3 | validation_gates | 0 | spec | test-pilot | tools/validate_data.gd | §8 G2 | Ids, references, paths, enums and ranges | — |
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
| versioning_changelog | Versioning & changelog | 3 | release_distribution | 0 | spec | orchestrator | docs/changelog.md | §7.1 | One changelog line per task; version tags | — |
| desktop_builds_win_linux | Desktop builds | 3 | release_distribution | 1 | spec | orchestrator | export_presets.cfg | §1, §2 | Windows and Linux builds | — |
| dedicated_server_distribution | Server distribution | 3 | release_distribution | 4 | implied | orchestrator | server/ | §13 Phase 4 | Shipping the headless server | — |
| patching_updates | Patching & updates | 3 | release_distribution | — | candidate | director | docs/ | — | Delivering updates to players | — |
| steam_platform | Steam platform | 3 | release_distribution | — | candidate | director | tools/ | — | Steamworks integration | — |
| mod_support | Mod support | 3 | release_distribution | — | candidate | director | data/; addons/ | — | Player-made content through the same data pipeline | — |
| monitoring_telemetry | Monitoring & telemetry | 2 | operations | 1 | implied | orchestrator | server/metrics; core/debug/ | — | Client overlays, server metrics, logs, crashes, alerts, analytics | The dashboard warning lights and the black box |
| client_perf_overlay | Client performance overlay | 3 | monitoring_telemetry | 1 | implied | orchestrator | core/debug/overlays.gd | — | Frame time, draw calls and memory on screen | — |
| server_health_metrics | Server health metrics | 3 | monitoring_telemetry | 4 | implied | orchestrator | server/metrics | — | Tick time, players, memory, save latency | — |
| log_aggregation | Log aggregation | 3 | monitoring_telemetry | — | candidate | orchestrator | server/ | — | Collect server logs centrally | — |
| crash_reporting | Crash reporting | 3 | monitoring_telemetry | — | candidate | orchestrator | tools/crash/ | — | Client and server crash bundles | — |
| alerting | Alerting | 3 | monitoring_telemetry | — | candidate | orchestrator | server/ | — | Notify the host on unhealthy metrics | — |
| gameplay_analytics | Gameplay analytics | 3 | monitoring_telemetry | — | candidate | director | server/analytics/ | — | Aggregate gameplay events for tuning | — |
| hardware_scalability | Hardware range & scalability | 2 | operations | 1 | implied | orchestrator | project.godot; core/settings/graphics.gd | §1 mid-range PCs | Specs, presets, scaling, fallbacks, benchmark, frame budget | The same film on a phone and in IMAX: different quality, same story |
| frame_time_budget | Frame time budget | 3 | hardware_scalability | 1 | implied | orchestrator | docs/balance_ranges.md | §1 | Milliseconds per frame per system on the target machine | — |
| min_recommended_specs | Minimum and recommended specs | 3 | hardware_scalability | 1 | implied | director | docs/ | §1 | The hardware the game targets | — |
| graphics_quality_presets | Graphics quality presets | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | §1 | Low, medium and high bundles | — |
| resolution_scaling | Resolution scaling | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | — | Render scale | — |
| lod_shadow_scaling | LOD and shadow scaling | 3 | hardware_scalability | 1 | implied | orchestrator | core/settings/graphics.gd | — | LOD bias and shadow quality | — |
| low_end_fallbacks | Low-end fallbacks | 3 | hardware_scalability | — | candidate | orchestrator | art/shaders/ | — | Simplified shader paths | — |
| benchmark_scene | Benchmark scene | 3 | hardware_scalability | — | candidate | test-pilot | scenes/benchmark.tscn | — | A fixed scene for measuring | — |
| security_secrets | Security & secrets | 2 | operations | 0 | spec | orchestrator | .env.example; tools/ | §4 R-SEC1, R10, §9 | Secrets in env, the dependency policy, Loom's secrets doctor | The key cabinet with a sign-out sheet |
| env_secrets | Environment secrets | 3 | security_secrets | 0 | spec | orchestrator | .env.example | R-SEC1 | Keys only in environment variables; never in code, data, logs or commits | — |
| dependency_policy_r10 | Dependency policy (R10) | 3 | security_secrets | 0 | spec | director | GAME_INFRA_SPEC.md | §4 R10, §2, §9 | A new addon, library, service or API requires a spec-change PR | — |
| loom_secrets_doctor | Loom secrets doctor | 3 | security_secrets | 0 | implied | orchestrator | scripts/secrets-doctor.sh | — | Loom's retrospective secret scan | — |
| documentation | Documentation | 2 | operations | 0 | spec | director/orchestrator | docs/ | §3, §13 | The spec, changelog, tech debt, migrations, engine version, the atlas | The binders on the shelf every new hire reads |
| game_infra_spec | GAME_INFRA_SPEC.md | 3 | documentation | 0 | spec | director | GAME_INFRA_SPEC.md | §0, §14 | The single source of truth; contract changes are PRs to it | — |
| changelog | Changelog | 3 | documentation | 0 | spec | orchestrator | docs/changelog.md | §7.1 | One line per task | — |
| tech_debt_log | Tech debt log | 3 | documentation | 0 | spec | orchestrator | docs/tech_debt.md | §4 R9 | Debt filed instead of fixed out of scope | — |
| migrations_doc | Migrations doc | 3 | documentation | 2 | spec | orchestrator | docs/migrations.md | §6 | Schema version notes | — |
| engine_version_doc | Engine version doc | 3 | documentation | 0 | spec | director | docs/ENGINE_VERSION.txt | §2 | The pinned engine version | — |
| systems_atlas | Systems atlas | 3 | documentation | 0 | implied | orchestrator | systems/ | — | This registry and its generated atlas; the impact map | — |
| agent_harness | Agent harness | 2 | operations | 0 | spec | orchestrator | .claude/; .agents/; .mcp.json | §7, §9, Appendix B | Skills, write scopes, the Godot MCP bridge, Loom's governance layer | The crew's radios and job cards |
| skills_materialized | Skills materialized | 3 | agent_harness | 0 | spec | orchestrator | .claude/skills/; .agents/skills/ | §7.2 | content-smith, world-builder, quest-writer and test-pilot as portable skills | — |
| write_scope_enforcement | Write scope enforcement | 3 | agent_harness | 0 | spec | orchestrator | .claude/; scripts/ | §7.1 | The orchestrator rejects diffs outside a role's write scope | — |
| godot_mcp_bridge | Godot MCP bridge | 3 | agent_harness | 0 | spec | orchestrator | .mcp.json | §9 | Run scenes headless, capture output, run tests | — |
| loom_governance_layer | Loom governance layer | 3 | agent_harness | 0 | implied | orchestrator | constitution/; scripts/; layers/ | Appendix B | Loom's constitution, hooks, doctor and atlas on top of the spec | — |
| subagent_mirrors | Subagent mirrors | 3 | agent_harness | — | candidate | orchestrator | .claude/agents/ | §7.2 | Optional subagents mirroring the four skills | — |

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
| g2_data_integrity | validates | loot | loot tables | hard | G2 checks every table |
| g2_data_integrity | validates | spell_effect_content | spells and effects | hard | G2 checks every spell and effect |
| g2_data_integrity | validates | enemies | enemy files | hard | G2 checks every enemy |
| g2_data_integrity | validates | quests | quest files | hard | G2 checks every quest and its target ids |
| g2_data_integrity | validates | dialogue | dialogue files | hard | G2 checks every dialogue |
| g2_data_integrity | validates | crafting | recipes | hard | G2 checks every recipe |
| g2_data_integrity | validates | biome_defs | biome files | hard | G2 checks every biome |
| g2_data_integrity | validates | prereq_dag | no cycles | hard | G2 rejects prerequisite cycles |
| g2_data_integrity | validates | npc_defs | npc files | soft | G2 will check NPCs once they have a schema |
| g3_smoke_boot | validates | gray_box_island | main scene | hard | Smoke boots the main scene |
| g3_smoke_boot | validates | engine_platform | boot | hard | Smoke proves the project boots |
| g4_bot_playtest | validates | locomotion | walk | hard | The bot walks |
| g4_bot_playtest | validates | gathering | gather | hard | The bot gathers |
| g4_bot_playtest | validates | crafting | craft | hard | The bot crafts |
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
| versioning_changelog | reads | changelog | lines | hard | Versions are cut from the changelog |
| desktop_builds_win_linux | reads | export_build_pipeline | builds | hard | Desktop builds come from the pipeline |
| dedicated_server_distribution | reads | dedicated_server_build | build | hard | The server ships as its build |
| patching_updates | reads | save_migrations | old saves | hard | A patch must keep old saves loading |
| patching_updates | reads | versioning_changelog | version | hard | Patches are versions |
| steam_platform | reads | authentication_provider | steam auth | soft | Steam brings its own identity |
| steam_platform | gated_by | dependency_policy_r10 | steamworks | hard | Steamworks is a new dependency |
| mod_support | reads | data_dir_as_db | mod data | hard | Mods are data in the same store |
| mod_support | reads | content_pipeline | same pipeline | hard | Mods enter through the same pipeline |
| client_perf_overlay | reads | debug_overlays | overlay | hard | The overlay is a debug overlay |
| server_health_metrics | reads | server_metrics_hooks | hooks | hard | Metrics read the server hooks |
| log_aggregation | reads | server_cli_headless | logs | hard | Logs come from the server process |
| crash_reporting | reads | export_build_pipeline | symbols | hard | Crash bundles need build symbols |
| crash_reporting | reads | in_game_bug_report | bundles | soft | Player reports share the format |
| alerting | reads | server_health_metrics | thresholds | hard | Alerts fire on metrics |
| gameplay_analytics | reads | gameplay_analytics_events | events | hard | Analytics aggregate stored events |
| frame_time_budget | reads | fixed_tick_sim | tick cost | hard | The sim tick is part of the budget |
| frame_time_budget | reads | min_recommended_specs | target machine | hard | The budget is measured on the target machine |
| graphics_quality_presets | extends | graphics_presets | presets | hard | The presets are the settings presets |
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
| engine_version_doc | reads | godot_version_pin | version | hard | The doc records the pin |
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
