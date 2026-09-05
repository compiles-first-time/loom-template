#!/usr/bin/env node
// Unit tests for declared-versus-observed (ADR-0067): the GDScript / .tres fact
// extractors, the comparison against a registry, the R2–R6 fitness checks with
// reviewable exceptions, and the CODEOWNERS generator. Runs against the checked-in
// fixture project under scripts/lib/fixtures/godot-sample, which carries deliberate
// violations so the checks are exercised, not assumed.

import path from "node:path";
import os from "node:os";
import { promises as fs, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRegistryText, buildGraph, renderCodeowners, loadAll, CODEOWNERS_FILE } from "./systems-map.mjs";
import { scanProject, extractAll, extractGd, extractResource, observe, observeProject, renderObserve, hasGameCode, godotRoot, RULES } from "./systems-observe.mjs";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "godot-sample");

const NODE_HEADER = `| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |\n|---|---|---|---|---|---|---|---|---|---|---|`;
const EDGE_HEADER = `| From | How | To | Via | Strength | Why |\n|---|---|---|---|---|---|`;
const n = (id, name, tier, parent, phase, status, owner, where, spec, summary, analogy = "—") =>
  `| ${id} | ${name} | ${tier} | ${parent} | ${phase} | ${status} | ${owner} | ${where} | ${spec} | ${summary} | ${analogy} |`;
const e = (from, how, to, via, strength, why) => `| ${from} | ${how} | ${to} | ${via} | ${strength} | ${why} |`;
const NODES = [
  n("foundation", "Foundation", 1, "—", 0, "spec", "orchestrator", "core/", "§4", "the base", "panel"),
  n("event_bus", "EventBus", 2, "foundation", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "the bus", "group chat"),
  n("sig_actor_damaged", "actor_damaged", 3, "event_bus", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "payload"),
  n("sig_actor_healed", "actor_healed", 3, "event_bus", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "payload"),
  n("sig_item_consumed", "item_consumed", 3, "event_bus", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "payload"),
  n("data_schemas", "Data schemas", 2, "foundation", 0, "spec", "orchestrator", "core/schemas/", "§6", "the nouns", "forms"),
  n("schema_item_def", "ItemDef", 3, "data_schemas", 0, "spec", "orchestrator", "core/schemas/item_def.gd", "§6.1", "item fields"),
  n("schema_status_effect_def", "StatusEffectDef", 3, "data_schemas", 0, "spec", "orchestrator", "core/schemas/status_effect_def.gd", "§6.4", "effect fields"),
  n("combat", "Combat", 1, "—", 1, "spec", "orchestrator", "core/combat/", "§5", "fighting", "referee"),
  n("damage_model", "Damage model", 2, "combat", 1, "spec", "orchestrator", "core/combat/damage.gd", "§5", "hits to numbers", "scoring table"),
  n("effect_defs_content", "Effect defs", 2, "combat", 0, "spec", "content-smith", "data/effects/", "§6.4", "effect files", "cards"),
  n("survival", "Survival", 1, "—", 3, "spec", "orchestrator", "core/survival/", "§3", "needs", "camping"),
  n("needs", "Needs", 2, "survival", 3, "spec", "orchestrator", "core/survival/needs.gd", "§3", "drains", "fuel gauge"),
  n("presentation", "Presentation", 1, "—", 1, "spec", "orchestrator", "ui/", "§4 R5", "what the player sees", "stage"),
  n("hud", "HUD", 2, "presentation", 1, "spec", "orchestrator", "ui/hud/", "§4 R5", "bars and frames", "dashboard"),
  n("health_bar", "Health bar", 3, "hud", 1, "spec", "orchestrator", "ui/hud/health_bar.gd", "§4 R5", "the bar"),
  n("economy", "Economy", 1, "—", 2, "spec", "content-smith", "data/", "§6", "items", "supply chain"),
  n("items", "Items", 2, "economy", 0, "spec", "content-smith", "data/items/", "§6.1", "item files", "catalog"),
];
const EDGES = [
  e("damage_model", "emits", "sig_actor_damaged", "—", "hard", "hits are announced"),
  e("needs", "listens", "sig_item_consumed", "—", "hard", "eating restores"),
  e("needs", "listens", "sig_actor_healed", "—", "hard", "declared but not yet in code"),
  e("health_bar", "listens", "sig_actor_damaged", "—", "hard", "the bar shrinks"),
  e("items", "reads", "schema_item_def", "—", "hard", "every item file matches the schema"),
  e("effect_defs_content", "reads", "schema_status_effect_def", "—", "hard", "every effect file matches the schema"),
];
function build() {
  const text = `# Test\n\n## Nodes\n\n${NODE_HEADER}\n${NODES.join("\n")}\n\n## Edges\n\n${EDGE_HEADER}\n${EDGES.join("\n")}\n`;
  const r = parseRegistryText(text, "t.md");
  return buildGraph({ ...r, files: ["t.md"], sources: [{ file: "t.md", text }] });
}

// ─── extractors ─────────────────────────────────────────────────────────────
console.log("\nextractors");
{
  const gd = extractGd("core/survival/needs.gd", await fs.readFile(path.join(FIXTURE, "core/survival/needs.gd"), "utf8"));
  assert(gd.preloads.length === 1 && gd.preloads[0].path === "core/combat/damage.gd", "preload() paths are extracted and res:// stripped");
  assert(gd.listens.length === 1 && gd.listens[0].signal === "item_consumed", "EventBus.<signal>.connect is a listen");
  assert(gd.rng.length === 1 && gd.rng[0].call === "randf", "global RNG calls are found");
  assert(gd.wallClock.length === 1 && gd.allows.length === 1 && gd.allows[0].rule === "R4" && gd.allows[0].reason.startsWith("debug timing"), "wall-clock calls and `atlas: allow` comments with reasons are found");
  const fn = gd.funcs.find((f) => f.name === "_on_item_consumed");
  assert(fn && fn.untypedParams.length === 3 && !fn.hasReturn && !fn.docstring && !fn.callback, "untyped parameters, missing return type and missing docstring are detected");
  assert(gd.funcs.find((f) => f.name === "_ready").callback, "engine callbacks are recognized");
  const dm = extractGd("core/combat/damage.gd", await fs.readFile(path.join(FIXTURE, "core/combat/damage.gd"), "utf8"));
  assert(dm.classNameDeclared === "DamageModel" && dm.emits[0].signal === "actor_damaged", "class_name and EventBus.<signal>.emit are extracted");
  const ok = dm.funcs.find((f) => f.name === "apply_hit");
  assert(ok.untypedParams.length === 0 && ok.hasReturn && ok.docstring, "a typed, documented function passes R6");
  const bus = extractGd("core/events/event_bus.gd", await fs.readFile(path.join(FIXTURE, "core/events/event_bus.gd"), "utf8"));
  assert(bus.signals.map((s) => s.name).join() === "actor_damaged,actor_healed,item_consumed,debug_ping", "signal declarations are extracted in order");
  const tres = extractResource("data/items/item_iron_sword.tres", await fs.readFile(path.join(FIXTURE, "data/items/item_iron_sword.tres"), "utf8"));
  assert(tres.id === "item_iron_sword" && tres.scriptPath === "core/schemas/item_def.gd", "a def's id and script are extracted");
  assert(tres.idRefs.some((r) => r.field === "on_use_effect" && r.id === "effect_burning") && tres.pathRefs.some((p) => p.path === "art/icons/items/item_iron_sword.png"), "id references and res:// path references are extracted");
  const gdAlt = extractGd("x.gd", 'func _ready():\n\tEventBus.emit_signal("spell_cast", 1)\n\tEventBus.connect("actor_died", _f)\n\tvar n = get_node("/root/World/Enemy")\n');
  assert(gdAlt.emits[0].signal === "spell_cast" && gdAlt.listens[0].signal === "actor_died" && gdAlt.nodePaths.length === 1, "string-form emit_signal/connect and /root node paths are extracted");
}

// ─── observe on the fixture project ─────────────────────────────────────────
console.log("\nobserve (fixture project)");
{
  const graph = build();
  const scan = await scanProject(FIXTURE);
  assert(scan.godotRoot === FIXTURE && scan.files.length === 8, `the fixture project scans to eight text files (${scan.files.length})`);
  const o = observe(graph, scan, extractAll(scan), { specSignals: new Set(["actor_damaged", "actor_healed", "item_consumed", "spell_cast"]) });
  assert(o.unowned.length === 0, `every fixture file maps to a system (${o.unowned.join(", ") || "all owned"})`);
  const real = o.violations.filter((v) => !v.allowed);
  assert(o.counts.byRule.R2 === 1 && real.find((v) => v.rule === "R2").file === "core/survival/needs.gd", "R2: a core/ subsystem preloading another core/ subsystem is a violation");
  assert(o.counts.byRule.R4 === 1 && real.find((v) => v.rule === "R4").message.includes("randf"), "R4: global RNG in core/ is a violation");
  assert(o.counts.allowed === 1 && o.violations.find((v) => v.allowed).rule === "R4", "an `atlas: allow R4 — reason` line is an allowed exception, listed with its reason");
  assert(o.counts.byRule.R5 === 1 && real.find((v) => v.rule === "R5").file === "ui/hud/health_bar.gd", "R5: presentation emitting a gameplay signal is a violation");
  assert(o.counts.byRule.R6 === 3, `R6: untyped params, missing return, missing docstring are three findings (${o.counts.byRule.R6})`);
  assert(o.counts.violations === 6, `six real violations in total (${o.counts.violations})`);
  const und = o.undeclared.map((u) => `${u.src} ${u.how} ${u.dst}`).sort();
  assert(und.join(" · ") === "health_bar emits sig_actor_healed · items references effect_defs_content · needs calls damage_model", `observed-but-undeclared dependencies are exactly the three planted ones (${und.join(" · ")})`);
  assert(o.undeclared.every((u) => u.suggest.startsWith("scripts/systems-map.sh add-edge --from")), "each undeclared dependency comes with an add-edge suggestion");
  const declared = o.edges.filter((x) => x.declared).map((x) => `${x.src}→${x.dst}`).sort();
  assert(declared.join() === "effect_defs_content→schema_status_effect_def,items→schema_item_def", `declared dependencies are recognized as declared (${declared.join()})`);
  assert(o.unobserved.length === 1 && o.unobserved[0].signal === "actor_healed" && o.unobserved[0].from === "needs", "declared signal wiring with code but no connect is reported as not yet observed");
  assert(o.signals.onlyInCode.join() === "debug_ping" && o.signals.onlyInSpec.join() === "spell_cast" && o.signals.onlyInRegistry.length === 0, "signals are compared three ways: code, registry, spec §5");
  assert(o.strictFail === true, "--strict would fail on this fixture");
  const md = renderObserve(o);
  assert(md.includes("## Rule violations (6)") && md.includes("**R2**") && md.includes("Allowed exceptions (1)") && md.includes("add-edge --from needs --how calls --to damage_model"), "the report lists violations, allowed exceptions and the suggested commands");
  // a clean subset: only the damage model (typed, documented, seeded RNG, declared emit)
  const clean = { godotRoot: FIXTURE, files: scan.files.filter((f) => f.rel === "core/combat/damage.gd"), others: [] };
  const oc = observe(graph, clean, extractAll(clean));
  assert(oc.counts.violations === 0 && oc.undeclared.length === 0 && oc.strictFail === false, "clean code against a matching ledger produces no findings");
  const withBus = { godotRoot: FIXTURE, files: scan.files.filter((f) => f.rel === "core/events/event_bus.gd" || f.rel === "core/combat/damage.gd"), others: [] };
  const ob = observe(graph, withBus, extractAll(withBus));
  assert(ob.counts.violations === 0 && ob.strictFail === true && ob.signals.onlyInCode.join() === "debug_ping", "a signal declared only in code is a strict failure even when the code is otherwise clean (R-EB1)");
  // R3 on a synthetic file list
  const bin = observe(graph, { godotRoot: FIXTURE, files: [], others: [{ rel: "data/items/bad.png", ext: ".png" }, { rel: "art/icons/ok.png", ext: ".png" }, { rel: "audio/x.ogg", ext: ".ogg" }] }, []);
  assert(bin.counts.byRule.R3 === 1 && bin.violations[0].file === "data/items/bad.png", "R3: a binary outside art/ and audio/ is a violation; art and audio binaries are fine");
  assert(Object.keys(RULES).join() === "R2,R3,R4,R5,R6", "the five checked rules are pinned");
}

// ─── project roots ──────────────────────────────────────────────────────────
console.log("\nproject roots");
{
  assert(hasGameCode(FIXTURE) === true, "the fixture counts as game code");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "observe-root-"));
  assert(hasGameCode(tmp) === false && godotRoot(tmp) === tmp, "an empty project has no game code and its root is the repo root");
  await fs.mkdir(path.join(tmp, "game", "core"), { recursive: true });
  await fs.writeFile(path.join(tmp, "game", "project.godot"), "[application]\n", "utf8");
  assert(godotRoot(tmp) === path.join(tmp, "game") && hasGameCode(tmp) === true, "a game/project.godot moves the Godot root under game/");
  const o = await observeProject(tmp, build());
  assert(o.counts.files === 0 && renderObserve(o).includes("No game code yet"), "an empty Godot root reports nothing to compare");
  await fs.rm(tmp, { recursive: true, force: true });
}

// ─── CODEOWNERS ─────────────────────────────────────────────────────────────
console.log("\nCODEOWNERS");
{
  const graph = build();
  const text = renderCodeowners(graph, { _default: ["@org/all"], orchestrator: "@org/orch", "content-smith": ["@org/content", "@nick"] });
  const lines = text.split("\n").filter((l) => l && !l.startsWith("#"));
  assert(lines[0] === "* @org/all", "the default owner comes first");
  const iCore = lines.findIndex((l) => l.startsWith("/core/ ")), iDmg = lines.findIndex((l) => l.startsWith("/core/combat/damage.gd "));
  assert(iCore > 0 && iDmg > iCore, "broad directories precede specific files (GitHub applies the last match)");
  assert(lines.some((l) => l === "/data/items/ @org/content @nick"), "a role mapped to several handles lists them all");
  assert(!text.includes("sig_actor_damaged") && lines.some((l) => l.startsWith("/core/events/event_bus.gd @org/orch")), "signals contribute no lines; the bus file is owned once");
  assert(text.includes("# items") && text.includes("Do not edit"), "each line is preceded by the owning system ids and the header says the file is generated");
  const t2 = renderCodeowners(graph, { _default: ["@org/all"], orchestrator: "@org/orch", "content-smith": ["@org/content", "@nick"] });
  assert(t2 === text, "CODEOWNERS renders deterministically");
}

// ─── live project ───────────────────────────────────────────────────────────
console.log("\nlive project");
{
  if (!existsSync(path.join(PROJECT_ROOT, "systems", "registry"))) {
    assert(true, "no live registry (skipped)");
  } else {
    const live = await loadAll({ root: PROJECT_ROOT });
    const o = await observeProject(PROJECT_ROOT, live.graph);
    assert(hasGameCode(PROJECT_ROOT) === o.counts.files > 0 || o.counts.files === 0, "observe runs on the live project (Phase 0: no game code yet, so nothing to compare)");
    assert(live.codeowners && live.codeowners.orchestrator, "the role → owner mapping is present");
    const rendered = renderCodeowners(live.graph, live.codeowners);
    const onDisk = existsSync(path.join(PROJECT_ROOT, CODEOWNERS_FILE)) ? await fs.readFile(path.join(PROJECT_ROOT, CODEOWNERS_FILE), "utf8") : "";
    assert(onDisk === rendered, ".github/CODEOWNERS on disk matches the registry (run render if not)");
    assert(rendered.split("\n").filter((l) => l && !l.startsWith("#")).length > 200, "the live CODEOWNERS routes several hundred paths");
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
