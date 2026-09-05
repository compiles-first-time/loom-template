# rb_add_spell — Add a spell (SpellDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | A new castable ability that uses existing delivery verbs and existing effects. A new verb is `rb_add_verb`; a new effect is `rb_add_status_effect`. |
| Primary | spell_defs_content |
| Roles | content-smith; world-builder |
| Director | none — unless the spell needs a cost resource other than mana/stamina/health (further class resources are candidates), a new element, or a new delivery |
| Spec | §6.3, §6.9 worked example, §5 spell_cast, §8 G2 |
| Not touched | effect_kinds_verbs: the effect verbs read effect defs, not spells — an effect change is rb_add_status_effect; pvp_balance_split: candidate; class_starting_kit: candidate — starting kits name spells once classes are approved; enemy_abilities: candidate — an enemy that casts this spell is an enemy change; healing_kit: a role kit is a curated list of spell ids — add this spell to a kit only when it belongs to that role (a kit-list change); dps_kit: same as healing_kit; tanking_kit: same as healing_kit |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_spell_def | core/schemas/spell_def.gd | delivery, element and cost.resource values you need are §6.3 enum values | Need a new enum value? That is a verb: `rb_add_verb`, then a spec PR. |
| 2 | check | effect_defs_content | data/effects/ | every effects[].effect_id exists | Missing: `rb_add_status_effect` first. |
| 3 | check | balance_anchoring | docs/balance_ranges.md | cast_time_s, cooldown_s, cost, range_m, magnitudes anchored on comparable spells | — |
| 4 | create | spell_defs_content | data/_inbox/<id>.json | `spell_<name>`: display_name, description, icon, cast_time_s, cooldown_s, cost, range_m, delivery, effects, element, vfx/sfx optional, projectile_speed or aoe_radius_m when the delivery needs it | Copy the Fireball example in §6.9. |
| 5 | run | json_to_tres_converter | data/spells/<id>.tres | converter validates against §6.3 and writes the .tres | — |
| 6 | create | icon_conventions | art/icons/spells/<id>.png | 256×256 transparent, filename equals the id, path in the def exists | Placeholder + prompt if art is not ready (`icon_placeholder_fallback`). |
| 7 | check | element_default_vfx | art/vfx/ | vfx empty means the element's default is used and exists | A custom vfx path must exist (G2). |
| 8 | check | sfx_events | audio/sfx/ | sfx empty means the element default; a custom path exists | — |
| 9 | check | resource_cost_check | core/combat/casting/cost.gd | cost.resource is a pool the caster has | — |
| 10 | check | cast_timing | core/combat/casting/cast.gd | cast_time_s runs on the fixed tick; the spell_cast payload is unchanged | New payload field = spec §5 PR (R-EB1). |
| 11 | check | cooldown_manager | core/combat/casting/cooldown.gd | cooldown_s is honored; 0 means none | — |
| 12 | check | range_los_check | core/combat/casting/range.gd | range_m is sane for the delivery (self and ground_aoe ignore or cap it) | — |
| 13 | check | targeting_modes | core/combat/casting/targeting.gd | the delivery's targeting mode exists (target, ground, self) | — |
| 14 | check | projectile_delivery | core/combat/casting/projectile.gd | projectile_speed set when delivery is projectile | Projectiles only. |
| 15 | check | ground_aoe_delivery | core/combat/casting/ground_aoe.gd | aoe_radius_m set when delivery is ground_aoe | Ground AoE only. |
| 16 | update | spellbook | core/progression/spellbook.gd | who knows it: known from start, a level, a quest or an item (`ability_unlocks`) | A spell nobody can learn is unreachable content. |
| 17 | check | action_bars_hotkeys | ui/hud/action_bars/ | the icon and cooldown render on the bar | No code change for a new spell. |
| 18 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 19 | run | gm_console | core/debug/console.gd | cast it via the console; VFX, SFX and effects land; deterministic under a fixed seed | Hot reload makes it castable immediately (§6.9). |
| 20 | run | g1_unit_tests_gut | tests/unit/ | a data-driven cast test covers the new delivery/effect combination if none did | Only when the combination is new. |
| 21 | update | changelog | docs/changelog.md | one line | — |
