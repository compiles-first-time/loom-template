# Combat — who hit whom, for how much, and what happens next

> **Analogy:** the referee and the rulebook of a fight. Casting is the pitching machine, status effects are sticky notes that change the rules while attached, and threat is the list a guard dog keeps of who is loudest.

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| combat | Combat | 1 | — | 1 | spec | orchestrator | core/combat/; data/spells/; data/effects/ | §3, §5, §6.3, §6.4 | Damage, casting, status effects, weapons, threat, roles, and the spell and effect content | The referee and rulebook of a fight |
| damage_model | Damage model | 2 | combat | 1 | spec | orchestrator | core/combat/damage.gd | §5 actor_damaged, actor_healed, actor_died | Resolves hits into numbers and deaths; emits the three most-listened signals | The scoring table |
| damage_formula | Damage formula | 3 | damage_model | 1 | implied | orchestrator | core/combat/damage.gd | — | attack stat, weapon or spell magnitude, mitigation and rolls into one number; pure and seeded | — |
| damage_types_elements | Damage types & elements | 3 | damage_model | 1 | spec | orchestrator | core/combat/damage.gd | §6.3 element | physical, fire, frost, nature, arcane, shadow | — |
| armor_mitigation | Armor mitigation | 3 | damage_model | 1 | spec | orchestrator | core/combat/damage.gd | §6.5 armor | Physical damage reduced by armor with a documented curve | — |
| resistances_application | Resistance application | 3 | damage_model | 2 | implied | orchestrator | core/combat/damage.gd | §6.3 element | Elemental damage reduced by the target's resistance | — |
| crit_hit_tables | Crit / hit tables | 3 | damage_model | — | candidate | director | core/combat/damage.gd | — | Critical, dodge, parry and block rolls; not in the spec | — |
| friendly_fire_rules | Friendly fire rules | 3 | damage_model | 1 | implied | orchestrator | core/combat/damage.gd | §1 co-op | Whether players and their allies can hurt each other | — |
| death_resolution | Death resolution | 3 | damage_model | 1 | spec | orchestrator | core/combat/death.gd | §5 actor_died | Health at zero becomes a death event with the killer named | — |
| healing_model | Healing model | 3 | damage_model | 2 | spec | orchestrator | core/combat/heal.gd | §5 actor_healed | Heals with overheal clamped to max health; emits actor_healed | — |
| casting | Casting & delivery | 2 | combat | 2 | spec | orchestrator | core/combat/casting/ | §6.3 | Cast time, cooldowns, cost, range, targeting and the five delivery verbs | The pitching machine: load, aim, fire, wait to reload |
| cast_timing | Cast timing | 3 | casting | 2 | spec | orchestrator | core/combat/casting/cast.gd | §6.3 cast_time_s | Instant or timed casts resolved on the tick; emits spell_cast and applies effects | — |
| cooldown_manager | Cooldown manager | 3 | casting | 2 | spec | orchestrator | core/combat/casting/cooldowns.gd | §6.3 cooldown_s | Per-actor per-spell cooldown timers | — |
| resource_cost_check | Resource cost check | 3 | casting | 2 | spec | orchestrator | core/combat/casting/cost.gd | §6.3 cost | Refuses a cast the actor cannot pay for, then deducts | — |
| range_los_check | Range & line of sight | 3 | casting | 2 | spec | orchestrator | core/combat/casting/range.gd | §6.3 range_m | Range and LoS validated before a cast starts | — |
| targeting_modes | Targeting modes | 3 | casting | 2 | spec | orchestrator | core/combat/casting/targeting.gd | §6.3 delivery | target, self, ground point, or none, chosen by delivery | — |
| projectile_delivery | Projectile delivery | 3 | casting | 2 | spec | orchestrator | core/combat/casting/projectile.gd | §6.3 projectile_speed | Simulated projectile on the tick with deterministic hit resolution | — |
| beam_delivery | Beam delivery | 3 | casting | 2 | spec | orchestrator | core/combat/casting/beam.gd | §6.3 delivery | Instant line hit within range and LoS | — |
| ground_aoe_delivery | Ground AoE delivery | 3 | casting | 2 | spec | orchestrator | core/combat/casting/aoe.gd | §6.3 aoe_radius_m | Radius around a ground point; also the shape bosses telegraph | — |
| self_target_delivery | Self / target delivery | 3 | casting | 2 | spec | orchestrator | core/combat/casting/direct.gd | §6.3 delivery | Direct application to self or the current target | — |
| interrupts | Interrupts | 3 | casting | — | candidate | director | core/combat/casting/ | — | Cancelling another actor's cast and locking the school | — |
| global_cooldown | Global cooldown | 3 | casting | — | candidate | director | core/combat/casting/ | — | A shared short cooldown after any cast; a feel decision | — |
| spell_queueing | Spell queueing | 3 | casting | — | candidate | orchestrator | core/combat/casting/ | — | Buffering the next cast before the current one ends | — |
| channeling | Channeling | 3 | casting | — | candidate | orchestrator | core/combat/casting/ | — | Casts that apply repeatedly while held | — |
| status_effects | Status effects | 2 | combat | 2 | spec | orchestrator | core/combat/effects/ | §6.4 | Buffs and debuffs: the six verbs, stacking, ticking, expiry | Sticky notes that change the rules while attached |
| effect_kinds_verbs | Effect verbs | 3 | status_effects | 2 | spec | orchestrator | core/combat/effects/apply.gd | §6.4 kind | dot, hot, stat_mod, stun, slow, shield; applying one emits effect_applied | — |
| effect_stacking | Effect stacking | 3 | status_effects | 2 | spec | orchestrator | core/combat/effects/stacking.gd | §6.4 stacking | none, refresh, stack_count | — |
| effect_ticking | Effect ticking | 3 | status_effects | 2 | spec | orchestrator | core/combat/effects/tick.gd | §6.4 tick_interval_s | dot and hot pulses on tick intervals | — |
| effect_duration_expiry | Duration & expiry | 3 | status_effects | 2 | spec | orchestrator | core/combat/effects/expiry.gd | §6.4 duration_s | Tick-counted durations; emits effect_expired | — |
| dispel_cleanse | Dispel / cleanse | 3 | status_effects | — | candidate | director | core/combat/effects/ | — | Removing effects by element or kind | — |
| immunities | Immunities | 3 | status_effects | — | candidate | director | core/combat/effects/ | — | Actors immune to certain kinds or elements, for bosses especially | — |
| crowd_control_dr | Crowd-control diminishing returns | 3 | status_effects | — | candidate | director | core/combat/effects/ | — | Shorter repeated stuns; mostly a PvP concern | — |
| auras_area_effects | Auras | 3 | status_effects | — | candidate | orchestrator | core/combat/effects/ | — | Effects applied to everyone inside a radius while a source lives | — |
| melee_weapons | Melee & weapon combat | 2 | combat | 1 | spec | orchestrator | core/combat/melee/ | §13 Phase 1 one weapon | Swings, hit detection, blocking; the Phase 1 feel target | Sword-fighting choreography: swing windows, blocks, hit frames |
| auto_attack_swing | Attack swing | 3 | melee_weapons | 1 | implied | orchestrator | core/combat/melee/swing.gd | §6.1 attack_speed | Attack intent becomes a timed swing with an active window | — |
| hit_detection | Hit detection | 3 | melee_weapons | 1 | implied | director | core/combat/melee/hit.gd | — | Hitbox sweep versus tab-target is a DIRECTOR decision that sets the whole feel | — |
| weapon_attack_speed | Weapon attack speed | 3 | melee_weapons | 1 | spec | orchestrator | core/combat/melee/swing.gd | §6.1 stats.attack_speed | Swing cadence from the weapon's stats | — |
| blocking_parry | Blocking & parry | 3 | melee_weapons | — | candidate | director | core/combat/melee/ | — | Timed defense that reduces or negates a hit | — |
| combos | Combos | 3 | melee_weapons | — | candidate | director | core/combat/melee/ | — | Chained swings with different windows and damage | — |
| ranged_weapons | Ranged weapons | 3 | melee_weapons | — | candidate | orchestrator | core/combat/melee/ | — | Bows and throwables reusing projectile delivery | — |
| threat_aggro | Threat & aggro | 2 | combat | 2 | implied | orchestrator | core/combat/threat/ | §1 WoW-style | The per-enemy list of who deserves attention; what makes tanking possible | The list a guard dog keeps of who is loudest |
| threat_table | Threat table | 3 | threat_aggro | 2 | implied | orchestrator | core/combat/threat/table.gd | — | Per-enemy threat per actor, built from damage, healing and taunts | — |
| taunt | Taunt | 3 | threat_aggro | — | candidate | orchestrator | core/combat/threat/ | — | Forces the target's attention to the taunter | — |
| threat_modifiers | Threat modifiers | 3 | threat_aggro | — | candidate | orchestrator | core/combat/threat/ | — | Role-based threat multipliers | — |
| leash_reset | Leash & reset | 3 | threat_aggro | 2 | implied | orchestrator | core/combat/threat/leash.gd | — | Enemies drop threat and reset when dragged too far | — |
| roles | Combat roles | 2 | combat | 2 | implied | orchestrator | core/combat/; data/spells/ | §1 | The tank, healer, DPS and support kits expressed as spell and stat patterns | Positions on a sports team |
| tanking_kit | Tanking kit | 3 | roles | 2 | implied | content-smith | data/spells/ | — | Threat generation and mitigation tools | — |
| healing_kit | Healing kit | 3 | roles | 2 | implied | content-smith | data/spells/ | §5 actor_healed | Direct heals, hots, shields | — |
| dps_kit | DPS kit | 3 | roles | 2 | implied | content-smith | data/spells/ | — | Damage rotations by element | — |
| support_enhance_kit | Support / enhance kit | 3 | roles | — | candidate | director | data/spells/ | — | Buffs and utility as a fourth role | — |
| role_balance_targets | Role balance targets | 3 | roles | — | candidate | director | docs/balance_ranges.md | — | Target numbers per role so tuning has a goal | — |
| pvp | PvP | 2 | combat | — | candidate | director | core/combat/pvp/ | — | Player-versus-player rules; the spec is co-op only, so this is a scope decision | Friendly sparring at the gym versus the team game |
| pvp_flagging | PvP flagging | 3 | pvp | — | candidate | director | core/combat/pvp/ | — | Opting into being attackable | — |
| dueling | Dueling | 3 | pvp | — | candidate | director | core/combat/pvp/ | — | Consensual one-on-one fights | — |
| arenas | Arenas | 3 | pvp | — | candidate | director | scenes/arenas/ | — | Dedicated fight spaces | — |
| pvp_balance_split | PvP balance split | 3 | pvp | — | candidate | director | data/spells/ | — | Separate numbers for spells against players | — |
| faction_warfare | Faction warfare | 3 | pvp | — | candidate | director | core/combat/pvp/ | — | Faction-based hostility between players | — |
| spell_effect_content | Spells & effects content | 2 | combat | 0 | spec | content-smith | data/spells/; data/effects/ | §6.3, §6.4, §6.9 | The SpellDef and StatusEffectDef files the casting and effect systems execute | The recipe cards for every spell and every sticky note |
| spell_defs_content | Spell definitions | 3 | spell_effect_content | 0 | spec | content-smith | data/spells/ | §6.3 | One .tres per spell; Fireball is the worked example | — |
| effect_defs_content | Effect definitions | 3 | spell_effect_content | 0 | spec | content-smith | data/effects/ | §6.4 | One .tres per status effect | — |
| element_matrix | Element matrix | 3 | spell_effect_content | — | candidate | content-smith | docs/balance_ranges.md | — | Which element beats which, as data | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| damage_formula | reads | derived_stats | attack, armor | hard | The formula's inputs are derived stats |
| damage_formula | reads | deterministic_sim | seeded rolls | hard | Variance and crits roll on the seeded RNG (R4) |
| damage_formula | reads | balance_ranges | curve constants | soft | Mitigation curves are balance data |
| damage_formula | reads | fixed_tick_sim | resolve on tick | hard | Hits resolve on the tick, never on animation frames |
| damage_types_elements | reads | schema_spell_def | element enum | hard | The element list is the schema's enum |
| armor_mitigation | reads | derived_stats | armor | hard | Mitigation is a function of the target's armor stat |
| resistances_application | reads | resistances | per-element values | hard | Elemental damage consults the target's resistances |
| crit_hit_tables | reads | deterministic_sim | seeded rolls | hard | Hit tables roll on the seeded RNG |
| crit_hit_tables | reads | derived_stats | crit, dodge, parry ratings | hard | Table chances come from stats |
| friendly_fire_rules | reads | party_membership | ally check | soft | In co-op, party members are usually immune to each other |
| death_resolution | reads | health_pool | health at zero | hard | Death is the health pool reaching zero |
| healing_model | reads | health_pool | clamp to max | hard | Heals write to the pool and clamp at max |
| healing_model | reads | derived_stats | healing power | soft | Heal magnitude may scale with a stat |
| cast_timing | reads | spell_defs_content | SpellDef.cast_time_s | hard | Cast duration is a spell field |
| cast_timing | reads | fixed_tick_sim | tick | hard | Cast time counts ticks |
| cast_timing | reads | intent_dispatch | cast intent | hard | A cast begins from a dispatched intent (§12) |
| cast_timing | reads | resource_cost_check | can pay | hard | A cast that cannot be paid for never starts |
| cast_timing | reads | range_los_check | in range | hard | A cast out of range never starts |
| cast_timing | reads | targeting_modes | resolved target | hard | The cast needs a resolved target or point |
| cast_timing | calls | effect_kinds_verbs | apply effects list | hard | A landed cast applies its effect list; both live in core/combat so this is one system subtree |
| cooldown_manager | reads | spell_defs_content | SpellDef.cooldown_s | hard | Cooldown length is a spell field |
| cooldown_manager | reads | timers_cooldowns | tick timers | hard | Cooldowns are shared tick timers |
| resource_cost_check | reads | spell_defs_content | SpellDef.cost | hard | Cost resource and amount are spell fields |
| resource_cost_check | reads | mana_pool | current mana | hard | Mana costs read the mana pool |
| resource_cost_check | reads | stamina_pool | current stamina | hard | Stamina costs read the stamina pool |
| resource_cost_check | reads | health_pool | current health | hard | Health costs read the health pool |
| resource_cost_check | reads | energy_pool | current energy | soft | Only if energy is approved and the enum extended |
| resource_cost_check | reads | rage_pool | current rage | soft | Only if rage is approved |
| resource_cost_check | reads | focus_pool | current focus | soft | Only if focus is approved |
| resource_cost_check | reads | divinity_pool | current divinity | soft | Only if divinity is approved |
| resource_cost_check | reads | corruption_pool | current corruption | soft | Only if corruption is approved |
| range_los_check | reads | spell_defs_content | SpellDef.range_m | hard | Range is a spell field |
| range_los_check | reads | collision_layers | LoS raycast | hard | Line of sight is a physics query against the right layers |
| targeting_modes | reads | spell_defs_content | SpellDef.delivery | hard | Delivery selects the targeting mode |
| targeting_modes | reads | actor_registry | target ids | hard | Targets are actor ids |
| projectile_delivery | reads | spell_defs_content | SpellDef.projectile_speed | hard | Speed is a spell field |
| projectile_delivery | reads | physics_collision | projectile collision | hard | Projectiles collide with the world and actors |
| projectile_delivery | reads | deterministic_sim | tick-stepped flight | hard | Flight is stepped on the tick so all clients agree |
| beam_delivery | reads | range_los_check | line query | hard | A beam is a range and LoS query made damaging |
| ground_aoe_delivery | reads | spell_defs_content | SpellDef.aoe_radius_m | hard | Radius is a spell field |
| ground_aoe_delivery | reads | actor_registry | actors in radius | hard | AoE finds targets by id |
| self_target_delivery | reads | targeting_modes | current target | hard | Direct delivery applies to the resolved target |
| interrupts | reads | cast_timing | cancel cast | hard | An interrupt cancels an in-progress cast |
| global_cooldown | reads | cooldown_manager | shared timer | hard | The GCD is one more cooldown |
| spell_queueing | reads | cast_timing | next cast | hard | The queue feeds the next cast when the current ends |
| channeling | extends | cast_timing | repeated application | hard | A channel is a cast that keeps applying while held |
| effect_kinds_verbs | reads | effect_defs_content | StatusEffectDef.kind, magnitude | hard | The verb and magnitude are effect fields |
| effect_kinds_verbs | reads | spell_defs_content | SpellDef.effects[] | hard | Which effects land and at what magnitude is in the spell |
| effect_kinds_verbs | reads | actor_registry | target ids | hard | Effects attach to actors by id |
| effect_stacking | reads | effect_defs_content | StatusEffectDef.stacking | hard | Stacking behavior is an effect field |
| effect_ticking | reads | effect_defs_content | StatusEffectDef.tick_interval_s | hard | Tick cadence is an effect field |
| effect_ticking | reads | fixed_tick_sim | tick | hard | Pulses happen on ticks |
| effect_ticking | calls | damage_formula | dot and hot pulses | hard | A pulse is a damage or heal resolution; same core/combat subtree |
| effect_duration_expiry | reads | timers_cooldowns | tick timers | hard | Durations are tick timers |
| effect_duration_expiry | reads | effect_defs_content | StatusEffectDef.duration_s | hard | Duration is an effect field |
| dispel_cleanse | reads | effect_kinds_verbs | active effects | hard | Dispel removes applied effects |
| immunities | reads | effect_kinds_verbs | apply gate | hard | Immunity refuses an apply |
| crowd_control_dr | reads | effect_kinds_verbs | stun and slow history | hard | DR shortens repeated control effects |
| crowd_control_dr | reads | pvp_flagging | pvp context | soft | DR usually applies only against players |
| auras_area_effects | extends | effect_kinds_verbs | radius application | hard | An aura is an effect re-applied to everyone in range |
| auto_attack_swing | reads | weapon_attack_speed | swing cadence | hard | Swing timing comes from the weapon |
| auto_attack_swing | reads | fixed_tick_sim | tick | hard | Swing windows count ticks |
| auto_attack_swing | reads | intent_dispatch | attack intent | hard | A swing starts from an attack intent |
| auto_attack_swing | calls | damage_formula | on hit | hard | A connected swing resolves damage; same core/combat subtree |
| hit_detection | reads | collision_layers | hitbox layers | hard | Sweeps and overlaps use the physics layers |
| hit_detection | reads | deterministic_sim | tick-stepped sweeps | hard | Hit tests run on the tick so results replay |
| hit_detection | reads | auto_attack_swing | active window | hard | Detection only counts inside the swing's active window |
| weapon_attack_speed | reads | item_stats_block | ItemDef.stats.attack_speed | hard | Cadence is a stat on the equipped weapon |
| blocking_parry | reads | hit_detection | incoming hit | hard | A block is a decision made when a hit is detected |
| blocking_parry | reads | stamina_pool | block cost | soft | Blocking usually costs stamina |
| combos | reads | auto_attack_swing | chained swings | hard | A combo is a sequence of swings |
| ranged_weapons | reads | projectile_delivery | arrows and throwables | hard | Ranged weapons reuse the projectile verb |
| threat_table | reads | actor_registry | actor ids | hard | Threat is kept per actor id |
| taunt | reads | threat_table | force top | hard | Taunt rewrites the table's top entry |
| threat_modifiers | reads | threat_table | multipliers | hard | Modifiers scale what enters the table |
| threat_modifiers | reads | role_specs | role multipliers | soft | Tank specs would carry a threat multiplier |
| leash_reset | reads | threat_table | clear | hard | Reset clears the table |
| leash_reset | reads | leashing_evade | leash distance | hard | The AI's leash decides when combat resets |
| tanking_kit | reads | threat_table | threat generation | hard | Tank abilities exist to move the threat table |
| tanking_kit | reads | armor_mitigation | mitigation | hard | Tanks are built around mitigation |
| healing_kit | reads | healing_model | heals | hard | Healing abilities resolve through the healing model |
| dps_kit | reads | damage_formula | damage | hard | Damage abilities resolve through the formula |
| support_enhance_kit | reads | effect_kinds_verbs | buffs | hard | Support is mostly stat_mod and shield effects |
| role_balance_targets | reads | balance_ranges | targets | hard | Role targets live with the other balance numbers |
| pvp_flagging | reads | friendly_fire_rules | override | hard | Flagging overrides the co-op friendly-fire default |
| pvp_flagging | reads | party_membership | party exception | hard | Party members stay unflagged to each other |
| dueling | reads | pvp_flagging | temporary flag | hard | A duel is a scoped, consensual flag |
| arenas | reads | instancing | isolated space | soft | Arenas want instanced space if instancing exists |
| pvp_balance_split | reads | balance_ranges | pvp ranges | hard | PvP numbers are a second column of balance data |
| pvp_balance_split | reads | spell_defs_content | pvp overrides | hard | Spells would carry pvp override fields |
| faction_warfare | reads | faction_defs | hostile factions | hard | Warfare needs factions to exist |
| spell_defs_content | reads | schema_spell_def | SpellDef | hard | Every spell file must match the schema |
| spell_defs_content | references | effect_defs_content | SpellDef.effects[].effect_id | hard | A spell names the effects it applies |
| spell_defs_content | references | icon_conventions | SpellDef.icon | hard | The icon path must follow the id-named convention |
| spell_defs_content | reads | balance_ranges | number ranges | soft | Spell numbers are anchored to balance ranges |
| effect_defs_content | reads | schema_status_effect_def | StatusEffectDef | hard | Every effect file must match the schema |
| element_matrix | reads | damage_types_elements | element list | hard | The matrix is indexed by the element enum |
