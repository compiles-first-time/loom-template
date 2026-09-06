# Multiplayer — one referee holds the only true board

> **Analogy:** turning a single-player board game into a hosted table. The referee (dedicated server) holds the true scoreboard; players send requests (intents); the referee announces what happened (replication); the bouncer keeps the guest list (sessions); each department mails its paperwork to the central office (sync); the referee checks every request before applying it (validation); and someone rents the hall and keeps the lights on (hosting).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| multiplayer | Multiplayer | 1 | — | 4 | spec | orchestrator | core/net/; server/ | §12, §13 Phase 4, §10 | Server-authoritative networking for 2 to 10 players | A hosted table where one referee holds the only true board |
| net_architecture | Server-authoritative architecture | 2 | multiplayer | 4 | spec | orchestrator | core/net/ | §12 | Dedicated server, client and server roles, command ingest, tick sync | One referee holds the true scoreboard; players send requests |
| mmo_scale_sharding | MMO scale and sharding | 3 | net_architecture | — | non-goal | director | — | §1 non-goals | Thousands of concurrent players and sharding: the spec says do not build and do not prepare for it | — |
| dedicated_server_build | Dedicated server build | 3 | net_architecture | 4 | spec | orchestrator | export_presets.cfg; server/ | §13 Phase 4 | Headless server export | — |
| client_server_roles | Client and server roles | 3 | net_architecture | 4 | spec | orchestrator | core/net/roles.gd | §12 | The server simulates; clients present and send intents | — |
| command_ingest_server | Command ingest | 3 | net_architecture | 4 | spec | orchestrator | core/net/ingest.gd | §12 | Client intents arrive in the server's queue | — |
| tick_rate_sync | Tick rate sync | 3 | net_architecture | 4 | spec | orchestrator | core/net/tick.gd | §4 R4 | The server tick is the clock; clients follow | — |
| godot_multiplayer_api | Godot multiplayer transport | 3 | net_architecture | 4 | implied | orchestrator | core/net/ | §2 | ENet and the MultiplayerAPI as the transport | — |
| listen_server_option | Listen server option | 3 | net_architecture | — | candidate | director | core/net/ | — | A player hosts instead of a dedicated server | — |
| replication | Replication | 2 | multiplayer | 4 | spec | orchestrator | core/net/replication/ | §5 Phase 4 note | Server events and state mirrored to clients | The referee's announcements broadcast to every player's copy of the board |
| event_replication | Event replication | 3 | replication | 4 | spec | orchestrator | core/net/replication/events.gd | §5 | Server-emitted signals replicated to clients | — |
| state_snapshots_sync | State snapshots | 3 | replication | 4 | implied | orchestrator | core/net/replication/state.gd | §12 | Periodic state sync for actors and world | — |
| spawn_replication | Spawn replication | 3 | replication | 4 | implied | orchestrator | core/net/replication/spawn.gd | §5 actor_spawned | Spawns and despawns mirrored on clients | — |
| bandwidth_budget | Bandwidth budget | 3 | replication | 4 | implied | orchestrator | core/net/replication/ | — | Bytes per tick per client kept within a budget | — |
| interpolation_prediction | Interpolation & prediction | 3 | replication | — | candidate | director | core/net/replication/prediction.gd; core/net/replication/interpolation.gd | — | Client-side prediction of the local player with server reconciliation; snapshot interpolation of remote actors behind a two-tick buffer; nothing extrapolated by default (ADR-0068) | — |
| interest_management | Interest management | 3 | replication | — | candidate | orchestrator | core/net/replication/ | — | Send only what is near; small at ten players | — |
| sessions_players | Sessions & players | 2 | multiplayer | 4 | spec | orchestrator | core/net/session/ | §1 2 to 10 players | Join, leave, slots, reconnect, passwords, admin | The guest list and the bouncer |
| matchmaking_service | Matchmaking service | 3 | sessions_players | — | non-goal | director | — | §1 non-goals | No matchmaking service; players join by address | — |
| join_leave_flow | Join and leave | 3 | sessions_players | 4 | implied | orchestrator | core/net/session/join.gd | — | Handshake, spawn and departure; emits player joined and left | — |
| player_slots_cap | Player slots | 3 | sessions_players | 4 | spec | orchestrator | core/net/session/ | §1 | 2 to 10 players | — |
| reconnection | Reconnection | 3 | sessions_players | 4 | implied | orchestrator | core/net/session/reconnect.gd | — | Rejoin to the same character | — |
| player_identity_local | Local player identity | 3 | sessions_players | 4 | implied | orchestrator | core/net/session/identity.gd | §10 | A local id per player; no accounts | — |
| direct_ip_join | Direct join | 3 | sessions_players | 4 | spec | orchestrator | core/net/session/ | §1 no matchmaking | Join by address; no matchmaking service | — |
| sync_domains | Per-system sync | 2 | multiplayer | 4 | implied | orchestrator | core/net/sync/ | — | Combat, inventory, building, time, quests and survival mirrored from the server | Each department's paperwork mailed to the central office |
| combat_sync | Combat sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | Hits, casts and effects from the server | — |
| inventory_sync | Inventory sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | Inventories owned by the server | — |
| building_sync | Building sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | Placed pieces mirrored to clients | — |
| world_time_sync | World time sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | One clock for everyone | — |
| quest_sync | Quest sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | Quest state per player from the server | — |
| survival_sync | Survival sync | 3 | sync_domains | 4 | implied | orchestrator | core/net/sync/ | — | Needs owned by the server | — |
| net_validation_security | Validation & anti-cheat | 2 | multiplayer | 4 | implied | orchestrator | core/net/validate/ | §12 | The server checks every command; light anti-cheat for co-op | The referee checks every request before applying it |
| command_validation | Command validation | 3 | net_validation_security | 4 | implied | orchestrator | core/net/validate/commands.gd | §12 | Range, cooldown and ownership checks server-side | — |
| rate_limits | Rate limits | 3 | net_validation_security | — | candidate | orchestrator | core/net/validate/ | — | Per-client command rate caps | — |
| save_tamper_resistance | Save tamper resistance | 3 | net_validation_security | — | candidate | director | core/saving/ | — | Signed or server-owned saves | — |
| hosting_ops | Hosting & server ops | 2 | multiplayer | 4 | implied | orchestrator | server/; docs/ | §10 | Headless CLI, persistence, admin commands, metrics | Renting the hall and keeping the lights on |
| server_cli_headless | Headless server CLI | 3 | hosting_ops | 4 | implied | orchestrator | server/ | — | Start, stop and configure from the command line | — |
| server_admin_commands | Server admin commands | 3 | hosting_ops | 4 | implied | orchestrator | server/admin | — | Console commands for the host: kick, ban, whitelist and the GM console with admin rights | — |
| content_version_handshake | Content version handshake | 3 | sessions_players | 4 | implied | orchestrator | core/net/session/version.gd | §10, §12 | Client and server compare build and data/ versions on join; a mismatch is refused with a clear message | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| dedicated_server_build | reads | export_presets | server preset | hard | The server is an export preset |
| dedicated_server_build | reads | server_cli_headless | entry point | hard | The build runs the headless CLI |
| client_server_roles | reads | godot_multiplayer_api | authority | hard | Roles are expressed as multiplayer authority |
| client_server_roles | reads | sim_presentation_split | client is presentation | hard | The split is what lets clients be presentation-only (R5) |
| command_ingest_server | reads | intent_schema | typed intents | hard | The server receives the same intents the sim already uses (§12) |
| command_ingest_server | reads | intent_dispatch | server queue | hard | Ingested intents go to the dispatcher |
| tick_rate_sync | reads | fixed_tick_sim | server tick | hard | The server's tick is the fixed tick |
| godot_multiplayer_api | reads | project_settings | network settings | hard | Transport settings are project settings |
| listen_server_option | reads | client_server_roles | host is also a client | hard | A listen server merges the roles |
| event_replication | transports | event_bus | signals | hard | Replication carries every server-emitted signal |
| event_replication | reads | client_server_roles | server emits | hard | Only the server emits in multiplayer |
| state_snapshots_sync | transports | state_serialization | state | hard | Snapshots reuse the save serializer |
| state_snapshots_sync | reads | actor_state_sync_hooks | actor state | hard | Snapshots read the actor sync hooks |
| spawn_replication | transports | actor_lifecycle | spawns | hard | Spawns are mirrored |
| bandwidth_budget | reads | state_snapshots_sync | bytes per tick | hard | The budget bounds snapshot size |
| interpolation_prediction | reads | locomotion | predicted movement | soft | Prediction usually starts with movement |
| interpolation_prediction | reads | casting | predicted casts | soft | Casts may be predicted for feel |
| interest_management | reads | chunk_streaming | relevance by area | soft | Relevance can follow streaming chunks |
| interest_management | reads | actor_registry | distance | hard | Relevance is computed per actor |
| join_leave_flow | reads | player_identity_local | who joined | hard | Joins carry a player identity |
| join_leave_flow | reads | spawn_hubs | where to spawn | hard | New players spawn at a hub |
| join_leave_flow | reads | character_save_state | restore character | hard | A returning player gets their character back |
| reconnection | reads | per_player_save_in_world | saved character | hard | Reconnecting restores the saved character |
| reconnection | reads | player_identity_local | identity match | hard | The same identity reconnects |
| player_identity_local | reads | user_settings_store | stored id | hard | The local id is stored with settings |
| direct_ip_join | reads | godot_multiplayer_api | connect | hard | Joining is a transport connect |
| sync_domains | reads | event_replication | events | hard | Every sync domain rides on event replication |
| combat_sync | transports | combat | hits, casts, effects | hard | Combat outcomes are server-owned |
| inventory_sync | transports | inventory | bags | hard | Inventories are server-owned |
| building_sync | transports | building | placed pieces | hard | Placement is server-owned |
| world_time_sync | transports | day_night_cycle | clock | hard | The clock is server-owned |
| quest_sync | transports | quests | quest state | hard | Quest state is server-owned |
| survival_sync | transports | needs | needs | hard | Needs are server-owned |
| command_validation | extends | intent_validation | server side | hard | Server validation is the intent validation run with authority |
| command_validation | reads | command_ingest_server | incoming intents | hard | Validation runs on ingested intents |
| command_validation | reads | cooldown_manager | cooldown check | hard | The server refuses casts on cooldown |
| command_validation | reads | range_los_check | range check | hard | The server refuses out-of-range casts |
| rate_limits | reads | command_validation | rate per client | hard | Limits sit in front of validation |
| save_tamper_resistance | reads | world_save_json | signed saves | hard | Tamper resistance wraps the save format |
| server_cli_headless | reads | export_presets | headless preset | hard | The CLI runs the headless build |
| server_admin_commands | extends | gm_console | server variant | hard | Admin commands are the GM console with authority |
| join_leave_flow | reads | server_rules_config | — | hard | Password and rules are checked on join |
| player_slots_cap | reads | server_rules_config | — | hard | The slot cap is a server rule |
| sync_domains | transports | loot | — | hard | Loot rolls are server-owned; clients never roll; no dedicated sync part yet |
| sync_domains | transports | crafting | — | hard | Craft timers and outputs are server-owned; no dedicated sync part yet |
| sync_domains | transports | progression | — | hard | XP and levels are server-owned; no dedicated sync part yet |
| sync_domains | transports | equipment | — | hard | Equipped state replicates from the server; no dedicated sync part yet |
| sync_domains | transports | gathering | — | hard | Node depletion and yields are server-owned; no dedicated sync part yet |
| sync_domains | transports | world_state_flags | — | hard | Flags and counters replicate as a snapshot; no dedicated sync part yet |
| server_admin_commands | reads | player_identity_local | — | hard | Kicks and bans need an identity to name |
| client_server_roles | extends | local_authority_mode | — | hard | Phase 4 replaces the local authority with server roles |
| content_version_handshake | reads | join_leave_flow | — | hard | The check runs during join |
| content_version_handshake | reads | content_database_git | — | hard | The data/ version is what is compared |
| interpolation_prediction | reads | pure_movement_step | re-simulation | hard | Prediction re-runs the same step the server runs |
| interpolation_prediction | reads | tick_rate_sync | acknowledged tick | hard | Reconciliation restarts from the last tick the server acknowledged |
| interpolation_prediction | reads | state_snapshots_sync | server snapshots | hard | Remote actors are interpolated between the snapshots the server sends |
| interpolation_prediction | reads | command_ingest_server | input acknowledgement | soft | The server's acknowledgement of an intent tells the client which predicted ticks are confirmed |
