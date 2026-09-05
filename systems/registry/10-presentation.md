# Presentation — the stage crew: they show the game and never decide it

> **Analogy:** the costume department with one strict dress code (art pipeline), the puppeteer's strings (animation), the fireworks crew that fires on the announcer's cue (VFX), the sound booth (audio), the cameraman (camera), the dashboard (HUD), the control panels behind it (screens), ramps and large-print signs (accessibility), and the steering wheel turned into order tickets (input). Rule R5: presentation reads state and reacts to events; it never mutates gameplay.

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| presentation | Presentation | 1 | — | 1 | spec | world-builder/orchestrator | art/; audio/; ui/; scenes/; actors/ | §4 R5, §5, §11 | Art pipeline, animation, VFX, audio, camera, HUD, screens, accessibility, input | The stage crew: lights, sound, costumes and the scoreboard |
| art_pipeline | Art pipeline | 2 | presentation | 1 | spec | world-builder | art/; tools/import_post.gd | §11 | The import hook, the master shader, the art bible, naming, placeholders, budgets | The costume department with one strict dress code |
| photorealism | Photorealism | 3 | art_pipeline | — | non-goal | director | — | §1 non-goals | Stylized only, one master shader; no rendering research | — |
| import_hook | Import hook | 3 | art_pipeline | 1 | spec | orchestrator | tools/import_post.gd | §11 | Normalize scale, generate collision, assign the master material on every imported mesh | — |
| master_toon_shader | Master toon shader | 3 | art_pipeline | 1 | spec | world-builder | art/shaders/toon_master.tres | §11 | The one material everything wears | — |
| art_bible_palette | Art bible & palette | 3 | art_pipeline | 0 | spec | director/world-builder | docs/art_bible.md | §11, §13 | 8 base colors with light and dark ramps, plus proportions | — |
| icon_conventions | Icon conventions | 3 | art_pipeline | 0 | spec | world-builder | art/icons/ | §11 | 256x256 PNG, transparent, path by category and content id | — |
| model_naming | Model naming | 3 | art_pipeline | 0 | spec | world-builder | art/models/ | §11 | art/models/<category>/<id>.glb | — |
| placeholder_assets | Placeholder assets | 3 | art_pipeline | 0 | spec | world-builder | art/icons/_placeholder.png | §7.2 | Stand-ins used until generated assets land | — |
| lod_texture_budgets | LOD & texture budgets | 3 | art_pipeline | 1 | implied | world-builder | docs/art_bible.md | §1 mid-range PCs | Polygon and texture budgets per asset class | — |
| animation | Animation | 2 | presentation | 1 | implied | world-builder/orchestrator | actors/; art/animations/ | §13 Phase 1 feel | Rigs, state machines, blending, combat animations, sim-driven timing | The puppeteer's strings |
| rigs_skeletons | Rigs & skeletons | 3 | animation | 1 | implied | world-builder | art/models/; actors/ | — | Shared humanoid rig and creature rigs | — |
| animation_state_machines | Animation state machines | 3 | animation | 1 | implied | orchestrator | actors/player/animation_tree.tres; actors/ | — | AnimationTree states driven by simulation state | — |
| locomotion_blending | Locomotion blending | 3 | animation | 1 | implied | world-builder | art/animations/; actors/ | — | Idle, walk, run and jump blends | — |
| combat_animations | Combat animations | 3 | animation | 1 | implied | world-builder | art/animations/; actors/ | — | Swings, casts, reactions and deaths | — |
| hit_reactions_death_anims | Hit reactions & deaths | 3 | animation | 1 | implied | world-builder | art/animations/; actors/ | §5 actor_died | Reactions triggered by damage and death events | — |
| sim_driven_timing | Sim-driven timing | 3 | animation | 1 | spec | orchestrator | actors/player/anim_controller.gd | §4 R5 | Animation follows simulation timing, never the reverse | — |
| ik_procedural | IK & procedural animation | 3 | animation | — | candidate | world-builder | art/animations/; actors/ | — | Foot IK and look-at | — |
| facial_emotes | Facial & emote animation | 3 | animation | — | candidate | world-builder | art/animations/; actors/ | — | Emote and face animations | — |
| vfx_spell_effects | VFX & spell effects | 2 | presentation | 2 | spec | world-builder | art/vfx/; scenes/vfx/ | §6.3 vfx, §5 spell_cast, effect_applied | Cast, projectile, impact, buff and telegraph visuals within a budget | The fireworks crew that fires on the announcer's cue |
| element_default_vfx | Element default VFX | 3 | vfx_spell_effects | 2 | spec | world-builder | scenes/vfx/ | §6.3 vfx, element | Default visuals per element when a spell sets none | — |
| projectile_visuals | Projectile visuals | 3 | vfx_spell_effects | 2 | implied | world-builder | scenes/vfx/ | — | Visuals that follow simulated projectiles | — |
| impact_effects | Impact effects | 3 | vfx_spell_effects | 2 | implied | world-builder | scenes/vfx/ | §5 actor_damaged | Hit flashes and particles on damage | — |
| buff_debuff_visuals | Buff & debuff visuals | 3 | vfx_spell_effects | 2 | spec | world-builder | scenes/vfx/ | §5 effect_applied | Persistent visuals while an effect is active | — |
| telegraph_visuals | Telegraph visuals | 3 | vfx_spell_effects | 2 | implied | world-builder | scenes/vfx/ | — | The drawn danger shapes bosses announce | — |
| vfx_pooling_budget | VFX pooling & budget | 3 | vfx_spell_effects | 2 | implied | orchestrator | scenes/vfx/ | §1 mid-range PCs | Pooled particles within a frame budget | — |
| screen_effects | Screen effects | 3 | vfx_spell_effects | — | candidate | world-builder | scenes/vfx/ | — | Vignettes, shakes, low-health tint | — |
| audio | Audio | 2 | presentation | 1 | implied | world-builder | audio/; audio/default_bus_layout.tres | §3 audio/ | SFX, ambience, mix buses, and candidate music | The sound booth |
| sfx_events | SFX events | 3 | audio | 1 | implied | world-builder | audio/sfx/ | §6.3 sfx | Sounds fired on events with per-spell overrides | — |
| ambience_zones | Ambience zones | 3 | audio | 3 | implied | world-builder | audio/ambience/ | — | Ambient beds per zone, phase and weather | — |
| spatial_audio_mix_buses | Spatial audio & buses | 3 | audio | 1 | implied | world-builder | audio/default_bus_layout.tres | — | 3D positioning and the bus layout | — |
| music_system | Music system | 3 | audio | — | candidate | director | audio/music/ | — | Adaptive music by region and combat state | — |
| camera | Camera | 2 | presentation | 1 | spec | orchestrator | actors/player/camera/ | §1 third-person | The third-person rig and its behaviors | The cameraman following the lead actor |
| third_person_rig | Third-person rig | 3 | camera | 1 | spec | orchestrator | actors/player/camera/ | §1 | Follow camera with orbit, zoom and collision pull-in | — |
| target_lock_camera | Target lock camera | 3 | camera | — | candidate | director | actors/player/camera/ | — | Lock-on framing | — |
| photo_mode | Photo mode | 3 | camera | — | candidate | director | actors/player/camera/ | — | Free camera for screenshots | — |
| ui_hud | HUD | 2 | presentation | 1 | spec | orchestrator | ui/hud/ | §3 ui/, §5 listeners | The always-on overlay: bars, buffs, action bars, nameplates, frames, toasts | The dashboard of a car |
| health_resource_bars | Health & resource bars | 3 | ui_hud | 1 | spec | orchestrator | ui/hud/ | §5 | Health and resource bars for the player | — |
| buff_bars | Buff bars | 3 | ui_hud | 2 | spec | orchestrator | ui/hud/ | §5 effect_applied | Active effect icons with timers | — |
| action_bars_hotkeys | Action bars | 3 | ui_hud | 2 | implied | orchestrator | ui/hud/ | — | Bound spells and items with cooldown sweeps | — |
| nameplates_floating_text | Nameplates & floating text | 3 | ui_hud | 1 | implied | orchestrator | ui/hud/ | §5 actor_damaged | Names, health and floating combat numbers over actors | — |
| target_frames | Target frames | 3 | ui_hud | 2 | implied | orchestrator | ui/hud/ | — | The current target's frame | — |
| group_frames | Group frames | 3 | ui_hud | 4 | implied | orchestrator | ui/hud/ | §1 co-op | Party member frames | — |
| boss_frames | Boss frames | 3 | ui_hud | 2 | implied | orchestrator | ui/hud/ | — | Boss health and phase | — |
| minimap_compass_hud | Minimap & compass | 3 | ui_hud | 2 | implied | orchestrator | ui/hud/ | — | Compass and minimap overlay | — |
| notifications_toasts | Notifications & toasts | 3 | ui_hud | 1 | implied | orchestrator | ui/hud/ | — | Quest, item, zone and system toasts | — |
| crosshair_reticle | Crosshair & prompts | 3 | ui_hud | 1 | implied | orchestrator | ui/hud/ | — | Aim reticle and interaction prompt | — |
| ui_screens | Screens & menus | 2 | presentation | 2 | implied | orchestrator | ui/screens/ | §3 ui/ | Full-screen panels: menu, inventory, character, crafting, journal, map, dialogue, settings, join, death, chat | The control panels behind the dashboard |
| main_menu_world_select | Main menu & world select | 3 | ui_screens | 1 | implied | orchestrator | ui/screens/menu/ | — | Start, worlds, join, settings, quit | — |
| inventory_screen | Inventory screen | 3 | ui_screens | 2 | implied | orchestrator | ui/screens/inventory/ | — | Bags, drag and drop, use, drop | — |
| equipment_character_sheet | Character sheet | 3 | ui_screens | 2 | implied | orchestrator | ui/screens/character/ | — | Equip slots and derived stats | — |
| crafting_screen | Crafting screen | 3 | ui_screens | 3 | implied | orchestrator | ui/screens/crafting/ | — | Recipes, inputs and the queue | — |
| quest_journal_screen | Quest journal | 3 | ui_screens | 2 | implied | orchestrator | ui/screens/journal/ | §6.7 journal_text | Active and completed quests with journal text | — |
| map_screen | Map screen | 3 | ui_screens | 2 | implied | orchestrator | ui/screens/map/ | — | The full map | — |
| dialogue_screen | Dialogue screen | 3 | ui_screens | 3 | implied | orchestrator | ui/screens/dialogue/ | §6.8 | Speaker, text and choices | — |
| settings_screens | Settings screens | 3 | ui_screens | 1 | implied | orchestrator | ui/screens/settings/ | — | Graphics, audio and controls | — |
| server_browser_join | Join screen | 3 | ui_screens | 4 | implied | orchestrator | ui/screens/join/ | §1 no matchmaking | Direct address and recent servers | — |
| tooltips_item_cards | Tooltips & item cards | 3 | ui_screens | 2 | implied | orchestrator | ui/tooltips/ | §6.1 rarity | Item cards with stats, rarity color and a comparison against the equipped item | — |
| chat_window | Chat window | 3 | ui_screens | 4 | implied | orchestrator | ui/screens/chat/ | — | Text chat | — |
| death_screen | Death screen | 3 | ui_screens | 1 | implied | orchestrator | ui/screens/death/ | — | Respawn options | — |
| combat_log_window | Combat log | 3 | ui_screens | — | candidate | orchestrator | ui/screens/combatlog/ | — | A scrolling log of damage, heals and deaths for players | — |
| ux_accessibility | UX & accessibility | 2 | presentation | — | candidate | director | ui/theme/ | — | Colorblind modes, text scaling, subtitles, motion reduction | Ramps and large-print signs |
| colorblind_modes | Colorblind modes | 3 | ux_accessibility | — | candidate | orchestrator | ui/theme/ | — | Alternate palettes for rarity colors and telegraphs | — |
| text_scaling | Text scaling | 3 | ux_accessibility | — | candidate | orchestrator | ui/theme/ | — | UI scale setting | — |
| subtitles | Subtitles | 3 | ux_accessibility | — | candidate | orchestrator | ui/hud/subtitles.tscn | — | Captions for dialogue and barks | — |
| motion_reduction | Motion reduction | 3 | ux_accessibility | — | candidate | orchestrator | ui/; scenes/vfx/ | — | Reduce shake and flashes | — |
| input | Input | 2 | presentation | 1 | spec | orchestrator | project.godot; core/commands/input.gd | §12 | The input map, translation to intents, rebinding, and candidate gamepad and buffering | The steering wheel and pedals, converted into order tickets |
| input_map_actions | Input map actions | 3 | input | 1 | spec | orchestrator | project.godot | — | Named actions in the project input map | — |
| input_to_command_translation | Input to intent translation | 3 | input | 1 | spec | orchestrator | core/commands/input.gd | §12 | Raw input becomes typed intents; the only door into the sim | — |
| rebinding | Rebinding | 3 | input | 1 | implied | orchestrator | ui/screens/settings/ | — | Remap actions in settings | — |
| gamepad_support | Gamepad support | 3 | input | — | candidate | director | project.godot | — | Controller layout and glyphs | — |
| input_buffering | Input buffering | 3 | input | — | candidate | orchestrator | core/commands/input.gd | — | Buffered presses for responsive combat | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| import_hook | reads | master_toon_shader | assign material | hard | The hook assigns the master material to every mesh |
| import_hook | reads | game_infra_spec | §11 units and collision rules | hard | The hook implements the §11 contract |
| master_toon_shader | reads | art_bible_palette | ramps | hard | The shader's ramps come from the art bible |
| icon_conventions | reads | id_convention | filename equals id | hard | Icon filenames are content ids |
| model_naming | reads | id_convention | filename equals id | hard | Model filenames are content ids |
| placeholder_assets | reads | icon_conventions | placeholder path | hard | The placeholder follows the icon conventions |
| lod_texture_budgets | reads | frame_time_budget | budget | hard | Asset budgets derive from the frame budget |
| rigs_skeletons | reads | import_hook | skinned meshes | hard | Rigs are imported through the hook |
| animation_state_machines | reads | sim_driven_timing | state from sim | hard | States change when the sim says so |
| animation_state_machines | renders | locomotion | movement state | hard | Locomotion state selects animations |
| animation_state_machines | reads | rigs_skeletons | rig | hard | State machines drive a rig |
| locomotion_blending | renders | locomotion | speed and direction | hard | Blends read movement speed |
| combat_animations | renders | cast_timing | cast progress | hard | Cast animations follow cast timing |
| combat_animations | renders | auto_attack_swing | swing window | hard | Swing animations follow the swing window |
| hit_reactions_death_anims | reads | rigs_skeletons | rig | hard | Reactions play on the rig |
| sim_driven_timing | reads | fixed_tick_sim | tick | hard | Timing is read from the tick |
| sim_driven_timing | reads | sim_presentation_split | R5 | hard | Animation never drives gameplay timing |
| ik_procedural | reads | rigs_skeletons | rig | hard | IK adjusts the rig |
| ik_procedural | reads | terrain_meshes_heightmap | foot placement | soft | Foot IK reads terrain |
| facial_emotes | reads | rigs_skeletons | face rig | hard | Emotes play on the rig |
| element_default_vfx | reads | spell_defs_content | SpellDef.vfx, element | hard | A spell's vfx override or its element picks the visual |
| element_default_vfx | reads | vfx_pooling_budget | pool | hard | Visuals are drawn from the pool |
| projectile_visuals | renders | projectile_delivery | position per tick | hard | The visual follows the simulated projectile |
| impact_effects | reads | element_default_vfx | element impact | soft | Impacts vary by element |
| buff_debuff_visuals | reads | effect_defs_content | StatusEffectDef.element | hard | Persistent visuals vary by element |
| telegraph_visuals | renders | telegraph_decals | shape and timer | hard | The visual draws the announced shape |
| telegraph_visuals | reads | colorblind_modes | palette | soft | Telegraph colors must survive colorblind modes |
| vfx_pooling_budget | reads | frame_time_budget | budget | hard | The pool size derives from the frame budget |
| screen_effects | renders | health_pool | low health | soft | A low-health tint reads the pool |
| screen_effects | reads | motion_reduction | reduce | soft | Shakes respect the setting |
| sfx_events | reads | spell_defs_content | SpellDef.sfx | hard | Spell sound overrides are spell fields |
| sfx_events | reads | spatial_audio_mix_buses | buses | hard | Sounds play on buses |
| ambience_zones | reads | biome_defs | beds per biome | hard | Ambience is chosen per biome |
| ambience_zones | reads | spatial_audio_mix_buses | ambience bus | hard | Beds play on the ambience bus |
| spatial_audio_mix_buses | reads | audio_settings | volumes | hard | Bus volumes are settings |
| music_system | reads | spatial_audio_mix_buses | music bus | hard | Music plays on its bus |
| music_system | reads | threat_table | in combat | soft | Combat music reads whether anything has threat on the player |
| third_person_rig | reads | locomotion | follow target | hard | The camera follows the player |
| third_person_rig | reads | input_map_actions | look input | hard | Look input drives orbit |
| target_lock_camera | reads | targeting_modes | locked target | hard | Lock-on frames the current target |
| photo_mode | reads | pause_rules | pause | soft | Photo mode pauses in single player |
| health_resource_bars | renders | health_pool | current and max | hard | Bars show the pools |
| health_resource_bars | renders | class_resources | resource pools | hard | Bars show whichever resource the character uses |
| buff_bars | renders | effect_duration_expiry | remaining time | soft | Timers on icons read remaining duration |
| action_bars_hotkeys | renders | spellbook | known spells | hard | Bars show bound spells |
| action_bars_hotkeys | reads | input_map_actions | hotkeys | hard | Slots are bound to actions |
| action_bars_hotkeys | renders | cooldown_manager | cooldown sweep | hard | Sweeps show cooldowns |
| nameplates_floating_text | renders | actor_registry | names and positions | hard | Nameplates follow actors by id |
| target_frames | renders | targeting_modes | current target | hard | The frame shows the resolved target |
| target_frames | renders | health_pool | target health | hard | The frame shows the target's health |
| group_frames | renders | party_membership | members | hard | Frames show party members |
| boss_frames | renders | boss_phases | phase | hard | The boss frame shows the phase |
| boss_frames | renders | health_pool | boss health | hard | The boss frame shows boss health |
| minimap_compass_hud | renders | map_minimap | map data | hard | The minimap draws map data |
| notifications_toasts | renders | contextual_hints | hint text | soft | Hints are shown as toasts |
| crosshair_reticle | renders | targeting_modes | aim | hard | The reticle shows the aim mode |
| crosshair_reticle | renders | interaction_system | prompt | hard | The prompt names the nearest interactable |
| main_menu_world_select | reads | save_slots | worlds | soft | The menu lists save slots once saving exists in Phase 3; Phase 1 has one world |
| main_menu_world_select | reads | server_browser_join | join flow | soft | The menu links to joining |
| inventory_screen | renders | inventory | bags | hard | The screen draws the inventory |
| inventory_screen | reads | tooltips_item_cards | hover | hard | Hovering shows a card |
| inventory_screen | reads | intent_schema | move, use, drop intents | hard | Dragging emits intents; the screen never edits inventory directly (R5) |
| equipment_character_sheet | renders | equipment | slots | hard | The sheet draws equipped items |
| equipment_character_sheet | renders | derived_stats | stats | hard | The sheet shows derived stats |
| crafting_screen | renders | recipe_defs | recipes | hard | The screen lists recipes |
| crafting_screen | renders | craft_time_queue | queue | hard | The screen shows the queue |
| crafting_screen | renders | recipe_unlocks | known recipes | hard | Only unlocked recipes are shown |
| quest_journal_screen | renders | quest_journal_text | text | hard | The journal shows journal text |
| quest_journal_screen | renders | objective_tracking | progress | hard | The journal shows progress |
| map_screen | renders | map_minimap | map data | hard | The map screen draws map data |
| dialogue_screen | renders | dialogue_runner | current node | hard | The screen shows the runner's node |
| dialogue_screen | reads | intent_schema | choice intent | hard | Picking a choice emits an intent |
| settings_screens | renders | config_settings | settings | hard | Settings screens edit the settings store |
| server_browser_join | reads | direct_ip_join | join by address | hard | The join screen fronts direct joining |
| tooltips_item_cards | renders | items | item fields | hard | Cards show item data |
| tooltips_item_cards | reads | rarity_tiers | color | hard | Rarity drives the card color |
| chat_window | renders | text_chat | messages | hard | The window shows chat |
| death_screen | renders | respawn_rules | options | hard | The screen offers the respawn options the rules allow |
| combat_log_window | listens | sig_actor_damaged | — | soft | The log records hits |
| combat_log_window | listens | sig_actor_healed | — | soft | The log records heals |
| combat_log_window | listens | sig_actor_died | — | soft | The log records deaths |
| colorblind_modes | reads | rarity_tiers | rarity colors | hard | Rarity colors need alternates |
| text_scaling | reads | user_settings_store | scale | hard | Scale is a setting |
| subtitles | renders | dialogue_runner | lines | hard | Subtitles show dialogue lines |
| subtitles | reads | user_settings_store | enabled | hard | Subtitles are a setting |
| motion_reduction | reads | user_settings_store | enabled | hard | Motion reduction is a setting |
| input_map_actions | reads | project_settings | input map | hard | Actions live in the project input map |
| input_map_actions | reads | keybinding_config | user bindings | hard | User bindings override defaults |
| input_to_command_translation | reads | input_map_actions | actions | hard | Translation maps actions to intents |
| input_to_command_translation | reads | intent_schema | typed intents | hard | Translation produces typed intents |
| rebinding | reads | keybinding_config | store | hard | Rebinding writes the config |
| rebinding | reads | input_map_actions | action list | hard | Rebinding lists actions |
| gamepad_support | reads | input_map_actions | controller bindings | hard | Gamepad bindings are actions too |
| input_buffering | reads | input_to_command_translation | buffered intents | hard | Buffering sits in the translation layer |
| input_buffering | reads | spell_queueing | queued cast | soft | Buffering feeds the spell queue |
| settings_screens | reads | graphics_quality_presets | — | hard | The graphics tab lists the presets |
| tooltips_item_cards | reads | gear_stats_application | — | hard | Comparison deltas come from the equipped item's applied stats |
| third_person_rig | reads | collision_layers | — | hard | The camera pulls in when geometry blocks the view |
| locomotion_blending | renders | steering_locomotion | — | hard | Enemy walk cycles follow the steering speed |
| projectile_visuals | reads | element_default_vfx | — | soft | Trails follow the element default |
| minimap_compass_hud | renders | objective_tracking | — | soft | Objective pins on the compass |
