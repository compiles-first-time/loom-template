# rb_add_status_effect — Add a status effect (StatusEffectDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | A spell, consumable, hazard or enemy needs a new buff, debuff, DoT, HoT, stun, slow or shield that an existing effect kind can express. |
| Primary | effect_defs_content |
| Roles | content-smith; world-builder |
| Director | none — a new `kind` is a verb (`rb_add_verb`) and a spec PR |
| Spec | §6.4, §5 effect_applied / effect_expired, §8 G2 |
| Not touched | consumables: an item that applies this effect is an item change (rb_add_item step 8); consumables_apply: reads the item's on_use_effect — no change for a new effect; fire_burning_env: a hazard that applies this effect is a hazard change; need_thresholds_effects: a survival threshold that applies this effect is a survival change; rested_bonus: camp rest names an effect — a camp change |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_status_effect_def | core/schemas/status_effect_def.gd | kind ∈ dot/hot/stat_mod/stun/slow/shield, stacking ∈ none/refresh/stack_count, element ∈ §6.3 elements | Anything else is a schema change. |
| 2 | check | effect_kinds_verbs | core/combat/effects/ | the verb for `kind` exists and reads magnitude, tick_interval_s, duration_s the way you intend | — |
| 3 | check | balance_anchoring | docs/balance_ranges.md | magnitude, duration_s and tick_interval_s anchored on comparable effects | — |
| 4 | create | effect_defs_content | data/_inbox/<id>.json | `effect_<name>`: display_name, icon, kind, magnitude, tick_interval_s (dot/hot), duration_s, stacking, element | — |
| 5 | run | json_to_tres_converter | data/effects/<id>.tres | converter writes the .tres | — |
| 6 | create | icon_conventions | art/icons/effects/<id>.png | icon exists, filename equals the id | Buff bars show it. |
| 7 | check | buff_bars | ui/hud/buffs/ | the icon and timer render from effect_applied / effect_expired | No code change. |
| 8 | check | buff_debuff_visuals | art/vfx/effects/ | a visual exists for the kind and element, or the default applies | — |
| 9 | check | effect_stacking | core/combat/effects/stacking.gd | stacking behaves as declared when the effect is applied twice | — |
| 10 | check | effect_duration_expiry | core/combat/effects/expiry.gd | duration_s ends the effect and effect_expired fires | — |
| 11 | check | effect_ticking | core/combat/effects/tick.gd | tick_interval_s drives dot/hot ticks on the fixed tick | dot/hot only. |
| 12 | check | resistances_application | core/combat/damage.gd | the element is one the resistance table knows | — |
| 13 | update | spell_defs_content | data/spells/<spell>.tres | the spell (or item, hazard) that applies it names the effect id | An effect nothing applies is dead data. |
| 14 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 15 | run | gm_console | core/debug/console.gd | apply it (via a spell or console) and watch effect_applied → ticks → effect_expired | — |
| 16 | update | changelog | docs/changelog.md | one line | — |
