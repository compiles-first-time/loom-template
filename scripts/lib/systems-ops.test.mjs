#!/usr/bin/env node
// Unit tests for the agent-facing atlas layer (ADR-0066): path → system
// resolution, change runbooks (parse, validate, coverage), the checklist, the
// diff audit, the registry mutation commands, the edit guard, the LLM pack,
// and the PreToolUse hook end to end.

import path from "node:path";
import os from "node:os";
import { promises as fs, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  parseRegistryText, buildGraph, validate, whichSystems, loadAll, renderAll, renderLlmPack, staleGenerated, LLM_DIR, affects,
} from "./systems-map.mjs";
import { parseRunbookText, validateRunbooks, coverageTargets, runbooksFor, renderRunbook, runbookRecord, ACTIONS } from "./systems-runbooks.mjs";
import { checklistData, renderChecklist, auditDiff, renderAudit, addNode, addEdge, setNode, removeNode, removeEdge, parseAssignments, cell, WRITE_SCOPES, GATES } from "./systems-ops.mjs";
import { editContextFor, isGeneratedAtlasPath, toRepoRelative, editedPath } from "./systems-guard.mjs";
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

const NODES = [
  n("foundation", "Foundation", 1, "—", 0, "spec", "orchestrator", "core/,tools/,project.godot", "§4", "the base", "electrical panel"),
  n("event_bus", "EventBus", 2, "foundation", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "the bus", "group chat"),
  n("sig_actor_died", "actor_died", 3, "event_bus", 0, "spec", "orchestrator", "core/events/event_bus.gd", "§5", "actor_id, killer_id"),
  n("sig_level_up", "level_up (proposed)", 3, "event_bus", 2, "candidate", "orchestrator", "core/events/event_bus.gd", "—", "actor_id, level"),
  n("combat", "Combat", 1, "—", 1, "spec", "orchestrator", "core/combat/; core/combat/damage.gd", "§5", "fighting", "referee"),
  n("damage_model", "Damage model", 2, "combat", 1, "spec", "orchestrator", "core/combat/damage.gd", "§5", "hits to numbers", "scoring table"),
  n("death_resolution", "Death resolution", 3, "damage_model", 1, "spec", "orchestrator", "core/combat/death.gd", "§5", "zero health is death"),
  n("economy", "Economy", 1, "—", 2, "spec", "content-smith", "data/", "§6", "items and loot", "supply chain"),
  n("loot", "Loot", 2, "economy", 2, "spec", "content-smith", "core/loot/; data/loot_tables/", "§6.6", "drops", "raffle drum"),
  n("loot_rolls", "Loot rolls", 3, "loot", 2, "implied", "orchestrator", "core/loot/roll.gd", "§6.6", "rolls on death"),
  n("talents", "Talents", 2, "combat", "—", "candidate", "director", "data/talents/", "—", "trees", "sticker poster"),
  n("survival", "Survival", 1, "—", 3, "spec", "orchestrator", "core/survival/", "§3", "needs", "camping"),
  n("hunger", "Hunger", 2, "survival", 3, "spec", "orchestrator", "core/survival/needs.gd", "§3", "drains", "fuel gauge"),
];
const EDGES = [
  e("death_resolution", "emits", "sig_actor_died", "—", "hard", "death is announced"),
  e("loot_rolls", "listens", "sig_actor_died", "—", "hard", "loot rolls on death"),
  e("loot_rolls", "reads", "damage_model", "killer id", "soft", "credit the killer"),
  e("hunger", "reads", "damage_model", "damage taken", "hard", "being hit drains stamina"),
  e("hunger", "listens", "sig_level_up", "—", "hard", "a proposed listener"),
  e("talents", "reads", "damage_model", "modifiers", "hard", "talents modify damage"),
];
const REG_TEXT = `# Test\n\n## Nodes\n\n${NODE_HEADER}\n${NODES.join("\n")}\n\n## Edges\n\n${EDGE_HEADER}\n${EDGES.join("\n")}\n`;
function build(text = REG_TEXT, file = "t.md") {
  const r = parseRegistryText(text, file);
  const registry = { ...r, files: [file], sources: [{ file, text }] };
  const graph = buildGraph(registry);
  return { registry, graph };
}

const RB = (id, title, primary, steps, extra = "") => `# ${id} — ${title}

## Runbook

| Field | Value |
|---|---|
| Trigger | when needed |
| Primary | ${primary} |
| Roles | orchestrator |
| Director | none |
| Spec | §5 |
${extra}
## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
${steps.map((s, i) => `| ${i + 1} | ${s.join(" | ")} |`).join("\n")}
`;

// ─── Where separators + path resolution ─────────────────────────────────────
console.log("\nwhich: Where separators and path → system");
{
  const { graph } = build();
  assert(graph.nodes.get("foundation").where.length === 3, "commas and semicolons both separate Where paths");
  assert(graph.nodes.get("loot").where.length === 2, "semicolon-separated Where keeps two paths");
  const r1 = whichSystems(graph, "core/combat/damage.gd");
  assert(r1.primary.length === 1 && r1.primary[0].id === "damage_model", "an exact file path resolves to the system dedicated to it, not to a broader node that also lists it");
  assert(r1.all.some((m) => m.id === "combat") && r1.all.some((m) => m.id === "foundation"), "broader owners are listed after the specific one");
  const r2 = whichSystems(graph, "core/loot/roll.gd");
  assert(r2.primary[0].id === "loot_rolls", "a tier-3 part that owns the exact file is primary when no tier-2 node ties it");
  const r3 = whichSystems(graph, "data/loot_tables/loot_wolf.tres");
  assert(r3.primary[0].id === "loot", "a directory Where matches files beneath it");
  const r4 = whichSystems(graph, "data/items/item_x.tres");
  assert(r4.primary[0].id === "economy", "when only a domain owns the path, the domain is primary");
  assert(whichSystems(graph, "README.md").primary.length === 0, "an unowned path resolves to nothing");
  const r5 = whichSystems(graph, "/repo/core/combat/death.gd", { root: "/repo" });
  assert(r5.primary[0].id === "death_resolution", "absolute paths are relativized against the root");
  assert(whichSystems(graph, "res://core/survival/needs.gd").primary[0].id === "hunger", "res:// prefixes are stripped");
}

// ─── runbooks: parse, validate, coverage ────────────────────────────────────
console.log("\nrunbooks");
{
  const { graph } = build();
  const good = parseRunbookText(RB("rb_change_damage", "Change the damage model", "damage_model", [
    ["check", "damage_model", "core/combat/damage.gd", "formula reviewed", "—"],
    ["update", "hunger", "core/survival/needs.gd", "drain matches", "—"],
    ["run", "combat", "—", "tests pass", "—"],
    ["decide", "—", "—", "DIRECTOR approves", "talents are candidates"],
  ], "| Not touched | talents: candidate, unbuilt |"), "change_damage.md");
  assert(good.id === "rb_change_damage" && good.name === "Change the damage model", "title yields id and name");
  assert(good.meta.primary === "damage_model" && good.meta.roles.join() === "orchestrator" && good.steps.length === 4, "meta and steps parse");
  assert(good.meta.notTouched.length === 1 && good.meta.notTouched[0].system === "talents" && good.meta.notTouched[0].reason.startsWith("candidate"), "Not touched parses system: reason");
  const v = validateRunbooks([good], graph);
  assert(v.errors.length === 0, `a complete runbook has no errors (${v.errors.join(" · ")})`);
  assert(!v.warnings.some((w) => w.includes("never mentions")), `every hard downstream of damage_model is covered (${v.warnings.join(" · ")})`);
  const targets = coverageTargets(graph, "damage_model").map((h) => h.id).sort();
  assert(targets.join() === "hunger,talents", `coverage targets are the direct hard downstream, own parts and signals excluded (${targets.join()})`);

  const gap = parseRunbookText(RB("rb_gap", "Gap", "damage_model", [["check", "damage_model", "core/combat/damage.gd", "ok", "—"]]), "gap.md");
  const vg = validateRunbooks([gap], graph);
  assert(vg.warnings.filter((w) => w.includes("never mentions")).length === 2 && vg.warnings.some((w) => w.includes("hunger")), "an uncovered hard downstream is a named warning");

  const bad = parseRunbookText(RB("rb_bad", "Bad", "nope", [
    ["create", "damage_model", "—", "—", "—"],
    ["frobnicate", "ghost", "x", "—", "—"],
    ["update", "—", "x", "—", "—"],
  ], "| Not touched | ghost2 |"), "bad.md");
  const vb = validateRunbooks([bad], graph);
  assert(vb.errors.some((x) => x.includes('Primary "nope"')), "unknown primary is an error");
  assert(vb.errors.some((x) => x.includes("create needs an Artifact")), "create without an artifact is an error");
  assert(vb.errors.some((x) => x.includes('Action "frobnicate"')), "unknown action is an error");
  assert(vb.errors.some((x) => x.includes('System "ghost"')), "unknown step system is an error");
  assert(vb.errors.some((x) => x.includes("needs a System")), "a non-decide step without a system is an error");
  assert(vb.errors.some((x) => x.includes("ghost2")), "an unknown Not-touched system is an error");
  const noTitle = parseRunbookText("# Add things\n\n## Runbook\n| Field | Value |\n|---|---|\n| Primary | combat |\n\n## Steps\n| # | Action | System | Artifact | Verify | Note |\n|---|---|---|---|---|---|\n| 1 | check | combat | x | y | — |\n", "nt.md");
  assert(noTitle.problems.some((p) => p.includes("rb_<name>")), "a title without an rb_ id is a problem");
  const dup = validateRunbooks([good, good], graph);
  assert(dup.errors.some((x) => x.includes("duplicate runbook id")), "duplicate runbook ids are errors");
  assert(ACTIONS.includes("decide") && ACTIONS.length === 6, "the action vocabulary is pinned");

  const f = runbooksFor([good, gap], graph, "death_resolution");
  assert(f.primary.length === 0 && f.related.length === 2, "a part inherits its parent's runbooks as related");
  const f2 = runbooksFor([good], graph, "hunger");
  assert(f2.related.length === 0 && f2.stepThrough.length === 1, "a runbook that merely steps through a system is reported separately from related ones");
  const md = renderRunbook(good, graph);
  assert(md.includes("**Coverage:** all 2") && md.includes("| 2 | update | `hunger`"), "rendered runbook shows coverage and steps");
  const rec = runbookRecord(good);
  assert(rec.steps.length === 4 && rec.steps[3].system === null && rec.file === "systems/runbooks/change_damage.md", "runbook record is plain JSON");
}

// ─── checklist ──────────────────────────────────────────────────────────────
console.log("\nchecklist");
{
  const { graph } = build();
  const rb = parseRunbookText(RB("rb_change_damage", "Change the damage model", "damage_model", [["check", "damage_model", "x", "y", "—"]]), "cd.md");
  const d = checklistData(graph, "damage_model", [rb]);
  assert(d.hard.map((r) => r.id).join() === "hunger,talents" && d.soft.map((r) => r.id).join() === "loot_rolls", "hard and soft direct downstream are split and sorted");
  assert(d.emits.join() === "actor_died", "signals the system (or its parts) emit are listed");
  assert(d.candidates.includes("talents"), "candidates in the blast radius are called out");
  assert(d.runbooks.primary[0].id === "rb_change_damage", "the primary runbook is attached");
  assert(d.phase === 1 && d.gates.map((g) => g.id).join() === "G0,G1,G2,G3,G4,G5", "gates follow the phase");
  assert(d.writeScopes.orchestrator === WRITE_SCOPES.orchestrator, "write scopes come from spec §7.1");
  const md = renderChecklist(d);
  assert(md.includes("## 2. MUST check — direct hard downstream (2)") && md.includes("`hunger`") && md.includes("## 8. Verify (phase 1)"), "checklist markdown has the must-check table and the verify section");
  const cand = renderChecklist(checklistData(graph, "talents", []));
  assert(cand.includes("STOP — candidate system"), "a candidate system's checklist opens with a stop");
  const h = checklistData(graph, "hunger", []);
  assert(h.listens.join() === "level_up" && h.upstream.some((u) => u.id === "damage_model"), "listens and upstream are reported");
  assert(GATES.length === 6, "six gates are pinned");
}

// ─── audit-diff ─────────────────────────────────────────────────────────────
console.log("\naudit-diff");
{
  const { graph } = build();
  const a = auditDiff(graph, [], ["core/combat/damage.gd", "README.md"]);
  assert(a.systems.length === 1 && a.systems[0].id === "damage_model", "changed files map to their primary system");
  assert(a.systems[0].untouched.map((u) => u.id).join() === "hunger,talents" && a.gaps === 2, "hard downstream with no touched file are gaps");
  assert(a.unmapped.join() === "README.md", "unowned files are reported, not guessed");
  const b = auditDiff(graph, [], ["core/combat/damage.gd", "core/survival/needs.gd", "data/talents/tree.tres"]);
  assert(b.gaps === 0 && b.systems.length === 3 && b.candidates.includes("talents"), "touching the downstream closes the gap; a touched candidate is flagged");
  const md = renderAudit(a);
  assert(md.includes("hard downstream NOT touched (2)") && md.includes("`hunger`"), "audit markdown lists the gaps");
  const c = auditDiff(graph, [], ["systems/ATLAS.md", "GAME_INFRA_SPEC.md", "systems/registry/00-foundation.md"]);
  assert(c.generatedTouched && c.specTouched && c.registryTouched, "spec, registry and generated-file edits are flagged");
}

// ─── mutations on a temporary registry ──────────────────────────────────────
console.log("\nmutations");
{
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "systems-ops-"));
  const regDir = path.join(tmp, "systems", "registry");
  await fs.mkdir(regDir, { recursive: true });
  await fs.writeFile(path.join(regDir, "t.md"), REG_TEXT, "utf8");
  const load = async () => (await loadAll({ root: tmp })).graph;
  let g = await load();
  const r1 = await addNode(tmp, g, { id: "crit_tables", name: "Crit tables", parent: "damage_model", phase: "1", status: "implied", owner: "orchestrator", where: "core/combat/crit.gd", spec: "§5", summary: "crit chance and multiplier" });
  assert(r1.ok && r1.file === "t.md", `add-node writes to the parent's domain file (${JSON.stringify(r1.errors || [])})`);
  g = await load();
  const cn = g.nodes.get("crit_tables");
  assert(cn && cn.tier === 3 && cn.parent === "damage_model" && cn.where[0] === "core/combat/crit.gd", "the new node is parsed back with the inferred tier");
  const r2 = await addEdge(tmp, g, { from: "crit_tables", how: "reads", to: "damage_model", via: "base damage", strength: "hard", why: "crits multiply the base hit" });
  assert(r2.ok, "add-edge writes a valid edge");
  g = await load();
  assert((g.in.get("crit_tables") || []).length === 1, "the new edge is parsed back (damage_model → crit_tables)");
  const r3 = await addEdge(tmp, g, { from: "crit_tables", how: "listens", to: "sig_actor_died", why: "signal wiring goes to the bus file" });
  assert(r3.ok && r3.file === "t.md", "signal edges land in the event_bus file");
  const r4 = await setNode(tmp, g, "crit_tables", parseAssignments(["where=core/combat/crit_tables.gd", "summary=crit chance, multiplier and the roll"]));
  assert(r4.ok, "set-node rewrites cells");
  g = await load();
  assert(g.nodes.get("crit_tables").where[0] === "core/combat/crit_tables.gd" && g.nodes.get("crit_tables").summary.includes("the roll"), "set-node changes are parsed back");
  let threw = "";
  try { await setNode(tmp, g, "crit_tables", { id: "other" }); } catch (err) { threw = err.message; }
  assert(threw.includes("immutable"), "ids cannot be changed (R7)");
  threw = "";
  try { await removeNode(tmp, g, "crit_tables"); } catch (err) { threw = err.message; }
  assert(threw.includes("still wired"), "remove-node refuses while edges reference the node");
  const r5 = await removeEdge(tmp, g, { from: "crit_tables", how: "reads", to: "damage_model" });
  const r6 = await removeEdge(tmp, (await load()), { from: "crit_tables", how: "listens", to: "sig_actor_died" });
  assert(r5.ok && r6.ok, "remove-edge deletes the rows");
  g = await load();
  const r7 = await removeNode(tmp, g, "crit_tables");
  assert(r7.ok, "remove-node deletes an unwired row");
  g = await load();
  assert(!g.nodes.has("crit_tables") && (await fs.readFile(path.join(regDir, "t.md"), "utf8")) === REG_TEXT, "the registry text round-trips exactly after add + remove");
  // a mutation that would leave the ledger invalid is reverted
  const bad = await addNode(tmp, g, { id: "ghost_part", name: "Ghost", parent: "damage_model", status: "spec", owner: "orchestrator", summary: "spec without a phase" });
  assert(!bad.ok && bad.reverted && bad.errors.some((x) => x.includes("has no Phase")), "an invalid row is reverted with the validator's reason");
  assert((await fs.readFile(path.join(regDir, "t.md"), "utf8")) === REG_TEXT, "the file is untouched after the revert");
  const dry = await addNode(tmp, g, { id: "dry_part", name: "Dry", parent: "loot", phase: "2", status: "implied", owner: "orchestrator", summary: "dry run" }, { dryRun: true });
  assert(dry.dryRun && dry.diff.some((l) => l.startsWith("+ | dry_part")) && (await fs.readFile(path.join(regDir, "t.md"), "utf8")) === REG_TEXT, "dry-run shows the row and writes nothing");
  threw = "";
  try { await addNode(tmp, g, { id: "Bad Id", name: "x", parent: "loot", status: "implied", owner: "orchestrator", summary: "s" }); } catch (err) { threw = err.message; }
  assert(threw.includes("snake_case"), "ids must be snake_case");
  threw = "";
  try { await addEdge(tmp, g, { from: "hunger", how: "reads", to: "damage_model", via: "damage taken", why: "dup" }); } catch (err) { threw = err.message; }
  assert(threw.includes("already exists"), "duplicate edges are refused before writing");
  assert(cell("a|b\nc") === "a\\|b c" && cell("") === "—", "cells escape pipes and newlines and never go empty");
  await fs.rm(tmp, { recursive: true, force: true });
}

// ─── guard ──────────────────────────────────────────────────────────────────
console.log("\nedit guard");
{
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "systems-guard-"));
  const regDir = path.join(tmp, "systems", "registry");
  await fs.mkdir(regDir, { recursive: true });
  await fs.writeFile(path.join(regDir, "t.md"), REG_TEXT, "utf8");
  const sid = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  assert(isGeneratedAtlasPath("systems/ATLAS.md") && isGeneratedAtlasPath(`${LLM_DIR}/nodes.jsonl`) && !isGeneratedAtlasPath("systems/registry/x.md"), "generated paths are recognized");
  assert(toRepoRelative(path.join(tmp, "core", "x.gd"), tmp) === "core/x.gd" && toRepoRelative("/elsewhere/x.gd", tmp) === null, "paths relativize against the root and outside paths are rejected");
  assert(editedPath("Edit", { file_path: "a" }) === "a" && editedPath("Bash", { command: "x" }) === null, "only edit tools carry an edited path");
  const deny = await editContextFor({ tool: "Write", input: { file_path: path.join(tmp, "systems", "ATLAS.md") }, root: tmp, sessionId: sid });
  assert(deny && deny.decision === "deny" && deny.reason.includes("render"), "editing a generated atlas file is denied with the fix");
  const reg = await editContextFor({ tool: "Edit", input: { file_path: path.join(tmp, "systems", "registry", "t.md") }, root: tmp, sessionId: sid });
  assert(reg && reg.decision === "context" && reg.context.includes("add-node"), "editing the registry reminds about the mutation commands and render");
  const c1 = await editContextFor({ tool: "Edit", input: { file_path: path.join(tmp, "core", "combat", "damage.gd") }, root: tmp, sessionId: sid });
  assert(c1 && c1.systems.join() === "damage_model" && c1.context.includes("`hunger`") && c1.context.includes("checklist damage_model"), "editing a system's file announces the system, its hard downstream and the checklist command");
  const c2 = await editContextFor({ tool: "Edit", input: { file_path: path.join(tmp, "core", "combat", "damage.gd") }, root: tmp, sessionId: sid });
  assert(c2 && c2.context === null && c2.systems.join() === "damage_model", "a repeat edit in the same system is quiet");
  const cand = await editContextFor({ tool: "Write", input: { file_path: path.join(tmp, "data", "talents", "t.tres") }, root: tmp, sessionId: sid });
  assert(cand && cand.context.includes("STOP"), "editing a candidate system's path says stop");
  assert((await editContextFor({ tool: "Bash", input: { command: "ls" }, root: tmp, sessionId: sid })) === null, "non-edit tools return nothing");
  assert((await editContextFor({ tool: "Edit", input: { file_path: "/nowhere/x" }, root: tmp, sessionId: sid })) === null, "paths outside the project return nothing");
  assert((await editContextFor({ tool: "Edit", input: { file_path: path.join(tmp, "README.md") }, root: tmp, sessionId: sid })) === null, "unowned paths return nothing");
  await fs.rm(tmp, { recursive: true, force: true });
}

// ─── LLM pack ───────────────────────────────────────────────────────────────
console.log("\nLLM pack");
{
  const { registry, graph } = build();
  const v = validate(registry, graph);
  const rb = parseRunbookText(RB("rb_change_damage", "Change the damage model", "damage_model", [["check", "damage_model", "x", "y", "—"]]), "cd.md");
  const pack = renderLlmPack(graph, v, { hash: "abc", runbooks: [rb] });
  assert(pack.size === 5 && [...pack.keys()].every((k) => k.startsWith(`${LLM_DIR}/`)), "the pack has five files under systems/llm");
  const nodes = pack.get(`${LLM_DIR}/nodes.jsonl`).trim().split("\n").map((l) => JSON.parse(l));
  assert(nodes.length === graph.nodes.size && nodes.every((x) => x.id && x.domain), "nodes.jsonl has one parseable record per node");
  const dm = nodes.find((x) => x.id === "damage_model");
  assert(dm.blast_hard === affects(graph, "damage_model").hits.filter((h) => h.edge.strength === "hard").length && dm.runbooks[0] === "rb_change_damage" && dm.children[0] === "death_resolution", "records carry precomputed reach, runbooks and parts");
  const dr = nodes.find((x) => x.id === "death_resolution");
  assert(dr.emits[0] === "actor_died" && !("analogy" in dr), "emits are listed and empty fields are omitted");
  const edges = pack.get(`${LLM_DIR}/edges.jsonl`).trim().split("\n").map((l) => JSON.parse(l));
  assert(edges.length === graph.influence.length && edges.find((x) => x.from === "hunger" && x.to === "damage_model").src === "damage_model", "edges.jsonl keeps both the written and the influence direction");
  const rbs = pack.get(`${LLM_DIR}/runbooks.jsonl`).trim().split("\n").map((l) => JSON.parse(l));
  assert(rbs.length === 1 && rbs[0].primary === "damage_model", "runbooks.jsonl carries the runbooks");
  const summary = JSON.parse(pack.get(`${LLM_DIR}/summary.json`));
  assert(summary.registry_hash === "abc" && summary.counts.nodes === graph.nodes.size && summary.signals.length === 2 && summary.candidates_by_domain.combat.includes("talents"), "summary.json has counts, signals and candidates by domain");
  const readme = pack.get(`${LLM_DIR}/README.md`);
  assert(readme.includes("which <path>") && readme.includes("candidate") && readme.includes("rb_change_damage") && readme.includes("Do not"), "the README teaches the query commands, the stop rule and the runbooks");
  const pack2 = renderLlmPack(graph, v, { hash: "abc", runbooks: [rb] });
  assert([...pack.keys()].every((k) => pack.get(k) === pack2.get(k)), "the pack renders deterministically");
}

// ─── the hook, end to end ───────────────────────────────────────────────────
console.log("\nPreToolUse hook (end to end)");
{
  const hook = path.join(PROJECT_ROOT, "scripts", "hooks", "pre-tool-use.mjs");
  const run = (toolName, toolInput) => spawnSync(process.execPath, [hook], {
    cwd: PROJECT_ROOT, encoding: "utf8", input: JSON.stringify({ session_id: `test-hook-${Date.now()}`, tool_name: toolName, tool_input: toolInput }),
    env: { ...process.env, CLAUDE_SESSION_ID: `test-hook-${Date.now()}` },
  });
  const r1 = run("Write", { file_path: path.join(PROJECT_ROOT, "systems", "ATLAS.md"), content: "x" });
  const out1 = r1.stdout.trim() ? JSON.parse(r1.stdout.trim().split("\n").pop()) : null;
  assert(r1.status === 0 && out1 && out1.hookSpecificOutput.permissionDecision === "deny", `the hook denies a hand edit of a generated atlas file (${r1.stderr.slice(0, 120)})`);
  const r2 = run("Edit", { file_path: path.join(PROJECT_ROOT, "systems", "registry", "00-foundation.md"), old_string: "a", new_string: "b" });
  const out2 = r2.stdout.trim() ? JSON.parse(r2.stdout.trim().split("\n").pop()) : null;
  assert(r2.status === 0 && out2 && String(out2.hookSpecificOutput.additionalContext).includes("add-node"), "the hook adds registry context on a registry edit");
  const r3 = run("Read", { file_path: path.join(PROJECT_ROOT, "README.md") });
  assert(r3.status === 0 && r3.stdout.trim() === "", "a read produces no hook output");
}

// ─── the live registry + runbooks ───────────────────────────────────────────
console.log("\nlive registry + runbooks");
{
  if (!existsSync(path.join(PROJECT_ROOT, "systems", "registry"))) {
    assert(true, "no live registry (skipped)");
  } else {
    const live = await loadAll({ root: PROJECT_ROOT });
    assert(live.runbooks.length >= 10, `the project ships change runbooks (${live.runbooks.length})`);
    assert(live.validation.errors.length === 0, `registry + runbooks validate with zero errors (${live.validation.errors.slice(0, 3).join(" · ")})`);
    assert(!live.validation.warnings.some((w) => w.includes("never mentions")), `every runbook covers its primary's hard downstream (${live.validation.warnings.filter((w) => w.includes("never mentions")).slice(0, 2).join(" · ") || "all covered"})`);
    const files = renderAll(live.graph, live.validation, { hash: live.hash, runbooks: live.runbooks });
    const stale = await staleGenerated(files, PROJECT_ROOT);
    assert(stale.length === 0, `systems/llm is current on disk (${stale.join(", ") || "current"})`);
    const items = whichSystems(live.graph, "data/items/item_iron_ore.tres");
    assert(items.primary[0]?.id === "items", `a new item file resolves to the items system (${items.primary.map((p) => p.id).join(",")})`);
    const cl = checklistData(live.graph, "items", live.runbooks);
    assert(cl.runbooks.primary.some((r) => r.id === "rb_add_item") && cl.hard.length >= 15, `the items checklist attaches rb_add_item and lists its hard downstream (${cl.hard.length})`);
    const noWhere = [...live.graph.nodes.values()].filter((x) => x.kind !== "signal" && x.status !== "non-goal" && x.where.length === 0);
    assert(noWhere.length === 0, `every in-scope system has a Where (${noWhere.slice(0, 5).map((x) => x.id).join(", ") || "none missing"})`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
