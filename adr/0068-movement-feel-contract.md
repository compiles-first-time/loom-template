# ADR-0068: Movement feel is a gated contract — fixed tick, render interpolation, per-frame input and camera, prediction-ready locomotion

**Status:** Proposed (awaiting DIRECTOR review — Nick)
**Date:** 2026-09-05
**Author:** Builder session — for Nick (Director)
**Confidence:** [H] that movement feel is decided by architecture that must be fixed before the first controller is written, not tuned afterwards (engine documentation and the netcode literature agree on the mechanisms); [H] on the engine facts cited below (official Godot manual, read through a documentation mirror because the docs host is blocked from this environment); [M] on the proposed numbers — they are engineering defaults for the Director to tune once the reference machine exists; [M] on netfox as the netcode library — its own documentation is clear, its fit with R4's fixed physics tick is a spike question.

## Context

The Director, before creating the `ember` repository: *"can you also make sure that movement is butter-smooth. The biggest deal breaker is going to be clunky, delayed, laggy, choppy, uncoordinated movement."*

Today the spec says movement resolves on the fixed physics tick (§4 R4, §12) and that Phase 1 is "feel (gray-box island, controller, one enemy, one weapon)" (§13). It does not say how the picture on screen relates to the tick, how input reaches the tick, what the camera reads, how a remote player's position is shown, or what number a movement change must hit before it is done. The atlas shows the gap: `interpolation_prediction`, `input_buffering`, `perf_budget_tests` and `benchmark_scene` are all `candidate` — asked for, in no spec row — and nothing in §8's gates measures feel.

"Butter-smooth" decomposes into five separately measurable failures, each with a known cause and a known cure:

| The Director's word | What the player sees | Cause | Cure |
|---|---|---|---|
| choppy | movement advances in steps | the picture updates at the tick rate, or frame pacing is uneven | physics interpolation between ticks; stable frame pacing |
| delayed | the character reacts late | input waits for the next tick, low tick rate, V-Sync queueing | per-frame input latched into the next tick; 60 Hz tick; latency budget measured |
| laggy | other players warp, the local player rubber-bands | waiting for the server before moving; no smoothing of remote state | client-side prediction with reconciliation; snapshot interpolation |
| clunky | the camera and body fight; turns feel heavy | camera driven by the tick; animation driving movement | camera per frame on interpolated transforms; animation reads the sim, never the reverse (R5) |
| uncoordinated | feet, body and camera disagree | animation, physics and rendering on different clocks with no shared source of truth | one simulation state per tick; everything visual derives from it |

All five cures are structural. Retrofitting any of them into a controller written without them means rewriting the controller, the camera and the netcode. That is why this is a spec matter now, in Phase 0, and not a Phase 1 tuning task.

## Decision

**1. Movement feel becomes a spec contract with numbers, and a gate.** The Director approves the amendment text in Appendix A (a new rule **R11** in §4, a new gate **G6** in §8, Phase 1 checklist items in §13, prediction readiness in §12, and a netcode-library row in §2). Until approved, the atlas carries the new systems as `candidate` and nothing is built (R10, §14). On approval each candidate flips to `spec` with one `set-node` per system.

**2. The architecture locks (the part that cannot be retrofitted).**

- **Fixed tick at 60 Hz, interpolation on, jitter fix off.** `physics/common/physics_ticks_per_second = 60`; `physics/common/physics_interpolation = true`; `physics/common/physics_jitter_fix = 0`. The Godot manual states physics interpolation exists to remove visual stutter when the render rate and the tick rate differ, that game logic must move to `_physics_process` for it to work, and that `reset_physics_interpolation()` is required when an object teleports; the 4.4 release notes say 3D physics interpolation landed in 4.4 after 2D in 4.3 `[T1]`. The manual's page on jitter, stutter and input lag recommends raising the tick rate to reduce input latency, ideally to a multiple of the display refresh rate `[T1]`; with interpolation on, smoothness no longer depends on that match, but input latency still does. 60 Hz is the lowest tick that meets the input budget below and matches the most common display rate exactly; a higher tick is justified only by a G6b measurement on the reference machine. The server runs the same rate (§12: one clock).
- **Movement is a pure tick step (proposed R11).** Locomotion is a function `(state, intent, tick) → state` with no frame time, node path or wall clock inside it (R4, §12), callable any number of times per frame. This single property is what makes replay (determinism_replay_tests), server authority (§12) and client-side prediction (below) the same code path. It is the one new rule the constitution needs.
- **Presentation reads interpolated transforms; the camera runs per frame.** The camera rig lives in `_process`, follows the target's interpolated transform (the manual's own camera example uses `get_global_transform_interpolated()` with automatic interpolation turned off on the camera) and applies mouse look every frame, never quantized to ticks `[T1]`. Animation state comes from the sim (`sim_driven_timing`, R5) and is played and blended at frame rate; root motion never writes position.
- **Input is sampled every frame and latched into the next tick's intent.** A press shorter than a tick still registers; a held direction is read once per tick. Look input bypasses the tick. `Input.use_accumulated_input` is set to `false` for look when the G6 measurement shows a benefit (the manual documents it as more precise input for more CPU) `[T1]`.
- **Netcode shape, decided now, built in Phase 4.** Server-authoritative (§12). The local player is **predicted** by running the pure step ahead of the server and **reconciled** by re-simulating from the last acknowledged tick when the server disagrees. Remote actors are shown by **snapshot interpolation** behind a two-tick buffer (33 ms at 60 Hz), never extrapolated by default. Abilities whose start is harmless to mispredict (cast start, movement skills) are predicted; their outcomes are not. Godot's `MultiplayerSynchronizer` replicates properties on an interval and offers no prediction or reconciliation `[T1]`, so this layer is either the netfox addon or hand-written code (Decision 4).
- **Determinism is per machine, not across machines.** R4's determinism means the same build on the same machine, given the same seed and intents, produces the same state; that is what replay tests and reconciliation need. Bit-exact agreement across different machines is a non-goal (floating point), which is why the server stays the authority and lockstep is never attempted.

**3. G6, the feel gate, is the definition of done for any movement change (R8).** Two halves, one scripted run on the benchmark scene:

| Half | Runs where | Measures | Proposed budget (DIRECTOR tunes) |
|---|---|---|---|
| G6a headless | CI, every movement PR | sim cost per tick with 10 players and the Phase 1 enemy count; input-to-sim latency in ticks; determinism replay of a recorded walk; prediction error and correction count under simulated 100 ms round trip and 2% loss (headless server + headless client) | tick cost ≤ 4 ms; input-to-sim ≤ 1 tick; replay identical; remote position error ≤ 0.25 m; ≤ 1 visible correction (> 0.5 m) per minute of walking |
| G6b on device | the reference machine named in `docs/balance_ranges.md` (Director's machine until then) | frame time distribution, hitch count, visual tick-locking (a transform that only changes on ticks) during a 120 s scripted soak | p99 frame time ≤ 16.7 ms at 1080p; 0 hitches > 50 ms; 0 tick-locked visuals |

G6a is blocking from Phase 1 for any PR that touches `actors/player/`, `core/commands/`, `core/time/`, `core/net/` or the camera. G6b is advisory until the reference machine exists, then blocking for release builds. Numbers live in `docs/balance_ranges.md` like every other budget (G2 already reads that file).

**4. Netcode library — a DIRECTOR decision under R10, framed for a Phase 1 spike.** netfox (MIT; Godot 4.x) provides a synchronized network tick loop (`NetworkTime`), tick interpolation (`TickInterpolator`), and client-side prediction with server reconciliation and physics rollback (`RollbackSynchronizer`) `[T1, vendor docs]`. Two facts decide the fit and only a spike answers them: its network tick loop is independent of Godot's physics ticks unless `sync_to_physics` is enabled, and movement must be written in `_rollback_tick` rather than `_physics_process`. Both are compatible with R4 and Decision 2 if the network tick is the fixed tick; they are incompatible if it is not. Recommendation: **C — approve a Phase 1 spike** that implements the pure step twice behind one interface (netfox `_rollback_tick`, and a hand-written predictor over the same step), runs G6a on both under the simulated network, and pins the winner in §2 by the end of Phase 1. Alternatives: **A** adopt netfox now (fastest, one external dependency in `addons/`), **B** hand-roll (no dependency, the most error-prone code in the project).

**5. Physics engine — a DIRECTOR decision, pinned by the end of Phase 1.** Godot 4.4 integrated Jolt Physics as an alternative engine, enabled in project settings and marked experimental; the manual lists behavioral differences from Godot Physics in joints, collision margins, contact handling and memory `[T1]`. Character movement in this game is kinematic (`CharacterBody3D`), where the two engines differ least, but the choice changes collision margins and therefore feel, so it is made once, in the Phase 1 spike, and recorded in `project.godot` and this ADR. Recommendation: start on Godot Physics; switch to Jolt only if the spike shows a concrete defect on slopes, stairs or moving platforms.

**6. A change runbook makes the contract executable.** `rb_change_movement` (primary `locomotion`) is the procedure for any change to locomotion, camera, animation state machines, input translation or replication that affects movement: verify the locked settings, verify the step is still pure, run replay, G4 walk, G6, and `observe --strict` (R5: nothing under the camera or animation folders writes gameplay state).

## Evidence basis

- **Engine facts (V1):** Godot manual pages *Using physics interpolation*, *Advanced physics interpolation* (the camera example), *Fixing jitter, stutter and input lag*, *Using Jolt Physics*, the `Engine` class reference (`physics_ticks_per_second`, `physics_jitter_fix`, `max_physics_steps_per_frame`, `max_fps`), the `Input` class reference (`use_accumulated_input`), *High-level multiplayer* and the `MultiplayerSynchronizer` class reference; the Godot 4.4 release page. Read through the Context7 documentation mirror and the search tool's page summaries because `docs.godotengine.org` and `godotengine.org` are blocked by this environment's egress proxy; exact wording should be re-read from the live pages when the Director opens them. `[T1][H]`
- **netfox (V2):** the repository README (MIT license, Godot 4.x, four addons, 1.1k stars) and its documentation for `RollbackSynchronizer`, `TickInterpolator` and `NetworkTime`, read from the repository on GitHub. Single-source: the project's own documentation; not independently corroborated. `[T1 for its own behavior][M]`
- **Gap in the atlas (V3):** `scripts/systems-map.sh show interpolation_prediction` — `candidate`, no spec row, only two soft edges; `validation_gates` has no feel or latency check; `perf_budget_tests` and `benchmark_scene` are `candidate`. `[internal][H]`
- **The decomposition table** is engineering reasoning from the cited mechanisms, not a measurement. It becomes measured when G6 runs. `[reasoning][M]`
- **Critic review (V4):** the read-only Critic reviewed this ADR, the runbook and the art scope on 2026-09-06 and returned *reject* with two required text fixes — the §2 netfox row contradicted itself on when netfox may enter `addons/`, and the runbook listed G6 beside G4 as if it were a shipped gate — plus five optional suggestions; both fixes and four suggestions are applied in the follow-up commit. It judged the hard scope-leak edges correct as drafted. `[internal][H]`
- **What would change this call:** a Godot release that changes physics-interpolation or tick semantics; a spike result showing netfox's tick loop cannot be pinned to the physics tick (Decision 4 then collapses to B); G6 measurements showing the 60 Hz budgets cannot be met on the reference machine (then the numbers move, not the mechanism). `[reasoning]`

## Cost model

- Phase 0: this ADR, the runbook, four candidate systems and their edges, a docs page — no code.
- Phase 1: the pure-step locomotion is the controller Phase 1 must write anyway; interpolation and the per-frame camera add hours, not days; the G6a harness is a scripted intent recording plus a headless server and client, roughly the size of the G4 bot; the spike costs one to two weeks and pays for itself the first time a Phase 4 netcode decision does not require rewriting Phase 1 code.
- Phase 4: prediction and interpolation are Phase 4 work either way; the spike converts an open-ended risk into a pinned dependency.
- Ongoing: G6a in CI adds one headless run per movement PR.

## Consequences

**Locks in:** 60 Hz fixed tick with interpolation; movement as a pure re-runnable step; camera, look and animation playback per frame from interpolated transforms; prediction and snapshot interpolation as the Phase 4 model; a numbered feel gate as the definition of done for movement changes; the physics-engine and netcode-library choices pinned by the end of Phase 1.

**Locks out:** movement code that reads frame time, node paths or the wall clock; a camera driven by the tick; animation that moves the body; lockstep or cross-machine determinism as goals; changing tick rate, interpolation or jitter-fix settings without a G6 run; a netcode library that enters `addons/` without the §2 row (R10).

**Migration:** additive. Nothing exists yet; the first controller is written to the contract. If the Director rejects R11, the atlas nodes stay `candidate`, the 18 edges are re-pointed soft with the rejection recorded in each edge's why so the gap stays visible without a finding, and Phase 1 proceeds with the spec as written, with the risk stated in Context.

**Open for the DIRECTOR:**
1. Approve, amend or reject the Appendix A text (R11, G6, §13 items, §12 additions, §2 row, and the one-line §14 fix that adds §4 to the contract-change list).
2. Netcode library: A adopt netfox now, B hand-roll, **C spike both in Phase 1** (recommended).
3. Physics engine: pin Godot Physics for Phase 1 with a Jolt switch only on a shown defect (recommended), or start on Jolt.
4. The reference machine: name the hardware that defines G6b, or defer until Phase 1.
5. The G6 numbers: accept the proposed defaults or set different ones; they are budgets, not measurements, until the harness runs.

## Alternatives considered

- **Tune feel in Phase 1 without a contract.** Rejected: the five cures are structural; a controller written without them is rewritten, not tuned.
- **A lower tick (30 Hz) for cheaper simulation.** Rejected for movement: input-to-sim latency doubles and 30 is not a multiple of 144 Hz displays; a lower *network send rate* is still allowed under `bandwidth_budget`.
- **Extrapolation instead of interpolation for remote actors.** Rejected as the default: it hides latency with guesses that are wrong at every direction change; the two-tick buffer costs 33 ms and shows the truth.
- **Cross-machine determinism (lockstep).** Rejected: floating-point results differ across hardware; the server is the authority (§12) and prediction needs only same-machine determinism.
- **Decide netfox now without a spike.** Not chosen: the tick-loop coupling question is real and cheap to answer with code; the Director may still choose A.

## Affects / Affected by

On approval, Appendix A is pasted into GAME_INFRA_SPEC.md (§2, §4 R11, §8 G6, §12, §13) and the G6 budgets go into docs/balance_ranges.md when that file exists; neither is listed below because neither carries this ADR's id yet.

**This ADR affects:**
- `systems/registry/00-foundation.md` — `render_interpolation`, `pure_movement_step`
- `systems/registry/10-presentation.md` — `input_sampling`
- `systems/registry/14-operations.md` — `g6_feel_gate`
- `systems/registry/11-multiplayer.md` — `interpolation_prediction` summary and edges
- `systems/runbooks/change_movement.md` — the procedure (Decision 6)
- `docs/art_style_scope.md` — the graphics scope written in the same session; its animation-quality note points here
- `CLAUDE.md` — ADR listed in flight; open question for the Director

**This ADR is affected by:**
- `adr/0065-systems-atlas-and-impact-map.md` — the registry the new systems join
- `adr/0066-agent-ready-change-discipline.md` — runbook format and coverage rule
- `adr/0067-declared-versus-observed.md` — `observe --strict` as the R5 check in the runbook
- `GAME_INFRA_SPEC.md` — §4 R4/R5, §8, §12, §13, §14 (change control)

## References

- Godot Engine documentation, *Using physics interpolation* and *Advanced physics interpolation*, stable branch, docs.godotengine.org/en/stable/tutorials/physics/interpolation/ (via Context7 mirror, 2026-09-05) `[T1]`
- Godot Engine documentation, *Fixing jitter, stutter and input lag*, docs.godotengine.org/en/stable/tutorials/rendering/jitter_stutter.html (via Context7 mirror and search summary, 2026-09-05) `[T1]`
- Godot Engine documentation, *Using Jolt Physics*, docs.godotengine.org/en/stable/tutorials/physics/using_jolt_physics.html (via Context7 mirror, 2026-09-05) `[T1]`
- Godot Engine documentation, class references `Engine`, `Input`, `MultiplayerSynchronizer`; *High-level multiplayer* (via Context7 mirror, 2026-09-05) `[T1]`
- Godot Engine, *Godot 4.4, a unified experience* release notes, godotengine.org/releases/4.4/ (search summary; page blocked from this environment) `[T1]`
- foxssake, *netfox* repository and documentation, github.com/foxssake/netfox (README; docs/netfox/nodes/rollback-synchronizer.md, tick-interpolator.md; docs/netfox/guides/network-time.md), read 2026-09-05 `[T1, vendor docs, single-source]`

## Appendix A — proposed spec amendment (paste into GAME_INFRA_SPEC.md on approval)

**§2 Tech stack, new row:**

| Netcode (Phase 4) | netfox (MIT) — *this row's approval is itself the R10 PR for spike-only use: netfox may enter `addons/` on the Phase 1 spike branch to run the Decision 4 comparison; it ships in the mainline only if this row is updated to "adopted" by the end of Phase 1, and is removed from the repository if "rejected"* | Prediction, reconciliation and tick interpolation exist and are maintained; the hand-written fallback is the most error-prone code in the project | R10 satisfied for spike-only use by this row; a second edit to this row (adopted or rejected) gates shipping it |

**§4, after R10:**

- **R11 — Movement feel contract.** (a) The simulation ticks at 60 Hz; physics interpolation is on; jitter fix is 0. (b) Movement is a pure tick step `(state, intent, tick) → state` — no frame time, node paths or wall clock inside it — and may be re-run any number of times per frame. (c) Presentation reads interpolated transforms; the camera and look input run every frame; a teleport resets interpolation. (d) Input is sampled every frame and latched into the next tick's intent; a press shorter than a tick still registers. (e) In Phase 4 the local player is predicted and reconciled, remote actors are interpolated behind a two-tick buffer, and nothing is extrapolated by default. (f) A movement change is done when G6 passes.

**§8, new row:**

| **G6** | Feel (Phase 1+) | `godot --headless -s tools/testing/feel.gd` (G6a: tick cost, input-to-sim ticks, determinism replay, prediction error under simulated 100 ms / 2% loss) · `tools/testing/feel.gd --device` on the reference machine (G6b: p99 frame time, hitches, tick-locked visuals) — budgets in `docs/balance_ranges.md` | ✔ G6a from Phase 1 for movement PRs; G6b advisory until the reference machine is named |

**§12, additional bullets:**

- Locomotion is the pure step of R11(b); the server and the predicting client run the same function.
- Snapshots carry the tick they describe; clients keep a two-tick interpolation buffer for remote actors.

**§14, first bullet:** add `§4 architecture rules` to the enumerated contract changes (`§5 bus, §6 schemas, §7 roster, §8 gates, §2/§9 dependencies`), so an R-series change is covered by the letter of §14 and not only its spirit.

**§13, Phase 1 checklist additions:**

- [ ] Feel spike: netfox and a hand-written predictor over the same pure step, both through G6a under the simulated network; §2 row set to adopted or rejected
- [ ] Physics engine pinned (Godot Physics or Jolt) in `project.godot` after the spike; recorded in ADR-0068
- [ ] Reference machine named in `docs/balance_ranges.md`; G6b run once and the numbers recorded
