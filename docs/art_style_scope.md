# Art style scope — input for `docs/art_bible.md`

> **Who writes what:** spec §13 says the Director writes the first pass of `docs/art_bible.md` and agents polish it. This page is the research that goes *into* that first pass: what the two reference games actually do, what Godot 4 can render, three achievable directions with their cost, and a search scope with license rules. Sources at the end; claims marked *[pre-training, not live-verified]* could not be checked against a live page from this environment.

## 1. The question, restated

*"Is there a way to use graphics similar to Overwatch or Marvel Rivals? If not, what can be done without too much overhead and effort but still unique? Give me a scope so I can search manually."*

Two things are being asked at once, and they have different answers:

- **The style** (how surfaces, light and lines look) is a set of rendering and design choices. Godot 4's Forward+ renderer can express both references. **Achievable.**
- **The fidelity** (hand-built hero models, bespoke animation sets, art teams in the hundreds) is labor. Blizzard and NetEase spent that labor; a solo Director with agents cannot, and should not try. **Not achievable — and not needed for a unique look.**

The scope below is built on that split: borrow the *style rules*, source the *labor* from CC0 and licensed packs, and make the master material (§11's `toon_master.tres`) and the palette do the unifying work the spec already assigns them.

## 2. What the references actually do

**Overwatch.** Blizzard's art director Bill Petras and assistant art director Arnold Tsang presented the style's development at GDC 2017 ("The Art of Overwatch: Evolving a Legacy"). Blizzard describes the aesthetic as a "happy marriage" of realistic and stylized presentation, with a vibrant palette and deliberate **shape language** — familiar fundamental shapes chosen to evoke feelings and make characters readable at a glance *[from the GDC session description and Blizzard's own panel recap, read as search summaries; the talk itself is membership-gated and was not viewed]*. In rendering terms this is **stylized physically based shading**: real materials and lighting, exaggerated proportions and silhouettes, saturated but controlled color, soft ambient light, strong rim and specular highlights, and readable team colors. No ink lines.

**Marvel Rivals.** Built on Unreal Engine 5 by NetEase Games; NetEase and Epic describe extensive use of UE5's dynamic lighting, shadow rendering and destructible environments. NetEase publishes an "Art Vision" developer-diary series on the style's genesis (GUI, branding, character concepts, worldbuilding). The comic-book look — **ink-line edges, screentone/halftone shading in shadows, flat saturated fills over PBR lighting** — is the widely described signature *[pre-training, not live-verified: the dev-diary pages are blocked from this environment; read Art Vision Vol. 01 and 02 directly]*.

**What both share** and what makes them read as "premium stylized": consistent proportions across every asset; a locked palette; strong silhouettes; lighting designed per scene rather than default; VFX that follow the same palette; and **animation quality** — which for EMBER is the movement contract in ADR-0068, not an art purchase.

## 3. What Godot 4 can render (Forward+)

Per the Godot manual's renderer comparison, **Forward+** carries the full feature set: clustered forward lighting, SDFGI and VoxelGI global illumination, volumetric fog, glow, tonemapping, screen-space reflections and SSIL; custom post-processing runs through `CompositorEffects` (Forward+ and Mobile, not Compatibility). Spatial shaders support `render_mode diffuse_toon, specular_toon` and a custom `light()` function, which is how cel banding, rim light and stylized specular are written. Outlines are done with an inverted-hull second pass or a screen-space edge pass. Both references' *style rules* are expressible; the desktop-only target in §1 makes Forward+ the right choice, so that is what `project_settings` should pin.

## 4. Three directions, with cost

| Direction | Looks like | Ingredients in Godot | Asset labor | Risk |
|---|---|---|---|---|
| **A. Stylized PBR** (Overwatch-adjacent) | real light on clean, chunky shapes; saturated palette; soft shadows; rim light | StandardMaterial3D with a master shader for rim and palette ramps; SDFGI or baked lightmaps; glow; volumetric fog for mood | Medium: needs consistent proportions and decent textures; low-poly packs look cheap unless lit and palette-graded well | Looks generic if the palette and proportions are not locked early |
| **B. Toon / cel with ink lines** (Rivals-adjacent) | flat bands of light, hard shadow edge, outlines, optional halftone in shadow | `diffuse_toon` and `specular_toon` or a custom `light()` ramp; inverted-hull outline pass; halftone in the shadow band via screen-space UVs; posterized post-process | Low to medium: hides low texture detail; needs clean topology for outlines and good normals | Outlines and halftone are cheap to do badly; readability at distance and in dark biomes needs testing |
| **C. Hand-painted flat** (WoW-adjacent) | painted textures carry the light; few real-time effects | Unlit or lightly lit materials; texture work dominates | High for a solo dev unless packs supply it | Weakest fit for a game whose systems are WoW-style but whose target is "stylized, unique"; the most labor per asset |

**Recommendation: B with a PBR base**, which is what §11 already implies with one master toon material. Concretely: real lighting and shadows from Forward+, a two-band toon ramp with a soft edge, a thin inverted-hull outline on characters and important props only (not terrain), a subtle halftone in the shadow band for the comic signature, and the §11 palette (8 base colors with light and dark ramps) enforced by the import hook. This hides the texture-detail gap between free and paid packs, reads at distance, and is unique through the palette and silhouette rules rather than through fidelity. Direction A stays available by turning the ramp off; the assets are the same.

**The unifier is not the assets, it is the pipeline.** §11: every mesh passes `tools/import_post.gd`, gets the master material and the palette. Any pack from any source becomes EMBER's look at import. That is the single most cost-effective decision already in the spec; protect it.

## 5. Search scope — what to look for, by phase

Counts are rough targets so the search has a finish line. Formats: glTF/GLB preferred (§11 names `.glb`), FBX acceptable if it imports cleanly into Godot.

| Phase | Category | Target | What to look for | Search terms |
|---|---|---|---|---|
| 1 | Player base mesh + rig | 1 humanoid, modular if possible | clean topology, a standard humanoid skeleton so animation libraries retarget; 1.8 m scale or rescalable | "modular character low poly rigged glb", "universal base characters" |
| 1 | Locomotion animations | 1 set: idle, walk, run, sprint, jump start/loop/land, turn, fall | root-motion-free clips (ADR-0068: animation never moves the body); consistent frame rate; retargetable | "locomotion animation pack humanoid", "Mixamo walk run jump" |
| 1 | One enemy | 1 creature or humanoid with idle/walk/attack/hit/death | same rig family as the player if humanoid; readable silhouette | "low poly monster rigged animated" |
| 1 | Gray-box island props | 20–40 | rocks, trees, logs, cliffs in one proportion system | "stylized nature kit", "low poly environment megakit" |
| 1 | VFX textures | 10–20 sprites | soft particles, sparks, smoke, slash arcs, a hit flash | "particle sprite sheet CC0", "stylized VFX textures" |
| 1 | Skybox and gradients | 2–4 | painterly or gradient skies, not HDR photos, so they match the ramp | "stylized skybox", "gradient sky panorama" |
| 2 | Weapons, tools, gathering nodes | 30–60 | one silhouette language; sized to the hand | "low poly weapon pack", "fantasy props kit" |
| 2 | Icons | one style, generated or purchased in bulk | 256 px, transparent, one lighting direction, filename equals the content id (G2) | "RPG icon pack flat", or the §9 icon API |
| 3 | Building pieces | 40–80 modular | snap-grid friendly: walls, floors, roofs, doors at ≥ 2.2 m openings (§11) | "modular building kit low poly", "medieval construction set" |
| 3 | Biome kits | 1 per biome | palette-graded at import, so shape matters more than texture | "desert kit", "swamp assets", "snow environment pack" |
| 3 | UI kit and fonts | 1 kit, 2 fonts | high-contrast, readable at 1080p; a display face and a text face with open licenses | "game UI kit", "OFL display font" |
| all | Audio | ambience, footsteps per surface, UI, combat | CC0 or royalty-free; loopable ambience | "footstep sounds CC0", "fantasy ambience loop" |

**Checklist for each candidate pack**

- License allows commercial use and modification, and does not require redistributing the source (see §6).
- One proportion system across the pack; mixing packs is fine only if proportions match or the import hook rescales.
- Rigged characters use a standard humanoid skeleton so one animation library serves all.
- Animations are exported without root motion, or can be.
- Meshes are clean enough for an inverted-hull outline (no doubled faces, sane normals).
- Textures are secondary: the master material and palette will replace most of the look.

## 6. Sources and licenses (verified 2026-09-05 unless marked)

| Source | What | License | Notes |
|---|---|---|---|
| Kenney (kenney.nl) | characters, environments, UI, audio | CC0 (public domain); commercial use allowed | stated on kenney.nl/support |
| Quaternius (quaternius.com, quaternius.itch.io) | animated characters, nature and prop megakits, Universal Animation Library and Universal Base Characters | CC0 | stated on the site and itch pages; a share of each pack is free, the rest via Patreon |
| Poly Haven (polyhaven.com) | HDRIs, textures, models | CC0 | stated on polyhaven.com/license; HDRIs are photographic — use for lighting reference, not skies, under direction B |
| Mixamo (Adobe) | humanoid animations and characters | royalty-free for personal and commercial projects; no attribution required; raw files may not be redistributed to customers or non-team members | Adobe FAQ; an Adobe account is required *[pre-training, not live-verified]*; export FBX and convert to glTF for Godot |
| Synty Store | large stylized low-poly packs | one-time purchase, perpetual license for the purchased pack; commercial use; prohibits NFT/blockchain use, inclusion in generative-AI datasets, and using Synty media to promote your game | paid; strongest proportion consistency of the paid options |
| Godot Asset Library | shaders, tools, addons | per asset | R10: any *addon* still needs a §2/§9 row before it enters `addons/`; shaders copied into `art/shaders/` are art, not addons |

**License rules that bind here:** R3 keeps everything plain text except `art/` and `audio/`, so binary source packs live under `art/` and never elsewhere. Record every pack's license in `art/LICENSES.md` at import (a G2 candidate check). Do not redistribute Mixamo or Synty source files in the public repository; commit the converted, palette-graded `.glb` outputs the license allows, and keep source packs out of Git or in a private location.

## 7. What was not verified

- The Marvel Rivals ink-and-halftone description and the Mixamo account requirement are from pre-training knowledge; the pages are blocked from this environment. Read the Art Vision diaries and the Adobe FAQ directly before quoting them in the art bible.
- GDC Vault talks require membership for the video; only the session descriptions were available.
- No claim above about "how good" a free pack looks is a measurement; G5 (vision review against the art bible) is where that gets measured.

## Sources

- GDC Vault, *The Art of 'Overwatch': Evolving a Legacy* (Bill Petras, Arnold Tsang; GDC 2017), gdcvault.com/play/1024268
- Blizzard Entertainment, *Revving Up the Engine — Overwatch 2 "Evolving the Art" panel recap*, news.blizzard.com (vendor-published)
- NetEase Games, *Marvel Rivals* developer diaries "Art Vision" Vol. 01–05, marvelrivals.com/devdiaries (vendor-published)
- Epic Games, *Unreal Engine powers Marvel Rivals*, unrealengine.com/developer-interviews (vendor-published)
- Godot Engine documentation, *Renderers* comparison; *Spatial shaders* (`light()`), *Your second 3D shader* (`diffuse_toon`, `specular_toon`); docs.godotengine.org/en/stable (via Context7 mirror)
- kenney.nl/support; polyhaven.com/license; quaternius.com and quaternius.itch.io; helpx.adobe.com/creative-cloud/faq/mixamo-faq.html; syntystore.com/pages/licences-overview
