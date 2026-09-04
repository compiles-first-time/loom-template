# Economy — what exists, where it comes from, how it is made, how it moves

> **Analogy:** the town's supply chain. The product catalog (items), the raffle drum (loot), the kitchen (crafting), the trade guilds (professions), the coins (currencies), the market square (trade and vendors), and the warehouse (storage).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| economy | Economy | 1 | — | 2 | spec | content-smith | data/items/; data/loot_tables/; data/recipes/; core/crafting/; core/economy/ | §6.1, §6.2, §6.6 | Items, loot, crafting, professions, currencies, trade, storage | The town's supply chain |
| items | Items | 2 | economy | 0 | spec | content-smith | data/items/ | §6.1 | ItemDef content: categories, rarity, consumables, equipment, materials, stats, icons | The product catalog |
| item_categories_tags | Categories & tags | 3 | items | 0 | spec | content-smith | data/items/ | §6.1 tags | weapon, food, ore and other tags that systems filter on | — |
| rarity_tiers | Rarity tiers | 3 | items | 0 | spec | content-smith | data/items/ | §6.1 rarity | common, uncommon, rare, epic; drives UI color | — |
| consumables | Consumables | 3 | items | 0 | spec | content-smith | data/items/ | §6.1 on_use_effect | Items whose use applies an effect | — |
| equipment_items | Equipment items | 3 | items | 0 | spec | content-smith | data/items/ | §6.1 slot | Items with a slot other than none | — |
| materials_ingredients | Materials & ingredients | 3 | items | 2 | implied | content-smith | data/items/ | §6.2 inputs | Ore, wood, hide and the other recipe inputs | — |
| quest_items | Quest items | 3 | items | 2 | implied | content-smith | data/items/ | §6.7 collect | Items that exist to be collected or delivered | — |
| item_stats_block | Item stats block | 3 | items | 0 | spec | content-smith | data/items/ | §6.1 stats | damage, armor, attack_speed and any other stat key | — |
| item_icons_models | Item icons & models | 3 | items | 0 | spec | world-builder | art/icons/items/; art/models/items/ | §6.1 icon, model, §11 | Icon named by id; model optional | — |
| random_affixes | Random affixes | 3 | items | — | candidate | director | core/economy/affixes.gd | — | Rolled prefixes and suffixes on drops; a big economy decision | — |
| item_levels | Item levels | 3 | items | — | candidate | director | data/items/ | — | A single power number per item | — |
| loot | Loot | 2 | economy | 2 | spec | content-smith | data/loot_tables/; core/loot/ | §6.6 | Weighted tables, guaranteed drops, rolls on death, chests, group rules | A raffle drum: weighted tickets plus a guaranteed prize |
| loot_table_defs | Loot table definitions | 3 | loot | 0 | spec | content-smith | data/loot_tables/ | §6.6 | entries with relative weights and min/max, plus guaranteed | — |
| weighted_rolls | Weighted rolls | 3 | loot | 2 | spec | orchestrator | core/loot/roll.gd | §6.6, §4 R4 | Seeded weighted selection; property-tested | — |
| guaranteed_drops | Guaranteed drops | 3 | loot | 2 | spec | orchestrator | core/loot/roll.gd | §6.6 guaranteed | Always-drop entries alongside the roll | — |
| loot_rolls_on_death | Loot on death | 3 | loot | 2 | implied | orchestrator | core/loot/on_death.gd | §5 actor_died, §6.5 loot_table | Listens for deaths and rolls the enemy's table | — |
| world_chests_containers | World chests | 3 | loot | — | candidate | world-builder | scenes/prefabs/chests/ | — | Placed containers with loot tables and respawn | — |
| group_loot_rules | Group loot rules | 3 | loot | 4 | implied | orchestrator | core/loot/group.gd | §1 co-op | Free-for-all, round-robin or need/greed among a party | — |
| boss_loot_lockouts | Boss loot lockouts | 3 | loot | — | candidate | director | core/loot/lockouts.gd | — | One roll per boss per reset | — |
| pity_bad_luck_protection | Bad-luck protection | 3 | loot | — | candidate | director | core/loot/pity.gd | — | Rising odds after dry streaks, saved per character | — |
| loot_economy_tuning | Loot economy tuning | 3 | loot | 2 | implied | content-smith | docs/balance_ranges.md | §8 G2 | Drop rates and material flow as balance numbers | — |
| crafting | Crafting | 2 | economy | 3 | spec | orchestrator/content-smith | core/crafting/; data/recipes/ | §6.2 | Recipes, stations, timed crafts, unlocks | The kitchen: recipe cards plus stations plus time |
| recipe_defs | Recipe definitions | 3 | crafting | 0 | spec | content-smith | data/recipes/ | §6.2 | output, station, inputs, craft time, unlocked_by | — |
| crafting_stations | Crafting stations | 3 | crafting | 3 | spec | orchestrator | core/crafting/stations.gd | §6.2 station | hands, workbench, forge and the rest; the station must exist near the crafter | — |
| craft_time_queue | Craft queue | 3 | crafting | 3 | spec | orchestrator | core/crafting/queue.gd | §6.2 craft_time_s, §5 item_crafted | Timed crafts that consume inputs and emit item_crafted | — |
| recipe_unlocks | Recipe unlocks | 3 | crafting | 2 | spec | orchestrator | core/crafting/unlocks.gd | §6.2 unlocked_by | Known from start, or unlocked by a quest or item | — |
| salvage_disassembly | Salvage | 3 | crafting | — | candidate | director | core/crafting/salvage.gd | — | Breaking items back into materials | — |
| item_upgrades_enchanting | Upgrades & enchanting | 3 | crafting | — | candidate | director | core/crafting/upgrade.gd | — | Improving existing gear | — |
| crafting_quality_rolls | Crafting quality rolls | 3 | crafting | — | candidate | director | core/crafting/quality.gd | — | Variable outcome quality | — |
| repair | Repair | 3 | crafting | — | candidate | director | core/crafting/repair.gd | — | Restoring durability at a station | — |
| professions | Professions | 2 | economy | — | candidate | director | data/professions/; core/crafting/ | — | Named trades with skill levels gating recipes; absent from the spec | Trade guilds: blacksmith, alchemist, apprentice to master |
| profession_defs | Profession definitions | 3 | professions | — | candidate | director | data/professions/ | — | Data-defined trades | — |
| profession_skill_levels | Profession skill levels | 3 | professions | — | candidate | orchestrator | core/crafting/professions.gd | — | Skill-ups from crafting | — |
| profession_specializations | Profession specializations | 3 | professions | — | candidate | director | data/professions/ | — | Branches inside a trade | — |
| profession_recipe_gating | Recipe gating by skill | 3 | professions | — | candidate | orchestrator | core/crafting/professions.gd | — | Recipes require a skill level | — |
| gathering_professions | Gathering professions | 3 | professions | — | candidate | director | core/crafting/professions.gd | — | Mining and herbalism as skills | — |
| currencies | Currencies | 2 | economy | — | candidate | director | data/currencies/; core/economy/ | — | Coins and tokens; the spec rewards only xp and items | The coins in the town: gold, tokens, faction scrip |
| currency_defs | Currency definitions | 3 | currencies | — | candidate | director | data/currencies/ | — | Data-defined currencies | — |
| wallet | Wallet | 3 | currencies | — | candidate | orchestrator | core/economy/wallet.gd | — | Per-character balances; emits currency_changed | — |
| sinks_faucets | Sinks & faucets | 3 | currencies | — | candidate | director | docs/balance_ranges.md | — | Where currency enters and leaves; inflation control | — |
| faction_currencies | Faction currencies | 3 | currencies | — | candidate | director | data/currencies/ | — | Tokens tied to reputation | — |
| trade_vendors | Trade, vendors & markets | 2 | economy | — | candidate | director | core/economy/; data/vendors/ | — | Player trade, NPC shops, a market board, pricing and mail | The market square: stalls, haggling, notice boards |
| player_trade | Player trade | 3 | trade_vendors | — | candidate | orchestrator | core/economy/trade.gd | — | Direct exchange between two players; emits trade_completed | — |
| npc_vendors_stores | NPC vendors & stores | 3 | trade_vendors | — | candidate | director | data/vendors/; core/economy/vendor.gd | — | Buy and sell with NPC inventories | — |
| vendor_inventories_restock | Vendor restock | 3 | trade_vendors | — | candidate | orchestrator | core/economy/vendor.gd | — | Stock that refills over game time | — |
| market_board_auction | Market board | 3 | trade_vendors | — | candidate | director | core/economy/market.gd | — | Server-wide listings; an MMO feature at co-op scale | — |
| commodity_pricing | Commodity pricing | 3 | trade_vendors | — | candidate | director | core/economy/pricing.gd | — | Dynamic prices from supply and demand | — |
| mail_system | Mail | 3 | trade_vendors | — | candidate | director | core/economy/mail.gd | — | Sending items to offline players | — |
| storage_logistics | Storage & logistics | 2 | economy | 3 | implied | orchestrator | core/inventory/containers.gd; scenes/prefabs/ | §10 placed structures | Chests, shared storage, transfer rules, carts | The warehouse and shipping |
| chests_containers | Chests & containers | 3 | storage_logistics | 3 | implied | orchestrator | core/inventory/containers.gd | §13 Phase 3 build | Placed storage with its own inventory, saved with the world | — |
| shared_storage | Shared storage | 3 | storage_logistics | 4 | implied | orchestrator | core/inventory/containers.gd | §1 co-op | Containers any party member can use | — |
| item_transfer_rules | Item transfer rules | 3 | storage_logistics | 3 | implied | orchestrator | core/inventory/transfer.gd | — | Move, split and merge between inventories and containers | — |
| carts_transport | Carts & transport | 3 | storage_logistics | — | candidate | director | core/inventory/ | — | Movable bulk storage | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| items | reads | schema_item_def | ItemDef | hard | Every item file must match the schema |
| item_categories_tags | reads | schema_item_def | ItemDef.tags | hard | Tags are a schema field |
| rarity_tiers | reads | schema_item_def | ItemDef.rarity enum | hard | Rarity values are the schema's enum |
| consumables | references | effect_defs_content | ItemDef.on_use_effect | hard | A consumable names the effect it applies |
| equipment_items | reads | schema_item_def | ItemDef.slot enum | hard | Slot values are the schema's enum |
| materials_ingredients | reads | item_categories_tags | ore, wood, hide tags | hard | Materials are items tagged as such |
| quest_items | reads | quest_defs | objectives.collect | soft | Quest items exist because a quest collects them |
| item_stats_block | reads | schema_item_def | ItemDef.stats | hard | Stats are a schema dictionary |
| item_stats_block | reads | balance_ranges | stat ranges | hard | G2 rejects stats outside the documented ranges |
| item_icons_models | reads | icon_conventions | icon path by id | hard | Icons must be named by the item id |
| item_icons_models | reads | model_naming | model path by id | hard | Models must be named by the item id |
| random_affixes | reads | item_stats_block | rolled stats | hard | Affixes add rolled stats |
| random_affixes | reads | deterministic_sim | seeded roll | hard | Affix rolls are seeded |
| item_levels | reads | item_stats_block | derived power | hard | An item level summarizes the stats block |
| loot_table_defs | reads | schema_loot_table_def | LootTableDef | hard | Every table file must match the schema |
| loot_table_defs | references | items | entries[].item_id | hard | A table names the items it can drop |
| weighted_rolls | reads | loot_table_defs | entries and weights | hard | The roll reads the table |
| weighted_rolls | reads | deterministic_sim | seeded RNG | hard | Loot rolls on the seeded RNG so replays and servers agree |
| guaranteed_drops | reads | loot_table_defs | guaranteed | hard | Guaranteed entries are on the table |
| loot_rolls_on_death | reads | enemy_defs | EnemyDef.loot_table | hard | The dead enemy names its table |
| loot_rolls_on_death | reads | weighted_rolls | roll | hard | Death loot is a weighted roll |
| loot_rolls_on_death | reads | guaranteed_drops | guaranteed | hard | Plus the guaranteed entries |
| loot_rolls_on_death | reads | corpse_handling | drop location | soft | Loot appears at the corpse |
| world_chests_containers | reads | loot_table_defs | chest table | hard | Chests roll a table |
| world_chests_containers | reads | timers_cooldowns | respawn | soft | Chests can refill on a timer |
| group_loot_rules | reads | party_membership | who rolls | hard | Rules are applied among party members |
| group_loot_rules | reads | loot_rolls_on_death | drops to assign | hard | Rules decide who gets a drop |
| boss_loot_lockouts | reads | encounter_defs | boss id | hard | Lockouts are per encounter |
| boss_loot_lockouts | reads | world_state_flags | lockout flags | hard | A lockout is a saved flag |
| pity_bad_luck_protection | reads | weighted_rolls | adjusted weights | hard | Pity nudges the weights |
| pity_bad_luck_protection | reads | character_save_state | streak counters | hard | Streaks are saved per character |
| loot_economy_tuning | reads | balance_ranges | drop rates | hard | Drop rates are balance numbers |
| loot_economy_tuning | reads | loot_economy_sim | simulated outcomes | soft | A simulation would inform the numbers |
| recipe_defs | reads | schema_recipe_def | RecipeDef | hard | Every recipe file must match the schema |
| recipe_defs | references | items | output_item, inputs[].item_id | hard | A recipe names its output and inputs |
| recipe_defs | references | crafting_stations | RecipeDef.station | hard | A recipe names its station |
| crafting_stations | reads | schema_station_def | StationDef | hard | Stations need a definition |
| crafting_stations | reads | crafting_station_structures | placed station | hard | A station must be built and nearby |
| craft_time_queue | reads | recipe_defs | RecipeDef.craft_time_s | hard | Craft time is a recipe field |
| craft_time_queue | reads | timers_cooldowns | craft timer | hard | Crafts are timers |
| craft_time_queue | reads | inventory | consume inputs, add output | hard | Crafting moves items through the inventory |
| craft_time_queue | reads | intent_schema | craft intent | hard | Crafting is an intent |
| craft_time_queue | reads | crafting_stations | station in range | hard | The queue checks the station requirement |
| recipe_unlocks | reads | recipe_defs | RecipeDef.unlocked_by | hard | The unlock source is a recipe field |
| recipe_unlocks | references | quest_defs | quest id | soft | Some recipes unlock by quest |
| recipe_unlocks | references | items | item id | soft | Some recipes unlock by item |
| recipe_unlocks | reads | profession_recipe_gating | skill requirement | soft | If professions are approved, skill gates recipes |
| salvage_disassembly | reads | recipe_defs | reverse inputs | hard | Salvage is a recipe run backwards |
| salvage_disassembly | reads | deterministic_sim | seeded return | soft | Partial returns roll |
| item_upgrades_enchanting | reads | item_stats_block | modified stats | hard | Upgrades change the stats block |
| item_upgrades_enchanting | reads | currency_defs | cost | soft | Upgrades likely cost a currency |
| crafting_quality_rolls | reads | deterministic_sim | seeded roll | hard | Quality rolls on the seeded RNG |
| crafting_quality_rolls | reads | profession_skill_levels | skill bonus | soft | Skill improves quality if professions exist |
| repair | reads | durability_repair | durability value | hard | Repair restores durability |
| repair | reads | materials_ingredients | repair cost | soft | Repair consumes materials |
| profession_defs | reads | id_convention | profession ids | hard | Professions would carry ids like all content |
| profession_skill_levels | reads | craft_time_queue | skill-ups on craft | hard | Skill grows by crafting |
| profession_specializations | reads | profession_defs | parent trade | hard | A specialization belongs to a trade |
| profession_recipe_gating | reads | profession_skill_levels | current skill | hard | Gates compare against skill |
| gathering_professions | reads | resource_nodes | node harvests | hard | Gathering skill grows by harvesting |
| currency_defs | reads | id_convention | currency ids | hard | Currencies would carry ids like all content |
| wallet | reads | currency_defs | balances per currency | hard | The wallet holds one balance per currency |
| wallet | reads | character_save_state | saved balances | hard | Balances are saved with the character |
| sinks_faucets | reads | wallet | flows | hard | Sinks and faucets are accounted against the wallet |
| sinks_faucets | reads | balance_ranges | inflation targets | soft | Targets are balance data |
| faction_currencies | extends | currency_defs | currency kind | hard | A faction currency is a currency |
| faction_currencies | reads | reputation_tiers | earn rate | hard | Earned through faction standing |
| player_trade | reads | inventory | both inventories | hard | A trade moves items between inventories |
| player_trade | reads | sessions_players | both players online | hard | Trades need two connected players |
| player_trade | reads | intent_schema | trade intents | soft | Offers and accepts are intents |
| npc_vendors_stores | reads | npc_defs | vendor npc | hard | A vendor is an NPC |
| npc_vendors_stores | reads | wallet | pay | hard | Buying spends from the wallet |
| npc_vendors_stores | reads | items | stock ids | hard | Stock is item ids |
| vendor_inventories_restock | reads | npc_vendors_stores | stock | hard | Restock refills a vendor's stock |
| vendor_inventories_restock | reads | world_clock_ticks | over days | hard | Restock advances with the clock |
| market_board_auction | reads | wallet | bids and payouts | hard | Listings settle through wallets |
| market_board_auction | reads | server_database | listings | hard | Listings need server persistence |
| commodity_pricing | reads | market_board_auction | trade volume | hard | Prices react to market activity |
| commodity_pricing | reads | sinks_faucets | supply model | soft | Pricing models the same flows |
| mail_system | reads | server_database | mailboxes | hard | Mail needs server persistence |
| mail_system | reads | inventory | attachments | hard | Mail carries items |
| chests_containers | reads | storage_structures | placed chest | hard | A container inventory belongs to a placed structure |
| chests_containers | reads | inventory | container inventory model | hard | A container reuses the inventory model |
| chests_containers | reads | state_serialization | saved contents | hard | Contents are saved with the world |
| shared_storage | reads | chests_containers | container | hard | Shared storage is a container with open access |
| shared_storage | reads | party_membership | who may open | hard | Access follows the party |
| item_transfer_rules | reads | chests_containers | source and target | hard | Transfers move between inventories and containers |
| item_transfer_rules | reads | intent_schema | transfer intent | hard | A transfer is an intent |
| carts_transport | reads | placement | placed cart | soft | A cart is a placed, movable structure |
| carts_transport | reads | weight_encumbrance | cart capacity | hard | Carts have weight limits |
