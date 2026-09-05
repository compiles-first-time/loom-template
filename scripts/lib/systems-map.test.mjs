#!/usr/bin/env node
// Unit tests for scripts/lib/systems-map.mjs (ADR-0065).
//
// Two layers: a small in-memory registry that pins the parser, the direction
// rule, reachability and every validator finding; then the LIVE registry under
// systems/registry/, which must validate with zero errors and render
// deterministically (the doctor and CI depend on both).

import path from "node:path";
import { existsSync } from "node:fs";
import {
  parseRegistryText, buildGraph, validate, affects, affectedBy, blastRadius, impactReport,
  parseSpecSignals, renderAtlas, renderExplorer, renderAll, staleGenerated, atlasJson, stats, contentHash, loadAll,
  HOW_NAMES, STATUSES, OWNERS,
} from "./systems-map.mjs";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const NODE_HEADER = `| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |\n|---|---|---|---|---|---|---|---|---|---|---|`;
const EDGE_HEADER = `| From | How | To | Via | Strength | Why |\n|---|---|---|---|---|---|`;
const n = (id, name, tier, parent, phase, status, owner, where, spec, summary, analogy = "—") =>
  `| ${id} | ${name} | ${tier} | ${parent} | ${phase} | ${status} | ${owner} | ${where} | ${spec} | ${summary} | ${analogy} |`;
const e = (from, how, to, via, strength, why) => `| ${from} | ${how} | ${to} | ${via} | ${strength} | ${why} |`;

const BASE_NODES = [
  n("foundation", "Foundation", 1, "—", 0, "spec", "orchestrator", "core/", "§4", "the base", "electrical panel"),
  n("event_bus", "EventBus", 2, "foundation", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "the bus", "group chat"),
  n("sig_actor_died", "actor_died", 3, "event_bus", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "actor_id, killer_id"),
  n("sig_level_up", "level_up (proposed)", 3, "event_bus", 2, "candidate", "orchestrator", "core/events/event_bus.gd", "—", "actor_id, level"),
  n("combat", "Combat", 1, "—", 1, "spec", "orchestrator", "core/combat/", "§5", "fighting", "referee"),
  n("damage_model", "Damage model", 2, "combat", 1, "spec", "orchestrator", "core/combat/damage.gd", "§5", "hits to numbers", "scoring table"),
  n("death_resolution", "Death resolution", 3, "damage_model", 1, "spec", "orchestrator", "core/combat/death.gd", "§5", "zero health is death"),
  n("economy", "Economy", 1, "—", 2, "spec", "content-smith", "data/", "§6", "items and loot", "supply chain"),
  n("loot", "Loot", 2, "economy", 2, "spec", "content-smith", "core/loot/", "§6.6", "drops", "raffle drum"),
  n("loot_rolls", "Loot rolls", 3, "loot", 2, "implied", "orchestrator", "core/loot/roll.gd", "§6.6", "rolls on death"),
  n("talents", "Talents", 2, "combat", "—", "candidate", "director", "data/talents/", "—", "trees", "sticker poster"),
  n("survival", "Survival", 1, "—", 3, "spec", "orchestrator", "core/survival/", "§3", "needs", "camping"),
  n("hunger", "Hunger", 2, "survival", 3, "spec", "orchestrator", "core/survival/needs.gd", "§3", "drains", "fuel gauge"),
];
const BASE_EDGES = [
  e("death_resolution", "emits", "sig_actor_died", "—", "hard", "death is announced"),
  e("loot_rolls", "listens", "sig_actor_died", "—", "hard", "loot rolls on death"),
  e("loot_rolls", "reads", "damage_model", "killer id", "soft", "credit the killer"),
  e("hunger", "listens", "sig_level_up", "—", "hard", "a proposed listener"),
];
const text = (nodes, edges) => `# Test\n\n## Nodes\n\n${NODE_HEADER}\n${nodes.join("\n")}\n\n## Edges\n\n${EDGE_HEADER}\n${edges.join("\n")}\n`;
function build(nodes = BASE_NODES, edges = BASE_EDGES, file = "t.md") {
  const r = parseRegistryText(text(nodes, edges), file);
  const registry = { ...r, files: [file], sources: [{ file, text: text(nodes, edges) }] };
  const graph = buildGraph(registry);
  return { registry, graph };
}

// ─── parsing ────────────────────────────────────────────────────────────────
console.log("\nparsing");
{
  const { registry, graph } = build();
  assert(registry.problems.length === 0, "well-formed tables parse without problems");
  assert(registry.nodes.length === BASE_NODES.length, "every node row becomes a node");
  assert(registry.edges.length === BASE_EDGES.length, "every edge row becomes an edge");
  const bus = graph.nodes.get("event_bus");
  assert(bus.parent === "foundation" && bus.tier === 2, "parent and tier parsed");
  assert(graph.nodes.get("talents").phase === null, "— phase parses as null");
  assert(graph.nodes.get("sig_actor_died").kind === "signal", "sig_* nodes are signals");
  assert(graph.nodes.get("death_resolution").domain === "combat", "domain is the tier-1 ancestor");
  assert(graph.nodes.get("death_resolution").ancestors.join(",") === "damage_model,combat", "ancestors nearest-first");
  const esc = parseRegistryText(text([n("a", "A", 1, "—", 0, "spec", "orchestrator", "x", "—", "pipe \\| inside")], []), "e.md");
  assert(esc.nodes[0].summary === "pipe | inside", "escaped pipes survive inside a cell");
  const missing = parseRegistryText("# no tables\n", "m.md");
  assert(missing.problems.length === 2, "missing Nodes and Edges tables are reported");
  const badCols = parseRegistryText("## Nodes\n\n| ID | Name |\n|---|---|\n| a | b |\n\n## Edges\n\n" + EDGE_HEADER + "\n", "c.md");
  assert(badCols.problems.some((p) => /missing column/.test(p)), "missing columns are reported");
}

// ─── direction ──────────────────────────────────────────────────────────────
console.log("\ndirection: emits flows forward, everything else flows backward");
{
  const { graph } = build();
  const emit = graph.influence.find((ie) => ie.how === "emits");
  assert(emit.src === "death_resolution" && emit.dst === "sig_actor_died", "emitter → signal");
  const listen = graph.influence.find((ie) => ie.how === "listens" && ie.from === "loot_rolls");
  assert(listen.src === "sig_actor_died" && listen.dst === "loot_rolls", "signal → listener");
  const read = graph.influence.find((ie) => ie.how === "reads");
  assert(read.src === "damage_model" && read.dst === "loot_rolls", "read target → reader");
}

// ─── reachability ───────────────────────────────────────────────────────────
console.log("\nreachability");
{
  const { graph } = build();
  const down = affects(graph, "death_resolution");
  assert(down.hits.map((h) => h.id).join(",") === "sig_actor_died,loot_rolls", "affects walks emitter → signal → listener");
  assert(down.hits[1].depth === 2, "the listener is two hops away");
  const up = affectedBy(graph, "loot_rolls");
  assert(up.hits.some((h) => h.id === "sig_actor_died") && up.hits.some((h) => h.id === "death_resolution"), "affected-by walks back to the emitter");
  assert(up.hits.some((h) => h.id === "damage_model"), "affected-by includes read targets");
  const domain = affects(graph, "combat");
  assert(!domain.hits.some((h) => h.id === "damage_model"), "a domain's own parts are internal, never reported");
  assert(domain.hits.some((h) => h.id === "loot_rolls"), "a domain's impact includes its descendants' edges");
  const noExpand = affects(graph, "combat", { expand: false });
  assert(noExpand.hits.length === 0, "--no-expand ignores descendants");
  const shallow = affects(graph, "death_resolution", { depth: 1 });
  assert(shallow.hits.length === 1, "depth limits the walk");
  const phased = affects(graph, "death_resolution", { phase: 1 });
  assert(!phased.hits.some((h) => h.id === "loot_rolls"), "--phase hides systems that land later");
  assert(blastRadius(graph, "death_resolution") === 2, "blast radius counts transitive downstream");
  let threw = false;
  try { affects(graph, "nope"); } catch { threw = true; }
  assert(threw, "unknown ids throw");
}

// ─── validation ─────────────────────────────────────────────────────────────
console.log("\nvalidation: findings");
{
  const { registry, graph } = build();
  const v = validate(registry, graph);
  assert(v.ok, "the base fixture has no errors");
  assert(v.warnings.some((w) => /sig_level_up has no emitter/.test(w)), "a signal without an emitter warns");
  assert(!v.warnings.some((w) => /scope leak/.test(w)), "a listener on a candidate signal is not a scope leak");
  assert(!v.warnings.some((w) => /phase inversion/.test(w)), "a listener that predates its signal is not a phase inversion");
}
{
  const nodes = [...BASE_NODES, n("orphan", "Orphan", 3, "ghost", 1, "spec", "orchestrator", "x", "—", "no parent")];
  const { registry, graph } = build(nodes);
  const v = validate(registry, graph);
  assert(v.errors.some((x) => /Parent "ghost" does not exist/.test(x)), "missing parent is an error");
}
{
  const nodes = [...BASE_NODES, n("wrongtier", "Wrong", 4, "combat", 1, "spec", "orchestrator", "x", "—", "tier skip")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /must be 3/.test(x)), "tier must be parent tier + 1");
}
{
  const nodes = [...BASE_NODES, n("dupe", "D", 2, "combat", 1, "spec", "orchestrator", "x", "—", "a"), n("dupe", "D2", 2, "combat", 1, "spec", "orchestrator", "x", "—", "b")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /duplicate id "dupe"/.test(x)), "duplicate ids are an error");
}
{
  const nodes = [...BASE_NODES, n("Bad-Id", "B", 2, "combat", 1, "spec", "orchestrator", "x", "—", "a")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /not snake_case/.test(x)), "ids must be snake_case");
}
{
  const nodes = [...BASE_NODES, n("nostatus", "N", 2, "combat", 1, "maybe", "nobody", "x", "—", "a")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /Status "maybe"/.test(x)), "unknown status is an error");
  assert(v.errors.some((x) => /Owner "nobody"/.test(x)), "unknown owner is an error");
}
{
  const nodes = [...BASE_NODES, n("nophase", "N", 2, "combat", "—", "spec", "orchestrator", "x", "—", "a")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /is spec but has no Phase/.test(x)), "spec systems must carry a phase");
}
{
  const nodes = [...BASE_NODES, n("ng", "N", 2, "combat", 3, "non-goal", "director", "x", "—", "a")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.errors.some((x) => /non-goal and must not carry a Phase/.test(x)), "non-goals must not carry a phase");
}
{
  const edges = [...BASE_EDGES, e("loot_rolls", "reads", "nowhere", "—", "hard", "x"), e("loot_rolls", "teleports", "damage_model", "—", "hard", "x"), e("loot_rolls", "reads", "hunger", "—", "hard", ""), e("loot_rolls", "reads", "hunger", "—", "", "why"), e("loot_rolls", "emits", "hunger", "—", "hard", "x"), e("hunger", "reads", "sig_actor_died", "—", "hard", "x"), e("loot_rolls", "reads", "loot_rolls", "—", "hard", "x")];
  const v = validate(...Object.values(build(BASE_NODES, edges)));
  assert(v.errors.some((x) => /To "nowhere" does not exist/.test(x)), "dangling edge target is an error");
  assert(v.errors.some((x) => /How "teleports"/.test(x)), "unknown how is an error");
  assert(v.errors.some((x) => /has no Why/.test(x)), "an edge without a why is an error");
  assert(v.errors.some((x) => /has no Strength/.test(x)), "an edge without a strength is an error");
  assert(v.errors.some((x) => /emits target "hunger" is not a sig_/.test(x)), "emits must target a signal");
  assert(v.errors.some((x) => /only emits\/listens may target a signal/.test(x)), "reads must not target a signal");
  assert(v.errors.some((x) => /self-edge/.test(x)), "self-edges are an error");
}
{
  const edges = [...BASE_EDGES, e("death_resolution", "reads", "hunger", "—", "hard", "x")];
  const v = validate(...Object.values(build(BASE_NODES, edges)));
  assert(v.warnings.some((w) => /phase inversion — death_resolution \(P1\) hard-depends on hunger \(P3\)/.test(w)), "a hard dependency on a later phase warns");
}
{
  const edges = [...BASE_EDGES, e("death_resolution", "reads", "talents", "—", "hard", "x")];
  const v = validate(...Object.values(build(BASE_NODES, edges)));
  assert(v.warnings.some((w) => /scope leak — spec system death_resolution hard-depends on candidate talents/.test(w)), "a spec system hard-depending on a candidate warns");
  const soft = validate(...Object.values(build(BASE_NODES, [...BASE_EDGES, e("death_resolution", "reads", "talents", "—", "soft", "x")])));
  assert(!soft.warnings.some((w) => /scope leak/.test(w)), "a soft edge to a candidate is fine");
}
{
  const edges = [...BASE_EDGES, e("hunger", "calls", "damage_model", "—", "hard", "x")];
  const v = validate(...Object.values(build(BASE_NODES, edges)));
  assert(v.warnings.some((w) => /R2 smell — hunger \(core\/survival\) calls damage_model \(core\/combat\)/.test(w)), "a direct call across core/ subtrees is an R2 smell");
  const same = validate(...Object.values(build(BASE_NODES, [...BASE_EDGES, e("death_resolution", "calls", "damage_model", "—", "hard", "x")])));
  assert(!same.warnings.some((w) => /R2 smell/.test(w)), "a call inside one core/ subtree is allowed");
}
{
  const nodes = [...BASE_NODES, n("island", "Island", 2, "survival", 3, "spec", "orchestrator", "x", "—", "unwired", "an island")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.warnings.some((w) => /island — island and its parts have no edges/.test(w)), "an unwired tier-2 system warns");
}
{
  const nodes = [...BASE_NODES, n("quiet", "Quiet", 2, "survival", 3, "spec", "orchestrator", "x", "—", "no analogy")];
  const v = validate(...Object.values(build(nodes)));
  assert(v.warnings.some((w) => /quiet \(tier 2\) has no Analogy/.test(w)), "tier 1–2 rows without an analogy warn");
}
{
  const edges = [...BASE_EDGES, e("loot_rolls", "reads", "hunger", "—", "hard", "x"), e("hunger", "reads", "loot_rolls", "—", "hard", "y")];
  const v = validate(...Object.values(build(BASE_NODES, edges)));
  assert(v.info.some((i) => /feedback loop/.test(i)), "cycles are reported as info");
}

// ─── spec §5 cross-check ────────────────────────────────────────────────────
console.log("\nspec §5 cross-check (R-EB1)");
{
  const spec = `# Spec\n\n## 5. EventBus contract v1\n\n| Signal | Payload |\n|---|---|\n| \`actor_died\` | x |\n| \`world_saved\` / \`world_loaded\` | slot |\n\n## 6. Data\n\n| \`not_a_signal\` | y |\n`;
  const sigs = parseSpecSignals(spec);
  assert(sigs.size === 3 && sigs.has("world_loaded"), "combined rows yield both signal names; later sections are ignored");
  const { registry, graph } = build();
  const v = validate(registry, graph, { specText: spec });
  assert(v.errors.some((x) => /spec §5 declares signal `world_saved` but the registry has no sig_world_saved/.test(x)), "a §5 signal missing from the registry is an error");
  assert(v.info.some((i) => /proposed signal\(s\) await a §5 row.*candidate \(level_up\)/.test(i)), "proposed signals are listed as §5 proposals, split by whether a spec system already emits them");
  const nodes = [...BASE_NODES, n("sig_ghost", "ghost", 3, "event_bus", 0, "spec", "orchestrator", "x", "§5", "not in the spec")];
  const v2 = validate(...Object.values(build(nodes)), { specText: spec });
  assert(v2.errors.some((x) => /registry marks sig_ghost as status spec but spec §5 has no such row/.test(x)), "a spec-status signal absent from §5 is an error");
  const v3 = validate(registry, graph, { specText: "# no section" });
  assert(v3.warnings.some((w) => /§5 cross-check skipped/.test(w)), "a spec without §5 warns instead of failing");
}

// ─── reports and renderers ──────────────────────────────────────────────────
console.log("\nreports and renderers");
{
  const { registry, graph } = build();
  const v = validate(registry, graph);
  const report = impactReport(graph, "death_resolution");
  assert(/Downstream \(affects\) \| 2 \(2 hard\)/.test(report), "the impact report counts downstream and hard edges");
  assert(/Owners to loop in \| orchestrator/.test(report), "the impact report names owners");
  assert(/Signals crossing this change \| actor_died/.test(report), "the impact report names signals");
  assert(/Review checklist/.test(report), "the impact report ends with a checklist");
  const st = stats(graph);
  assert(st.domains.length === 4 && st.signals.length === 2, "stats count domains and signals");
  const atlas = renderAtlas(graph, v, { hash: "abc" });
  assert(/registry-hash: abc/.test(atlas) && /```mermaid/.test(atlas) && /DIRECTOR decisions/.test(atlas), "the atlas carries the hash, mermaid and the decisions section");
  const tpl = `<script>const A = /*__ATLAS_JSON__*/null; const H = "__REGISTRY_HASH__";</script>`;
  const html = renderExplorer(graph, v, { hash: "abc", template: tpl });
  assert(!/__ATLAS_JSON__/.test(html) && /"hash":"abc"/.test(html) && /const H = "abc"/.test(html), "the explorer template is filled");
  const json = atlasJson(graph, v, { hash: "abc" });
  assert(json.nodes.length === BASE_NODES.length && json.edges.length === BASE_EDGES.length, "atlas json carries every node and edge");
  assert(contentHash(registry) === contentHash(registry) && contentHash(registry).length === 12, "the content hash is stable and short");
  assert(HOW_NAMES.length === 12 && STATUSES.length === 4 && OWNERS.length === 6, "vocabulary sizes are pinned");
}

// ─── the live registry ──────────────────────────────────────────────────────
console.log("\nlive registry (systems/registry)");
{
  const dir = path.join(PROJECT_ROOT, "systems", "registry");
  if (!existsSync(dir)) {
    assert(true, "no live registry in this project (skipped)");
  } else {
    const live = await loadAll({ root: PROJECT_ROOT });
    assert(live.validation.errors.length === 0, `live registry has zero errors (${live.validation.errors.slice(0, 3).join(" · ")})`);
    assert(live.graph.nodes.size > 100 && live.graph.influence.length > 100, `live registry is populated (${live.graph.nodes.size} nodes, ${live.graph.influence.length} edges)`);
    const a1 = renderAll(live.graph, live.validation, { hash: live.hash, runbooks: live.runbooks });
    const a2 = renderAll(live.graph, live.validation, { hash: live.hash, runbooks: live.runbooks });
    assert([...a1.keys()].every((k) => a1.get(k) === a2.get(k)) && a1.size === a2.size, `rendering is deterministic across ${a1.size} generated files`);
    assert(a1.size === 2 + stats(live.graph).domains.length + 5, "one page per domain plus the index, the explorer and the five LLM-pack files");
    const stale = await staleGenerated(a1, PROJECT_ROOT);
    assert(stale.length === 0, `generated files on disk are current (${stale.join(", ") || "all current"})`);
    const sigDied = affects(live.graph, "sig_actor_died");
    assert(sigDied.hits.length >= 5, `actor_died reaches at least five systems (${sigDied.hits.length})`);
    const specSignals = parseSpecSignals(live.specText);
    assert(specSignals && specSignals.size === 16, `spec §5 lists 16 signals (${specSignals ? specSignals.size : "none"})`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
