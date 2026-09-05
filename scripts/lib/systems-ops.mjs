#!/usr/bin/env node
// Agent-facing operations on the EMBER systems atlas (ADR-0066).
//
//   checklist   — the actionable form of an impact report: what to touch, what
//                 to check, what to run, in order, for a given system.
//   auditDiff   — given the files a change touches, which systems they belong
//                 to and which hard-downstream systems were NOT touched.
//   mutations   — add-node / add-edge / set-node / remove-node / remove-edge
//                 that write the registry tables for you (escaping, column
//                 order, the right file) and refuse to leave the ledger invalid.
//
// Everything here works on the parsed graph plus the registry's source text;
// nothing here renders (that is `render`, which the doctor keeps honest).

import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  affects, affectedBy, findTable, whichSystems, subtreeIds, loadAll,
  NODE_COLUMNS, EDGE_COLUMNS, SIGNAL_PREFIX, HOW_NAMES, STATUSES, OWNERS, STRENGTHS, DEFAULT_REGISTRY_DIR,
} from "./systems-map.mjs";
import { runbooksFor } from "./systems-runbooks.mjs";

// ── Reference tables (spec §7.1, §8) ────────────────────────────────────────

export const WRITE_SCOPES = Object.freeze({
  orchestrator: "anywhere, via PR — never secrets, force-push, or the engine version",
  "content-smith": "data/**, art/icons/**, docs/changelog.md — never core/**, scenes/**",
  "world-builder": "scenes/**, art/**, data/biomes/** — never core/** logic",
  "quest-writer": "data/quests/**, data/dialogue/**, docs/lore/** — never core/**, combat data",
  "test-pilot": "tests/**, tools/testing/**, .github/workflows/** — never game code (suggest fixes)",
  director: "decides; does not write code",
});

export const GATES = Object.freeze([
  { id: "G0", from: 0, what: "style + parse", cmd: "gdformat --check . && gdlint ." },
  { id: "G1", from: 0, what: "unit tests (seeded RNG)", cmd: "godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/unit -gexit" },
  { id: "G2", from: 0, what: "data integrity: unique ids, references resolve, icon/model paths exist, enums legal, numbers in docs/balance_ranges.md", cmd: "godot --headless -s tools/validate_data.gd" },
  { id: "G3", from: 0, what: "smoke: main scene boots headless 30 s, zero ERROR lines", cmd: "godot --headless res://scenes/main.tscn" },
  { id: "G4", from: 1, what: "bot playtest: walk, gather, craft, fight; assert outcomes", cmd: "tools/testing/ (scripted inputs)" },
  { id: "G5", from: 1, what: "vision review of the standard screenshot set against docs/art_bible.md (advisory)", cmd: "tools/testing/screenshots" },
]);

const isSignal = (id) => String(id).startsWith(SIGNAL_PREFIX);
const badge = (n) => `[P${n.phase ?? "—"}][${n.status}][${n.owner.join("/")}]`;
const pathOf = (graph, id) => {
  const n = graph.nodes.get(id);
  const chain = [...n.ancestors].reverse().map((a) => graph.nodes.get(a).name);
  return chain.length ? chain.join(" › ") : n.name;
};
const phaseNum = (n) => (n && n.phase != null && /^\d+$/.test(String(n.phase)) ? Number(n.phase) : null);

// ── Checklist ───────────────────────────────────────────────────────────────

/** Structured checklist data for one system. */
export function checklistData(graph, id, runbooks = [], opts = {}) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`unknown system id: ${id}`);
  const own = new Set(subtreeIds(graph, id));
  const d1 = affects(graph, id, { ...opts, depth: 1 });
  const direct = d1.hits.filter((h) => !own.has(h.id));
  const row = (h) => {
    const t = graph.nodes.get(h.id);
    return { id: h.id, name: t.name, path: pathOf(graph, h.id), where: t.where, how: h.edge.how, via: h.edge.via, strength: h.edge.strength, why: h.edge.why, owner: t.owner, status: t.status, phase: t.phase };
  };
  const hard = direct.filter((h) => h.edge.strength === "hard" && !isSignal(h.id)).map(row).sort((a, b) => a.id.localeCompare(b.id));
  const soft = direct.filter((h) => h.edge.strength === "soft" && !isSignal(h.id)).map(row).sort((a, b) => a.id.localeCompare(b.id));
  const emits = direct.filter((h) => isSignal(h.id)).map((h) => h.id.slice(SIGNAL_PREFIX.length)).sort();
  const all = affects(graph, id, opts);
  const deep = all.hits.filter((h) => h.depth >= 2 && h.edge.strength === "hard" && !isSignal(h.id) && !own.has(h.id));
  const ripple = new Map();
  for (const h of deep) {
    const dom = graph.nodes.get(h.id).domain;
    if (!ripple.has(dom)) ripple.set(dom, []);
    ripple.get(dom).push(h.id);
  }
  const rippleRows = [...ripple.entries()].map(([dom, ids]) => ({ domain: dom, name: graph.nodes.get(dom).name, count: ids.length, ids: [...new Set(ids)].sort() })).sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
  const u1 = affectedBy(graph, id, { ...opts, depth: 1 }).hits.filter((h) => !own.has(h.id));
  const listens = u1.filter((h) => isSignal(h.id)).map((h) => h.id.slice(SIGNAL_PREFIX.length)).sort();
  const upstream = u1.filter((h) => !isSignal(h.id)).map(row).sort((a, b) => (a.strength === b.strength ? a.id.localeCompare(b.id) : a.strength === "hard" ? -1 : 1));
  const candidates = [...new Set(all.hits.map((h) => h.id))].map((x) => graph.nodes.get(x)).filter((x) => x.status === "candidate").map((x) => x.id).sort();
  const phases = [phaseNum(n), ...subtreeIds(graph, id).map((x) => phaseNum(graph.nodes.get(x)))].filter((p) => p != null);
  const phase = phases.length ? Math.max(...phases) : null;
  const gates = GATES.filter((g) => phase == null || g.from <= phase);
  const rbs = runbooksFor(runbooks, graph, id);
  const owners = [...new Set([...n.owner, ...hard.flatMap((r) => r.owner)])];
  return {
    id, name: n.name, path: pathOf(graph, id), badge: badge(n), status: n.status, phase, where: n.where, spec: n.spec, analogy: n.analogy, summary: n.summary,
    owner: n.owner, owners, writeScopes: Object.fromEntries(owners.map((o) => [o, WRITE_SCOPES[o] || "—"])),
    parts: n.children,
    runbooks: { primary: rbs.primary.map((r) => ({ id: r.id, name: r.name })), related: rbs.related.map((r) => ({ id: r.id, name: r.name, primary: r.meta.primary })), stepThrough: rbs.stepThrough.map((r) => r.id) },
    hard, soft, emits, listens, upstream, ripple: rippleRows, rippleTotal: new Set(deep.map((h) => h.id)).size, candidates, gates,
  };
}

/** The checklist as markdown, written for an agent about to make the change. */
export function renderChecklist(data) {
  const L = [];
  const d = data;
  L.push(`# Change checklist — \`${d.id}\` (${d.path}) ${d.badge}`);
  L.push(`${d.summary}`);
  L.push(`Where: ${d.where.map((w) => `\`${w}\``).join(", ") || "—"} · Spec: ${d.spec || "—"}${d.analogy ? ` · *${d.analogy}*` : ""}`);
  L.push(``);
  L.push(`## 0. Before you start`);
  if (d.status === "candidate") L.push(`- **STOP — candidate system.** It is asked for but not in the spec. A DIRECTOR decision and a spec PR come first (§14). Do not build it.`);
  else if (d.status === "non-goal") L.push(`- **STOP — non-goal.** The spec rules this out. Any work here is a spec change (§14).`);
  else L.push(`- Status **${d.status}** — build within ${d.spec || "the spec"}; if the change needs a new signal, schema field or dependency, that is a spec PR first (§5, §6, R10).`);
  L.push(`- Owner: ${d.owner.join("/")} → may write: ${d.owner.map((o) => WRITE_SCOPES[o] || "—").join(" · ")}`);
  if (d.runbooks.primary.length) L.push(`- **Runbook(s) for this system:** ${d.runbooks.primary.map((r) => `\`${r.id}\` (${r.name})`).join(", ")} — read with \`scripts/systems-map.sh runbook <id>\` and follow it step by step.`);
  if (d.runbooks.related.length) L.push(`- Related runbooks (a parent's or a part's): ${d.runbooks.related.map((r) => `\`${r.id}\``).join(", ")}`);
  if (d.runbooks.stepThrough.length) L.push(`- ${d.runbooks.stepThrough.length} runbook(s) have a step in this system${d.runbooks.stepThrough.length <= 6 ? `: ${d.runbooks.stepThrough.map((r) => `\`${r}\``).join(", ")}` : ""} — a change here can change what they verify.`);
  if (!d.runbooks.primary.length && !d.runbooks.related.length) L.push(`- No runbook has this system as its primary. Use sections 2–8 as the procedure, and consider writing one in \`systems/runbooks/\`.`);
  if (d.parts.length) L.push(`- Parts of this system (each may be the one you actually mean): ${d.parts.map((p) => `\`${p}\``).join(", ")}`);
  L.push(``);
  L.push(`## 1. Artifacts of this system`);
  L.push(d.where.length ? d.where.map((w) => `- \`${w}\``).join("\n") : `- (no path recorded — add one with \`set-node ${d.id} where=<path>\`)`);
  L.push(``);
  L.push(`## 2. MUST check — direct hard downstream (${d.hard.length})`);
  L.push(`A change here can break each of these. Open each path; decide "needs an entry / needs an update / unaffected, because …" and say which in the PR.`);
  if (d.hard.length) {
    L.push(`| System | Where | How it depends | Why | Owner |`, `|---|---|---|---|---|`);
    for (const r of d.hard) L.push(`| \`${r.id}\` ${r.name} | ${r.where.map((w) => `\`${w}\``).join(", ") || "—"} | ${r.how}${r.via ? ` via ${r.via}` : ""} | ${r.why} | ${r.owner.join("/")} |`);
  } else L.push(`- none recorded — if you know one, add it: \`scripts/systems-map.sh add-edge --from <dependent> --how <how> --to ${d.id} --strength hard --why "..."\``);
  L.push(``);
  L.push(`## 3. SHOULD check — direct soft downstream (${d.soft.length})`);
  if (d.soft.length) {
    L.push(`| System | Where | How | Why |`, `|---|---|---|---|`);
    for (const r of d.soft) L.push(`| \`${r.id}\` ${r.name} | ${r.where.map((w) => `\`${w}\``).join(", ") || "—"} | ${r.how}${r.via ? ` via ${r.via}` : ""} | ${r.why} |`);
  } else L.push(`- none`);
  L.push(``);
  L.push(`## 4. Ripple — hard downstream at depth 2+ (${d.rippleTotal} systems)`);
  L.push(d.ripple.length ? d.ripple.map((r) => `- **${r.name}** (${r.count}): ${r.ids.slice(0, 12).map((x) => `\`${x}\``).join(", ")}${r.ids.length > 12 ? ` … +${r.ids.length - 12}` : ""}`).join("\n") : `- none`);
  L.push(``);
  L.push(`## 5. Upstream — what this system depends on (${d.upstream.length})`);
  L.push(`If your change needs one of these to change too, you are out of this checklist's scope: run \`checklist <that id>\` and treat it as a second change.`);
  L.push(d.upstream.length ? d.upstream.map((r) => `- \`${r.id}\` ${r.name} — ${r.how}${r.via ? ` via ${r.via}` : ""}, ${r.strength}: ${r.why}`).join("\n") : `- none`);
  L.push(``);
  L.push(`## 6. Signals (R-EB1)`);
  L.push(`- Emits: ${d.emits.map((s) => `\`${s}\``).join(", ") || "—"} · Listens: ${d.listens.map((s) => `\`${s}\``).join(", ") || "—"}`);
  if (d.emits.length || d.listens.length) L.push(`- Payload changes or new signals ⇒ edit spec §5 in the same PR and add/update the \`sig_*\` node (\`scripts/systems-map.sh validate\` cross-checks the two).`);
  L.push(``);
  L.push(`## 7. DIRECTOR gates`);
  L.push(d.candidates.length ? `- ${d.candidates.length} candidate system(s) in the blast radius — do not build or extend them without a decision: ${d.candidates.slice(0, 20).map((c) => `\`${c}\``).join(", ")}${d.candidates.length > 20 ? ` … +${d.candidates.length - 20}` : ""}` : `- no candidate systems in the blast radius`);
  L.push(``);
  L.push(`## 8. Verify (phase ${d.phase ?? "—"})`);
  for (const g of d.gates) L.push(`- **${g.id}** ${g.what} — \`${g.cmd}\``);
  L.push(`- Atlas: \`scripts/systems-map.sh validate && scripts/systems-map.sh render --check\``);
  L.push(`- Governance: \`bash scripts/doctor.sh\` · one line in \`docs/changelog.md\` · PR body carries the hard rows above`);
  L.push(``);
  L.push(`## 9. Registry upkeep`);
  L.push(`- Added a system? \`scripts/systems-map.sh add-node --id <id> --name "..." --parent ${d.id} --phase <n> --status <spec|implied|candidate> --owner <role> --where <path> --summary "..."\``);
  L.push(`- New dependency? \`scripts/systems-map.sh add-edge --from <dependent> --how <how> --to <dependency> --strength <hard|soft> --why "..."\``);
  L.push(`- Then \`scripts/systems-map.sh render\` (regenerates ATLAS.md, atlas/, explorer.html and systems/llm/).`);
  return L.join("\n");
}

// ── Diff audit ──────────────────────────────────────────────────────────────

/** Changed files from git: committed since base (if given), staged, unstaged and untracked. */
export function changedFiles(root, { base = null } = {}) {
  const run = (args) => {
    try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/).filter(Boolean); } catch { return []; }
  };
  const files = new Set();
  if (base) for (const f of run(["diff", "--name-only", `${base}...HEAD`])) files.add(f);
  for (const f of run(["diff", "--name-only", "HEAD"])) files.add(f);
  for (const f of run(["ls-files", "--others", "--exclude-standard"])) files.add(f);
  return [...files].sort();
}

/** Map changed files to systems and find hard-downstream systems nothing touched. Pure. */
export function auditDiff(graph, runbooks, files) {
  const touched = new Map(); // primary system id -> Set(files)
  const anyTouched = new Set(); // every system (any specificity) some file maps into
  const unmapped = [];
  for (const f of files) {
    const m = whichSystems(graph, f);
    if (!m.primary.length) { unmapped.push(f); continue; }
    for (const p of m.primary) { if (!touched.has(p.id)) touched.set(p.id, new Set()); touched.get(p.id).add(f); }
    for (const a of m.all) anyTouched.add(a.id);
  }
  const touchedIds = [...touched.keys()].sort();
  const systems = [];
  for (const id of touchedIds) {
    const n = graph.nodes.get(id);
    const own = new Set(subtreeIds(graph, id));
    const hard = affects(graph, id, { depth: 1 }).hits.filter((h) => h.edge.strength === "hard" && !isSignal(h.id) && !own.has(h.id));
    const untouched = [];
    const covered = [];
    for (const h of hard) {
      // A downstream system counts as touched only when a changed file maps into it or one of its
      // own parts — never because a sibling under the same parent changed.
      const fam = new Set([h.id, ...subtreeIds(graph, h.id)]);
      const hit = [...fam].some((x) => anyTouched.has(x));
      const t = graph.nodes.get(h.id);
      (hit ? covered : untouched).push({ id: h.id, name: t.name, where: t.where, how: h.edge.how, via: h.edge.via, why: h.edge.why, owner: t.owner });
    }
    const rbs = runbooksFor(runbooks, graph, id);
    systems.push({
      id, name: n.name, path: pathOf(graph, id), badge: badge(n), status: n.status, owner: n.owner,
      files: [...touched.get(id)].sort(), untouched: untouched.sort((a, b) => a.id.localeCompare(b.id)), covered: covered.map((c) => c.id).sort(),
      runbooks: [...rbs.primary, ...rbs.related].map((r) => r.id), stepThrough: rbs.stepThrough.length,
    });
  }
  const specTouched = files.some((f) => /GAME_INFRA_SPEC\.md$/.test(f));
  const registryTouched = files.some((f) => f.startsWith("systems/registry/") || f.startsWith("systems/runbooks/"));
  const generatedTouched = files.some((f) => f === "systems/ATLAS.md" || f.startsWith("systems/atlas/") || f === "systems/explorer.html" || f.startsWith("systems/llm/"));
  const candidates = systems.filter((s) => s.status === "candidate").map((s) => s.id);
  return { files, systems, unmapped, specTouched, registryTouched, generatedTouched, candidates, gaps: systems.reduce((a, s) => a + s.untouched.length, 0) };
}

export function renderAudit(a) {
  const L = [];
  L.push(`# Diff audit — ${a.files.length} changed file(s) → ${a.systems.length} system(s)`);
  if (!a.files.length) { L.push(`No changes to audit.`); return L.join("\n"); }
  for (const s of a.systems) {
    L.push(``);
    L.push(`## \`${s.id}\` ${s.name} (${s.path}) ${s.badge}`);
    L.push(`- files: ${s.files.map((f) => `\`${f}\``).join(", ")}`);
    if (s.status === "candidate") L.push(`- **candidate system touched — DIRECTOR decision required before this merges**`);
    if (s.runbooks.length) L.push(`- runbooks: ${s.runbooks.map((r) => `\`${r}\``).join(", ")}`);
    L.push(`- hard downstream covered by this diff: ${s.covered.length ? s.covered.map((c) => `\`${c}\``).join(", ") : "—"}`);
    if (s.untouched.length) {
      L.push(`- **hard downstream NOT touched (${s.untouched.length}) — confirm each is unaffected, in the PR:**`);
      for (const u of s.untouched) L.push(`  - \`${u.id}\` ${u.name} — ${u.how}${u.via ? ` via ${u.via}` : ""}: ${u.why} · where: ${u.where.map((w) => `\`${w}\``).join(", ") || "—"} · owner: ${u.owner.join("/")}`);
    } else L.push(`- every direct hard downstream system has a touched file — good`);
  }
  L.push(``);
  L.push(`## Notes`);
  if (a.unmapped.length) L.push(`- ${a.unmapped.length} file(s) map to no system (governance or unregistered paths): ${a.unmapped.slice(0, 15).map((f) => `\`${f}\``).join(", ")}${a.unmapped.length > 15 ? " …" : ""}`);
  if (a.specTouched) L.push(`- **GAME_INFRA_SPEC.md changed** — contract change (§14): DIRECTOR approval; if §5 changed, \`sig_*\` nodes must match (validate cross-checks).`);
  if (a.registryTouched) L.push(`- registry or runbooks changed — run \`scripts/systems-map.sh validate\` and \`render\`; the doctor fails on stale generated files.`);
  if (a.generatedTouched) L.push(`- **generated atlas files changed by hand?** They must come from \`render\`; hand edits are overwritten and flagged.`);
  L.push(`- ${a.gaps} unconfirmed hard-downstream gap(s) in total.`);
  return L.join("\n");
}

// ── Mutations ───────────────────────────────────────────────────────────────

const PIPE = "";
function splitRow(line) {
  const cells = line.replace(/\\\|/g, PIPE).split("|");
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.split(PIPE).join("|").trim());
}
const isSeparator = (line) => /^\s*\|?\s*:?-{2,}/.test(line) && /^[\s|:\-]+$/.test(line);
export const cell = (v) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
  return s === "" ? "—" : s;
};
const rowLine = (header, values) => `| ${header.map((h) => cell(values[h])).join(" | ")} |`;

async function readFile(root, file) { return fs.readFile(path.join(root, DEFAULT_REGISTRY_DIR, file), "utf8"); }
async function writeFile(root, file, text) { return fs.writeFile(path.join(root, DEFAULT_REGISTRY_DIR, file), text, "utf8"); }

/** Re-load and validate; on new errors restore the previous text unless forced. */
async function commit(root, file, before, after, { dryRun = false, force = false } = {}) {
  if (dryRun) return { ok: true, dryRun: true, diff: diffLines(before, after) };
  await writeFile(root, file, after);
  const all = await loadAll({ root });
  if (all.validation.errors.length && !force) {
    await writeFile(root, file, before);
    return { ok: false, reverted: true, errors: all.validation.errors, diff: diffLines(before, after) };
  }
  return { ok: true, errors: all.validation.errors, warnings: all.validation.warnings, hash: all.hash, diff: diffLines(before, after) };
}

function diffLines(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const out = [];
  const setA = new Set(a);
  const setB = new Set(b);
  for (const l of a) if (!setB.has(l)) out.push(`- ${l}`);
  for (const l of b) if (!setA.has(l)) out.push(`+ ${l}`);
  return out;
}

function domainFileOf(graph, id) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`unknown system id: ${id}`);
  return graph.nodes.get(n.domain).file;
}

function tableInsertIndex(lines, table) {
  // 0-based index of the line AFTER which a new row goes.
  if (table.rows.length) return table.rows[table.rows.length - 1].line - 1;
  const headerIdx = table.line - 1;
  return headerIdx + 1 < lines.length && isSeparator(lines[headerIdx + 1]) ? headerIdx + 1 : headerIdx;
}

/** Add a node row to the file of its parent's domain (or --file). */
export async function addNode(root, graph, f, opts = {}) {
  const required = ["id", "name", "status", "owner", "summary"];
  for (const k of required) if (!f[k]) throw new Error(`add-node: --${k} is required`);
  if (!/^[a-z][a-z0-9_]*$/.test(f.id)) throw new Error(`add-node: id "${f.id}" must be snake_case`);
  if (graph.nodes.has(f.id)) throw new Error(`add-node: "${f.id}" already exists (${graph.nodes.get(f.id).file}:${graph.nodes.get(f.id).line})`);
  if (!STATUSES.includes(f.status)) throw new Error(`add-node: status must be ${STATUSES.join("|")}`);
  for (const o of String(f.owner).split("/")) if (!OWNERS.includes(o.trim())) throw new Error(`add-node: owner "${o}" not in ${OWNERS.join("|")}`);
  let tier = f.tier != null ? Number(f.tier) : null;
  let file = f.file || null;
  if (f.parent) {
    const p = graph.nodes.get(f.parent);
    if (!p) throw new Error(`add-node: parent "${f.parent}" does not exist`);
    if (tier == null) tier = p.tier + 1;
    if (!file) file = graph.nodes.get(p.domain).file;
  } else {
    if (tier == null) tier = 1;
    if (tier !== 1) throw new Error(`add-node: a tier ${tier} node needs --parent`);
    if (!file) throw new Error(`add-node: a tier-1 node needs --file <NN-domain.md> (a new domain file must already carry the two table headers)`);
  }
  const before = await readFile(root, file);
  const lines = before.split(/\r?\n/);
  const nt = findTable(before, "Nodes");
  if (!nt) throw new Error(`add-node: ${file} has no Nodes table`);
  const values = {
    id: f.id, name: f.name, tier, parent: f.parent || "—", phase: f.phase ?? "—", status: f.status, owner: f.owner,
    where: f.where || "—", spec: f.spec || "—", summary: f.summary, analogy: f.analogy || "—",
  };
  const missing = NODE_COLUMNS.filter((c) => c !== "analogy" && !nt.header.includes(c));
  if (missing.length) throw new Error(`add-node: ${file} Nodes table lacks column(s) ${missing.join(", ")}`);
  const idx = tableInsertIndex(lines, nt);
  lines.splice(idx + 1, 0, rowLine(nt.header, values));
  const after = lines.join("\n");
  return { file, line: idx + 2, ...(await commit(root, file, before, after, opts)) };
}

/** Add an edge row. Signal edges go to the foundation file (where all bus wiring lives); others to the From node's domain file. */
export async function addEdge(root, graph, f, opts = {}) {
  for (const k of ["from", "how", "to", "why"]) if (!f[k]) throw new Error(`add-edge: --${k} is required`);
  if (!HOW_NAMES.includes(f.how)) throw new Error(`add-edge: how must be ${HOW_NAMES.join("|")}`);
  const strength = f.strength || "hard";
  if (!STRENGTHS.includes(strength)) throw new Error(`add-edge: strength must be ${STRENGTHS.join("|")}`);
  if (!graph.nodes.has(f.from)) throw new Error(`add-edge: from "${f.from}" does not exist`);
  if (!graph.nodes.has(f.to)) throw new Error(`add-edge: to "${f.to}" does not exist`);
  const dup = graph.registry.edges.find((e) => e.from === f.from && e.how === f.how && e.to === f.to && (e.via || "") === (f.via || ""));
  if (dup) throw new Error(`add-edge: that edge already exists (${dup.file}:${dup.line})`);
  const signalInvolved = isSignal(f.from) || isSignal(f.to);
  const file = f.file || (signalInvolved ? graph.nodes.get("event_bus")?.file || domainFileOf(graph, f.from) : domainFileOf(graph, f.from));
  const before = await readFile(root, file);
  const lines = before.split(/\r?\n/);
  const et = findTable(before, "Edges");
  if (!et) throw new Error(`add-edge: ${file} has no Edges table`);
  const values = { from: f.from, how: f.how, to: f.to, via: f.via || "—", strength, why: f.why };
  const idx = tableInsertIndex(lines, et);
  lines.splice(idx + 1, 0, rowLine(et.header, values));
  return { file, line: idx + 2, ...(await commit(root, file, before, lines.join("\n"), opts)) };
}

/** Rewrite cells of an existing node row. `changes` is { column: value }. The id is immutable (R7). */
export async function setNode(root, graph, id, changes, opts = {}) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`set-node: unknown system id: ${id}`);
  const keys = Object.keys(changes);
  if (!keys.length) throw new Error(`set-node: nothing to change (use column=value, columns: ${NODE_COLUMNS.filter((c) => c !== "id").join(", ")})`);
  for (const k of keys) {
    if (k === "id") throw new Error(`set-node: ids are immutable once shipped (R7) — add a new node and retire the old one`);
    if (!NODE_COLUMNS.includes(k)) throw new Error(`set-node: unknown column "${k}" (columns: ${NODE_COLUMNS.join(", ")})`);
  }
  if (changes.parent && graph.nodes.has(changes.parent) && graph.nodes.get(changes.parent).domain !== n.domain) {
    throw new Error(`set-node: moving ${id} into another domain (${graph.nodes.get(changes.parent).domain}) means moving its row to that file — use remove-node + add-node`);
  }
  const before = await readFile(root, n.file);
  const lines = before.split(/\r?\n/);
  const nt = findTable(before, "Nodes");
  const rowIdx = n.line - 1;
  const cells = splitRow(lines[rowIdx]);
  const values = {};
  nt.header.forEach((h, i) => { values[h] = cells[i] ?? ""; });
  if (values.id !== id) throw new Error(`set-node: row at ${n.file}:${n.line} is not ${id} (registry changed under us — re-run)`);
  for (const [k, v] of Object.entries(changes)) values[k] = v;
  lines[rowIdx] = rowLine(nt.header, values);
  return { file: n.file, line: n.line, ...(await commit(root, n.file, before, lines.join("\n"), opts)) };
}

/** Delete a node row. Refuses while children or edges still point at it. */
export async function removeNode(root, graph, id, opts = {}) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`remove-node: unknown system id: ${id}`);
  if (n.children.length) throw new Error(`remove-node: ${id} still has parts: ${n.children.join(", ")} — move or remove them first`);
  const refs = graph.registry.edges.filter((e) => e.from === id || e.to === id);
  if (refs.length) throw new Error(`remove-node: ${id} is still wired by ${refs.length} edge(s): ${refs.slice(0, 6).map((e) => `${e.from} ${e.how} ${e.to} (${e.file}:${e.line})`).join("; ")}${refs.length > 6 ? " …" : ""} — remove-edge them first`);
  const before = await readFile(root, n.file);
  const lines = before.split(/\r?\n/);
  const cells = splitRow(lines[n.line - 1]);
  if (cells[0] !== id) throw new Error(`remove-node: row at ${n.file}:${n.line} is not ${id} (registry changed under us — re-run)`);
  lines.splice(n.line - 1, 1);
  return { file: n.file, line: n.line, ...(await commit(root, n.file, before, lines.join("\n"), opts)) };
}

/** Delete an edge row identified by from/how/to (and via when several match). */
export async function removeEdge(root, graph, f, opts = {}) {
  for (const k of ["from", "how", "to"]) if (!f[k]) throw new Error(`remove-edge: ${k} is required`);
  const matches = graph.registry.edges.filter((e) => e.from === f.from && e.how === f.how && e.to === f.to && (f.via == null || (e.via || "") === f.via));
  if (!matches.length) throw new Error(`remove-edge: no edge ${f.from} ${f.how} ${f.to}${f.via ? ` via ${f.via}` : ""}`);
  if (matches.length > 1) throw new Error(`remove-edge: ${matches.length} edges match — disambiguate with --via: ${matches.map((e) => `"${e.via}"`).join(", ")}`);
  const e = matches[0];
  const before = await readFile(root, e.file);
  const lines = before.split(/\r?\n/);
  const cells = splitRow(lines[e.line - 1]);
  if (cells[0] !== e.from) throw new Error(`remove-edge: row at ${e.file}:${e.line} is not that edge (registry changed under us — re-run)`);
  lines.splice(e.line - 1, 1);
  return { file: e.file, line: e.line, ...(await commit(root, e.file, before, lines.join("\n"), opts)) };
}

/** Column names for `set-node` args of the form column=value. */
export function parseAssignments(args) {
  const out = {};
  for (const a of args) {
    const i = a.indexOf("=");
    if (i <= 0) throw new Error(`expected column=value, got "${a}"`);
    out[a.slice(0, i).trim().toLowerCase()] = a.slice(i + 1).trim();
  }
  return out;
}

export { EDGE_COLUMNS };
