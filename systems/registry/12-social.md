# Social — the guild hall

> **Analogy:** your adventuring party (groups), a club with a clubhouse and a shared bank (guilds), standing with each village from stranger to honored (reputation and factions), the walkie-talkies and hand signals (communication), and the house rules the host enforces (community and admin).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| social | Social | 1 | — | 4 | implied | orchestrator | core/social/ | §1 co-op | Groups, guilds, reputation and factions, communication, community rules | The guild hall |
| groups_parties | Groups & parties | 2 | social | 4 | implied | orchestrator | core/social/party.gd | §1 2 to 10 co-op | Membership, roles, loot rules, raid groups | Your adventuring party |
| party_membership | Party membership | 3 | groups_parties | 4 | implied | orchestrator | core/social/party.gd | — | Who is in the party; in co-op the server is the party | — |
| party_roles | Party roles | 3 | groups_parties | 4 | implied | orchestrator | core/social/party.gd | — | Declared roles for frames and raid checks | — |
| ready_checks | Ready checks | 3 | groups_parties | — | candidate | orchestrator | core/social/party.gd | — | Everyone ready before a pull | — |
| guilds | Guilds | 2 | social | — | candidate | director | core/social/guild.gd | — | Persistent clubs with banks and ranks; an MMO structure at co-op scale | A club with a clubhouse and a shared bank |
| guild_defs_membership | Guild identity & membership | 3 | guilds | — | candidate | director | core/social/guild.gd | — | Guild identity and members | — |
| guild_bank | Guild bank | 3 | guilds | — | candidate | director | core/social/guild.gd | — | Shared storage with permissions | — |
| guild_ranks_permissions | Guild ranks | 3 | guilds | — | candidate | director | core/social/guild.gd | — | Ranks and what they may do | — |
| guild_halls | Guild halls | 3 | guilds | — | candidate | director | core/building/ | — | A guild-owned building | — |
| reputation_factions | Reputation & factions | 2 | social | — | candidate | director | data/factions/; core/social/reputation.gd | — | Factions, standing tiers, sources, unlocks, hostility, alignment | Standing with each village: stranger, friend, honored |
| faction_defs | Faction definitions | 3 | reputation_factions | — | candidate | director | data/factions/ | — | Data-defined factions | — |
| reputation_tiers | Reputation tiers | 3 | reputation_factions | — | candidate | orchestrator | core/social/reputation.gd | — | Thresholds from hated to exalted | — |
| reputation_sources | Reputation sources | 3 | reputation_factions | — | candidate | orchestrator | core/social/reputation.gd | — | Kills and quests move standing; emits reputation_changed | — |
| faction_unlocks_vendors | Faction unlocks | 3 | reputation_factions | — | candidate | director | data/factions/ | — | Vendors and recipes gated by standing | — |
| player_alignment | Player alignment | 3 | reputation_factions | — | candidate | director | core/social/ | — | A player-side alignment track | — |
| communication | Communication | 2 | social | 4 | implied | orchestrator | ui/; core/net/ | — | Chat, pings, and candidate emotes and voice | The walkie-talkies and hand signals |
| text_chat | Text chat | 3 | communication | 4 | implied | orchestrator | core/net/chat.gd | — | Server-relayed text | — |
| pings_markers | Pings & markers | 3 | communication | 4 | implied | orchestrator | core/net/pings.gd | — | Shared world markers | — |
| emotes | Emotes | 3 | communication | — | candidate | director | data/emotes/ | — | Animated emotes | — |
| voice_chat | Voice chat | 3 | communication | — | candidate | director | core/net/voice.gd | — | In-game voice; a new dependency | — |
| community_admin | Community & admin | 2 | social | 4 | implied | orchestrator | server/ | — | House rules, friends, blocking | The house rules and the host who enforces them |
| server_rules_config | Server rules | 3 | community_admin | 4 | implied | orchestrator | server/config | — | Password, slot cap, friendly fire, loot rule and PvP flag as one server config | — |
| friends_list | Friends list | 3 | community_admin | — | candidate | director | core/social/ | — | Needs identity that spans servers | — |
| block_mute | Block & mute | 3 | community_admin | — | candidate | orchestrator | core/social/ | — | Per-player mute and block | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| party_membership | reads | sessions_players | connected players | hard | The party is drawn from connected players |
| party_membership | reads | player_identity_local | identities | hard | Members are identities |
| party_roles | reads | party_membership | members | hard | Roles are per member |
| party_roles | reads | role_specs | declared spec | soft | If specs exist, roles come from them |
| ready_checks | reads | party_membership | members | hard | Everyone in the party answers |
| guild_defs_membership | reads | player_identity_local | members | hard | Members are identities |
| guild_defs_membership | reads | server_database | persistence | hard | Guilds persist on the server |
| guild_bank | reads | shared_storage | storage | hard | A guild bank is shared storage |
| guild_bank | reads | guild_ranks_permissions | who may withdraw | hard | Bank access follows rank |
| guild_ranks_permissions | reads | guild_defs_membership | members | hard | Ranks are assigned to members |
| guild_halls | reads | player_home | building | hard | A hall is a home owned by the guild |
| guild_halls | reads | guild_defs_membership | owner | hard | The hall belongs to the guild |
| faction_defs | reads | schema_faction_def | FactionDef | hard | Factions need a schema |
| reputation_tiers | reads | faction_defs | per faction | hard | Tiers are per faction |
| reputation_sources | reads | faction_defs | which faction | hard | Sources credit a faction |
| reputation_sources | reads | character_save_state | saved standing | hard | Standing is saved per character |
| faction_unlocks_vendors | reads | reputation_tiers | tier reached | hard | Unlocks open at a tier |
| faction_unlocks_vendors | reads | npc_vendors_stores | gated stock | hard | Unlocks gate vendor stock |
| faction_unlocks_vendors | reads | recipe_unlocks | gated recipes | soft | Unlocks can gate recipes |
| player_alignment | reads | reputation_sources | choices | hard | Alignment is driven by the same sources |
| text_chat | reads | sessions_players | senders | hard | Chat is between connected players |
| text_chat | reads | event_replication | relay | soft | Chat rides on replication |
| pings_markers | reads | markers_waypoints | marker model | hard | A ping is a temporary marker |
| pings_markers | reads | event_replication | broadcast | hard | Pings are replicated |
| emotes | reads | facial_emotes | animations | hard | Emotes play animations |
| emotes | reads | intent_schema | emote intent | soft | An emote is an intent |
| voice_chat | reads | net_architecture | transport | hard | Voice rides the network layer |
| voice_chat | gated_by | dependency_policy_r10 | voice library | hard | A voice library is a new dependency |
| server_rules_config | reads | friendly_fire_rules | friendly fire default | hard | The host sets friendly fire |
| server_rules_config | reads | pvp_flagging | pvp default | soft | If PvP exists, the host can disable it |
| friends_list | reads | account_identity | cross-server identity | hard | Friends need identity beyond one server |
| block_mute | reads | text_chat | mute | hard | Muting filters chat |
| block_mute | reads | player_identity_local | who | hard | Blocks are per identity |
| server_rules_config | reads | user_settings_store | — | soft | The host's saved server settings seed the rules |
| server_rules_config | reads | group_loot_rules | — | hard | The server's loot rule is the party's default |
| party_roles | reads | roles | — | soft | A party role is a combat role |
