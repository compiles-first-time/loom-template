#!/usr/bin/env node
// Systems atlas — registry parser, validator, impact analysis, renderers.
// Per ADR-0065 (systems registry + computed impact map).
//
// ── What this is ────────────────────────────────────────────────────────────
//
// A game is a few hundred systems that all touch each other. The question that
// gets expensive as the game grows is not "what does X do?" but "if I change X,
// what else moves — how, where, and why?". Prose cannot answer that reliably
// (an unchecked convention drifts — ADR-0059/0060/0061), so the answer is
// computed from a ledger that code validates.
//
// The ledger is `systems/registry/*.md`: one markdown file per top-level domain,
// each with a `## Nodes` table (the systems, tiered 1→4 by containment) and an
// `## Edges` table (the wiring). Markdown tables on purpose: one node = one
// line, one edge = one line, so a diff is a reviewable list of what changed and
// GitHub renders the source without tooling.
//
// ── The one rule to remember: direction ─────────────────────────────────────
//
// Every edge row is written from the DEPENDENT's point of view, except `emits`,
// which is written from the emitter's. The tool normalizes both into INFLUENCE
// edges (src → dst means "a change in src can affect dst"):
//
//   A listens / reads / references / calls / renders / validates / persists /
//     configures / extends / transports / gated_by  B      ⇒   B → A
//   A emits S                                              ⇒   A → S
//
//   affects X      = everything reachable FORWARD from X (and its descendants)
//   affected-by X  = everything reachable BACKWARD from X (and its descendants)
//
// EventBus signals are nodes too (`sig_*`, children of `event_bus`), so a
// signal's listeners are two hops from its emitter — exactly the architecture
// R2 prescribes (systems know the bus, never each other) and exactly what the
// spec's §5 table says. `validate` cross-checks the two.
//
// Zero dependencies, pure functions + a guarded CLI (importing never runs it).

import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const HOWS = Object.freeze({
  listens: "A listens to EventBus signal B",
  emits: "A emits EventBus signal B (written from the emitter)",
  reads: "A reads B's data or state",
  references: "A's data references B's ids (a content-level coupling)",
  calls: "A calls B directly (R2: only inside one system subtree or a pure helper)",
  renders: "A (presentation) renders B's state — never mutates it (R5)",
  validates: "A (a gate or tool) validates B",
  persists: "A saves/loads B's state",
  configures: "A configures B",
  extends: "A is a specialization or variant of B",
  transports: "A (networking) carries B's state or commands",
  gated_by: "A is blocked until B approves or unlocks it",
});
export const HOW_NAMES = Object.keys(HOWS);
export const STATUSES = ["spec", "implied", "candidate", "non-goal"];
export const OWNERS = ["orchestrator", "content-smith", "world-builder", "quest-writer", "test-pilot", "director"];
export const STRENGTHS = ["hard", "soft"];
export const NODE_COLUMNS = ["id", "name", "tier", "parent", "phase", "status", "owner", "where", "spec", "summary", "analogy"];
export const EDGE_COLUMNS = ["from", "how", "to", "via", "strength", "why"];
export const SIGNAL_PREFIX = "sig_";
export const SIGNAL_PARENT = "event_bus";
export const DEFAULT_REGISTRY_DIR = "systems/registry";
export const DEFAULT_SPEC_FILE = "GAME_INFRA_SPEC.md";
export const ATLAS_FILE = "systems/ATLAS.md";
export const EXPLORER_FILE = "systems/explorer.html";
export const MAX_TIER = 5;

const EMPTY = new Set(["", "—", "-", "–", "n/a", "none", "null"]);
const isEmpty = (s) => EMPTY.has(String(s ?? "").trim().toLowerCase());

// ── Markdown table parsing ──────────────────────────────────────────────────

const PIPE_TOKEN = "";

function splitRow(line) {
  // Escaped pipes (`\|`) survive as literal pipes inside a cell.
  const cells = line.replace(/\\\|/g, PIPE_TOKEN).split("|");
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.split(PIPE_TOKEN).join("|").trim());
}

const isSeparator = (line) => /^\s*\|?\s*:?-{2,}/.test(line) && /^[\s|:\-]+$/.test(line);

/**
 * Find the markdown table that follows a `## <heading>` line. Returns
 * { header: string[], rows: {cells: string[], line: number}[], line } or null.
 */
export function findTable(text, heading) {
  const lines = String(text).split(/\r?\n/);
  const re = new RegExp(`^##\\s+${heading}\\b`, "i");
  let i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  i++;
  while (i < lines.length && !lines[i].trim().startsWith("|")) {
    if (/^#{1,6}\s/.test(lines[i])) return null; // next heading before any table
    i++;
  }
  if (i >= lines.length) return null;
  const header = splitRow(lines[i]).map((h) => h.toLowerCase());
  const rows = [];
  let j = i + 1;
  if (j < lines.length && isSeparator(lines[j])) j++;
  for (; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim().startsWith("|")) break;
    const cells = splitRow(l);
    if (cells.every((c) => c === "")) continue;
    rows.push({ cells, line: j + 1 });
  }
  return { header, rows, line: i + 1 };
}

function rowToObject(header, cells) {
  const o = {};
  header.forEach((h, idx) => { o[h] = cells[idx] ?? ""; });
  return o;
}

/**
 * Parse one registry file's text into raw nodes + edges (no cross-file checks).
 */
export function parseRegistryText(text, file = "<memory>") {
  const problems = [];
  const nodes = [];
  const edges = [];

  const nt = findTable(text, "Nodes");
  if (!nt) problems.push(`${file}: no \`## Nodes\` table`);
  else {
    const missing = NODE_COLUMNS.filter((c) => c !== "analogy" && !nt.header.includes(c));
    if (missing.length) problems.push(`${file}:${nt.line}: Nodes table missing column(s): ${missing.join(", ")}`);
    else {
      for (const r of nt.rows) {
        const o = rowToObject(nt.header, r.cells);
        nodes.push({
          id: o.id.trim(),
          name: o.name.trim(),
          tier: isEmpty(o.tier) ? null : Number(o.tier),
          parent: isEmpty(o.parent) ? null : o.parent.trim(),
          phase: isEmpty(o.phase) ? null : o.phase.trim(),
          status: o.status.trim().toLowerCase(),
          owner: isEmpty(o.owner) ? [] : o.owner.split("/").map((s) => s.trim()).filter(Boolean),
          where: isEmpty(o.where) ? [] : o.where.split(";").map((s) => s.trim()).filter(Boolean),
          spec: isEmpty(o.spec) ? "" : o.spec.trim(),
          summary: o.summary.trim(),
          analogy: isEmpty(o.analogy ?? "") ? "" : String(o.analogy).trim(),
          file,
          line: r.line,
        });
      }
    }
  }

  const et = findTable(text, "Edges");
  if (!et) problems.push(`${file}: no \`## Edges\` table`);
  else {
    const missing = EDGE_COLUMNS.filter((c) => !et.header.includes(c));
    if (missing.length) problems.push(`${file}:${et.line}: Edges table missing column(s): ${missing.join(", ")}`);
    else {
      for (const r of et.rows) {
        const o = rowToObject(et.header, r.cells);
        edges.push({
          from: o.from.trim(),
          how: o.how.trim().toLowerCase(),
          to: o.to.trim(),
          via: isEmpty(o.via) ? "" : o.via.trim(),
          strength: isEmpty(o.strength) ? "" : o.strength.trim().toLowerCase(),
          why: o.why.trim(),
          file,
          line: r.line,
        });
      }
    }
  }
  return { nodes, edges, problems };
}

/** Load every *.md under the registry dir (sorted) and merge. */
export async function loadRegistry(dir) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
  const nodes = [];
  const edges = [];
  const problems = [];
  const sources = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const text = await fs.readFile(full, "utf8");
    sources.push({ file: f, text });
    const r = parseRegistryText(text, f);
    nodes.push(...r.nodes);
    edges.push(...r.edges);
    problems.push(...r.problems);
  }
  return { nodes, edges, problems, files, sources };
}

// ── Graph ───────────────────────────────────────────────────────────────────

const isSignal = (id) => String(id).startsWith(SIGNAL_PREFIX);
const phaseNum = (n) => (n && n.phase != null && /^\d+$/.test(n.phase) ? Number(n.phase) : null);

/**
 * Build the graph: node index, containment (children/ancestors/domain), and
 * influence edges normalized by direction.
 */
export function buildGraph(registry) {
  const nodes = new Map();
  for (const n of registry.nodes) {
    if (n.id && !nodes.has(n.id)) nodes.set(n.id, { ...n, children: [], ancestors: [], domain: null, kind: isSignal(n.id) ? "signal" : "system" });
  }
  // containment
  for (const n of nodes.values()) {
    if (n.parent && nodes.has(n.parent)) nodes.get(n.parent).children.push(n.id);
  }
  for (const n of nodes.values()) {
    const chain = [];
    let cur = n;
    const seen = new Set([n.id]);
    while (cur.parent && nodes.has(cur.parent) && !seen.has(cur.parent)) {
      cur = nodes.get(cur.parent);
      seen.add(cur.id);
      chain.push(cur.id);
    }
    n.ancestors = chain; // nearest first
    n.domain = chain.length ? chain[chain.length - 1] : n.id;
  }
  // influence edges
  const influence = [];
  for (const e of registry.edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to) || e.from === e.to) continue; // reported by validate
    const forward = e.how === "emits";
    influence.push({
      src: forward ? e.from : e.to,
      dst: forward ? e.to : e.from,
      how: e.how,
      via: e.via,
      strength: e.strength || "hard",
      why: e.why,
      from: e.from,
      to: e.to,
      file: e.file,
      line: e.line,
    });
  }
  const out = new Map();
  const inn = new Map();
  for (const n of nodes.keys()) { out.set(n, []); inn.set(n, []); }
  for (const ie of influence) { out.get(ie.src).push(ie); inn.get(ie.dst).push(ie); }
  return { nodes, influence, out, in: inn, registry };
}

export function descendants(graph, id) {
  const acc = [];
  const stack = [...(graph.nodes.get(id)?.children || [])];
  while (stack.length) {
    const c = stack.pop();
    acc.push(c);
    stack.push(...(graph.nodes.get(c)?.children || []));
  }
  return acc;
}

export function subtreeIds(graph, id) {
  return [id, ...descendants(graph, id)];
}

/**
 * Reachability with explanation. direction: "out" (affects) or "in" (affected-by).
 * Returns hits: [{ id, depth, edge, viaNode }] ordered by BFS depth, plus the
 * start set. Internal (start-set) nodes are never reported.
 */
export function reach(graph, id, { direction = "out", depth = Infinity, expand = true, phase = null, candidates = true } = {}) {
  if (!graph.nodes.has(id)) throw new Error(`unknown system id: ${id}`);
  const start = expand ? subtreeIds(graph, id) : [id];
  const internal = new Set(start);
  const adj = direction === "out" ? graph.out : graph.in;
  const seen = new Map(); // id -> hit
  let frontier = start.map((s) => ({ id: s, depth: 0 }));
  let d = 0;
  while (frontier.length && d < depth) {
    d++;
    const next = [];
    for (const f of frontier) {
      for (const ie of adj.get(f.id) || []) {
        const nid = direction === "out" ? ie.dst : ie.src;
        if (internal.has(nid) || seen.has(nid)) continue;
        const n = graph.nodes.get(nid);
        const pn = phaseNum(n);
        if (phase != null && pn != null && pn > phase) continue;
        if (!candidates && n.status === "candidate") continue;
        const hit = { id: nid, depth: d, edge: ie, viaNode: f.id };
        seen.set(nid, hit);
        next.push({ id: nid, depth: d });
      }
    }
    frontier = next;
  }
  return { start, hits: [...seen.values()] };
}

export const affects = (graph, id, opts = {}) => reach(graph, id, { ...opts, direction: "out" });
export const affectedBy = (graph, id, opts = {}) => reach(graph, id, { ...opts, direction: "in" });

/** Transitive downstream count — the blast radius. */
export function blastRadius(graph, id, opts = {}) {
  return affects(graph, id, opts).hits.length;
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Parse the EventBus signal names out of the spec's §5 table.
 * Rows look like: | `actor_spawned` | ... |  or  | `world_saved` / `world_loaded` | ... |
 */
export function parseSpecSignals(specText) {
  if (!specText) return null;
  const text = String(specText);
  const start = text.search(/^##\s+5\./m);
  if (start < 0) return null;
  const rest = text.slice(start);
  const endRel = rest.slice(3).search(/^##\s+\d/m);
  const section = endRel < 0 ? rest : rest.slice(0, endRel + 3);
  const names = new Set();
  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const first = splitRow(line)[0] || "";
    const m = first.match(/`([a-z][a-z0-9_]*)`/g);
    if (!m) continue;
    for (const tok of m) names.add(tok.replace(/`/g, ""));
  }
  return names;
}

function tarjanSCC(graph) {
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); onStack.add(v);
    for (const ie of graph.out.get(v) || []) {
      const w = ie.dst;
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1) sccs.push(comp.sort());
    }
  };
  for (const v of graph.nodes.keys()) if (!idx.has(v)) strong(v);
  return sccs;
}

const topWhere = (n) => (n.where[0] || "").split("/").slice(0, 2).join("/");

/**
 * Validate registry + graph. Errors block; warnings are findings; info is
 * context. Every message names the file:line it came from where possible.
 */
export function validate(registry, graph, { specText = null } = {}) {
  const errors = [...registry.problems];
  const warnings = [];
  const info = [];
  const at = (x) => `${x.file}:${x.line}`;

  // ids + fields
  const seen = new Map();
  for (const n of registry.nodes) {
    if (!n.id) { errors.push(`${at(n)}: node with empty ID`); continue; }
    if (!/^[a-z][a-z0-9_]*$/.test(n.id)) errors.push(`${at(n)}: id "${n.id}" is not snake_case`);
    if (seen.has(n.id)) errors.push(`${at(n)}: duplicate id "${n.id}" (first at ${seen.get(n.id)})`);
    else seen.set(n.id, at(n));
    if (!n.name) errors.push(`${at(n)}: ${n.id} has no Name`);
    if (!Number.isInteger(n.tier) || n.tier < 1 || n.tier > MAX_TIER) errors.push(`${at(n)}: ${n.id} Tier must be 1..${MAX_TIER}`);
    if (!STATUSES.includes(n.status)) errors.push(`${at(n)}: ${n.id} Status "${n.status}" not in ${STATUSES.join("|")}`);
    for (const o of n.owner) if (!OWNERS.includes(o)) errors.push(`${at(n)}: ${n.id} Owner "${o}" not in ${OWNERS.join("|")}`);
    if (n.owner.length === 0) errors.push(`${at(n)}: ${n.id} has no Owner (a system nobody owns is a system nobody is dispatched for)`);
    if (n.phase != null && !/^[0-5]$/.test(n.phase)) errors.push(`${at(n)}: ${n.id} Phase "${n.phase}" must be 0..5 or —`);
    if ((n.status === "spec" || n.status === "implied") && n.phase == null) errors.push(`${at(n)}: ${n.id} is ${n.status} but has no Phase`);
    if (n.status === "non-goal" && n.phase != null) errors.push(`${at(n)}: ${n.id} is a non-goal and must not carry a Phase`);
    if (!n.summary) errors.push(`${at(n)}: ${n.id} has no Summary`);
    if (n.tier === 1 && n.parent) errors.push(`${at(n)}: ${n.id} is Tier 1 and must not have a Parent`);
    if (n.tier > 1 && !n.parent) errors.push(`${at(n)}: ${n.id} is Tier ${n.tier} and needs a Parent`);
    if (n.tier <= 2 && !n.analogy) warnings.push(`${at(n)}: ${n.id} (tier ${n.tier}) has no Analogy — tier 1–2 rows carry one so the map can be read by pattern, not by prose`);
  }
  // parents + tiers + signals
  for (const n of graph.nodes.values()) {
    if (n.parent) {
      const p = graph.nodes.get(n.parent);
      if (!p) errors.push(`${at(n)}: ${n.id} Parent "${n.parent}" does not exist`);
      else if (p.tier !== n.tier - 1) errors.push(`${at(n)}: ${n.id} is Tier ${n.tier} but Parent ${p.id} is Tier ${p.tier} (must be ${n.tier - 1})`);
    }
    if (n.kind === "signal" && n.parent !== SIGNAL_PARENT) errors.push(`${at(n)}: signal ${n.id} must be a child of ${SIGNAL_PARENT}`);
    if (n.kind !== "signal" && n.parent === SIGNAL_PARENT) errors.push(`${at(n)}: ${n.id} is under ${SIGNAL_PARENT} but is not named ${SIGNAL_PREFIX}*`);
  }
  // edges
  for (const e of registry.edges) {
    if (!HOW_NAMES.includes(e.how)) errors.push(`${at(e)}: How "${e.how}" not in ${HOW_NAMES.join("|")}`);
    if (!graph.nodes.has(e.from)) errors.push(`${at(e)}: From "${e.from}" does not exist`);
    if (!graph.nodes.has(e.to)) errors.push(`${at(e)}: To "${e.to}" does not exist`);
    if (e.from === e.to) errors.push(`${at(e)}: self-edge on ${e.from}`);
    if (!e.why) errors.push(`${at(e)}: ${e.from} ${e.how} ${e.to} has no Why — an edge without a reason cannot be reviewed`);
    if (e.strength && !STRENGTHS.includes(e.strength)) errors.push(`${at(e)}: Strength "${e.strength}" not in ${STRENGTHS.join("|")}`);
    if (!e.strength) errors.push(`${at(e)}: ${e.from} ${e.how} ${e.to} has no Strength (hard|soft)`);
    if ((e.how === "emits" || e.how === "listens") && graph.nodes.has(e.to) && !isSignal(e.to)) errors.push(`${at(e)}: ${e.how} target "${e.to}" is not a ${SIGNAL_PREFIX}* signal node`);
    if (e.how !== "emits" && e.how !== "listens" && graph.nodes.has(e.to) && isSignal(e.to)) errors.push(`${at(e)}: only emits/listens may target a signal (${e.to})`);
    if (graph.nodes.has(e.from) && isSignal(e.from)) errors.push(`${at(e)}: a signal (${e.from}) cannot be the From of an edge`);
  }
  // duplicate edges
  const ekeys = new Map();
  for (const e of registry.edges) {
    const k = `${e.from}|${e.how}|${e.to}|${e.via}`;
    if (ekeys.has(k)) warnings.push(`${at(e)}: duplicate edge ${e.from} ${e.how} ${e.to}${e.via ? ` via ${e.via}` : ""} (first at ${ekeys.get(k)})`);
    else ekeys.set(k, at(e));
  }
  // signal wiring
  for (const n of graph.nodes.values()) {
    if (n.kind !== "signal") continue;
    const emitters = (graph.in.get(n.id) || []).filter((ie) => ie.how === "emits");
    const listeners = (graph.out.get(n.id) || []).filter((ie) => ie.how === "listens");
    if (emitters.length === 0) warnings.push(`${at(n)}: signal ${n.id} has no emitter`);
    if (listeners.length === 0) warnings.push(`${at(n)}: signal ${n.id} has no listener`);
  }
  // spec §5 cross-check (R-EB1)
  const specSignals = parseSpecSignals(specText);
  if (specSignals) {
    const regSpec = new Set([...graph.nodes.values()].filter((n) => n.kind === "signal" && n.status === "spec").map((n) => n.id.slice(SIGNAL_PREFIX.length)));
    const regAll = new Set([...graph.nodes.values()].filter((n) => n.kind === "signal").map((n) => n.id.slice(SIGNAL_PREFIX.length)));
    for (const s of specSignals) if (!regAll.has(s)) errors.push(`spec §5 declares signal \`${s}\` but the registry has no ${SIGNAL_PREFIX}${s} node (R-EB1: the table and the ledger must agree)`);
    for (const s of regSpec) if (!specSignals.has(s)) errors.push(`registry marks ${SIGNAL_PREFIX}${s} as status spec but spec §5 has no such row (R-EB1)`);
    const proposed = [...regAll].filter((s) => !specSignals.has(s));
    if (proposed.length) info.push(`${proposed.length} candidate signal(s) await a §5 entry (R-EB1 PR): ${proposed.join(", ")}`);
  } else if (specText != null) {
    warnings.push("spec text given but no `## 5.` section with a signal table was found — §5 cross-check skipped");
  }
  // phase inversion, scope leak, R2 smell
  //
  // Exemptions, each with a reason:
  //   - listens/emits: a listener may exist before its signal (it simply never
  //     fires), and candidate signals are tracked by the R-EB1 proposal list
  //     above, not as scope leaks — a signal is a mechanical §5 row, not a
  //     scope decision.
  //   - validates: a gate that checks a later system is not built on it.
  //   - references: data naming an id is checked by G2 against data, not
  //     against whether the consuming system is live yet.
  //   - renders: presentation follows whatever exists; a HUD element that
  //     will show a Phase-2 pool is not blocked on Phase 2.
  const NO_INVERSION = new Set(["emits", "listens", "validates", "references", "renders"]);
  const NO_LEAK = new Set(["emits", "listens"]);
  for (const ie of graph.influence) {
    const src = graph.nodes.get(ie.src);
    const dst = graph.nodes.get(ie.dst);
    const ps = phaseNum(src);
    const pd = phaseNum(dst);
    if (!NO_INVERSION.has(ie.how) && ie.strength === "hard" && ps != null && pd != null && ps > pd) {
      warnings.push(`${ie.file}:${ie.line}: phase inversion — ${dst.id} (P${pd}) hard-depends on ${src.id} (P${ps}); either the phase is wrong or the dependency must be soft until P${ps}`);
    }
    if (!NO_LEAK.has(ie.how) && ie.strength === "hard" && (dst.status === "spec" || dst.status === "implied") && src.status === "candidate") {
      warnings.push(`${ie.file}:${ie.line}: scope leak — ${dst.status} system ${dst.id} hard-depends on candidate ${src.id}; needs a DIRECTOR decision or a soft edge`);
    }
    if (ie.how === "calls") {
      const a = topWhere(src);
      const b = topWhere(dst);
      if (a.startsWith("core/") && b.startsWith("core/") && a !== b) {
        warnings.push(`${ie.file}:${ie.line}: R2 smell — ${dst.id} (${b}) calls ${src.id} (${a}) across system subtrees; route through the EventBus or a command intent`);
      }
    }
  }
  // islands (tier 2, counting the whole subtree)
  for (const n of graph.nodes.values()) {
    if (n.tier !== 2) continue;
    const ids = subtreeIds(graph, n.id);
    const wired = ids.some((id) => (graph.out.get(id) || []).length || (graph.in.get(id) || []).length);
    if (!wired) warnings.push(`${at(n)}: island — ${n.id} and its parts have no edges at all; either it is unexamined or it does not belong`);
  }
  // cycles (info — event loops are normal, but they are worth knowing)
  const sccs = tarjanSCC(graph);
  if (sccs.length) {
    const desc = sccs.slice(0, 6).map((c) => `[${c.length}] ${c.slice(0, 6).join(", ")}${c.length > 6 ? " …" : ""}`);
    info.push(`${sccs.length} feedback loop(s) in the influence graph (normal for an event-driven design; each is a place where a change can come back around): ${desc.join(" · ")}`);
  }
  return { errors, warnings, info, ok: errors.length === 0 };
}

// ── Reports ─────────────────────────────────────────────────────────────────

export function contentHash(registry) {
  const h = crypto.createHash("sha256");
  for (const s of registry.sources || []) h.update(s.file).update("\n").update(s.text.replace(/\r\n/g, "\n"));
  return h.digest("hex").slice(0, 12);
}

const badge = (n) => `[P${n.phase ?? "—"}][${n.status}][${n.owner.join("/")}]`;
const pathOf = (graph, id) => {
  const n = graph.nodes.get(id);
  const chain = [...n.ancestors].reverse().map((a) => graph.nodes.get(a).name);
  return chain.length ? chain.join(" › ") : n.name;
};

export function describeEdge(graph, ie) {
  const via = ie.via ? ` via \`${ie.via}\`` : "";
  return `${ie.from} **${ie.how}** ${ie.to}${via} (${ie.strength}) — ${ie.why}`;
}

export function nodeCard(graph, id) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`unknown system id: ${id}`);
  const lines = [];
  lines.push(`# ${n.name}  \`${n.id}\``);
  lines.push(`${pathOf(graph, id)} › **${n.name}**  ·  tier ${n.tier}  ·  ${badge(n)}`);
  if (n.analogy) lines.push(`> *Analogy:* ${n.analogy}`);
  lines.push(``);
  lines.push(`- **Summary:** ${n.summary}`);
  lines.push(`- **Where:** ${n.where.length ? n.where.map((w) => `\`${w}\``).join(", ") : "—"}`);
  lines.push(`- **Spec:** ${n.spec || "—"}`);
  if (n.children.length) lines.push(`- **Parts (${n.children.length}):** ${n.children.map((c) => `\`${c}\``).join(", ")}`);
  const outs = graph.out.get(id) || [];
  const ins = graph.in.get(id) || [];
  lines.push(``);
  lines.push(`**Directly affects (${outs.length})**`);
  for (const ie of outs) lines.push(`- → \`${ie.dst}\` — ${describeEdge(graph, ie)}`);
  lines.push(``);
  lines.push(`**Directly affected by (${ins.length})**`);
  for (const ie of ins) lines.push(`- ← \`${ie.src}\` — ${describeEdge(graph, ie)}`);
  return lines.join("\n");
}

function groupByDepth(hits) {
  const m = new Map();
  for (const h of hits) { if (!m.has(h.depth)) m.set(h.depth, []); m.get(h.depth).push(h); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

export function renderReach(graph, id, result, direction) {
  const verb = direction === "out" ? "affects" : "is affected by";
  const lines = [`## \`${id}\` ${verb} ${result.hits.length} system(s)`];
  if (result.start.length > 1) lines.push(`*(including its ${result.start.length - 1} contained part(s))*`);
  for (const [d, hs] of groupByDepth(result.hits)) {
    lines.push(``, `**Depth ${d}** — ${hs.length}`);
    for (const h of hs) {
      const t = graph.nodes.get(h.id);
      const ie = h.edge;
      const arrow = direction === "out" ? `${ie.src} → ${ie.dst}` : `${ie.dst} ← ${ie.src}`;
      const via = ie.via ? ` via \`${ie.via}\`` : "";
      lines.push(`- \`${h.id}\` ${t.name} *(${pathOf(graph, h.id)})* ${badge(t)} — **${ie.how}**${via}, ${ie.strength}: ${ie.why}  ⟨${arrow}⟩`);
    }
  }
  return lines.join("\n");
}

/** The PR-ready impact report: both directions + a review checklist. */
export function impactReport(graph, id, opts = {}) {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`unknown system id: ${id}`);
  const down = affects(graph, id, opts);
  const up = affectedBy(graph, id, opts);
  const all = [...down.hits, ...up.hits].map((h) => graph.nodes.get(h.id));
  const owners = new Set(all.flatMap((x) => x.owner));
  const domains = new Set(all.map((x) => graph.nodes.get(x.domain).name));
  // Collapse every spec column in the blast radius to unique section ids (§5, §6.3, R4, Appendix B).
  const specs = new Set();
  for (const s of [n.spec, ...all.map((x) => x.spec)]) for (const m of String(s || "").matchAll(/§\d+(?:\.\d+)?|\bR-?[A-Z0-9]+\b|Appendix [A-Z]/g)) specs.add(m[0]);
  const specList = [...specs].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const signals = new Set([...down.hits, ...up.hits].map((h) => h.id).filter(isSignal));
  const phases = new Set(all.map((x) => x.phase).filter((p) => p != null));
  const candidatesTouched = all.filter((x) => x.status === "candidate").map((x) => x.id);
  const hardDown = down.hits.filter((h) => h.edge.strength === "hard").length;
  const lines = [];
  lines.push(`# Impact report — \`${id}\` (${pathOf(graph, id)} › ${n.name})`);
  lines.push(`${badge(n)} · where: ${n.where.map((w) => `\`${w}\``).join(", ") || "—"} · spec: ${n.spec || "—"}`);
  if (n.analogy) lines.push(`> *${n.analogy}*`);
  lines.push(``);
  lines.push(`| Measure | Value |`, `|---|---|`);
  lines.push(`| Downstream (affects) | ${down.hits.length} (${hardDown} hard) |`);
  lines.push(`| Upstream (affected by) | ${up.hits.length} |`);
  lines.push(`| Domains touched | ${domains.size} |`);
  lines.push(`| Owners to loop in | ${[...owners].join(", ") || "—"} |`);
  lines.push(`| Signals crossing this change | ${[...signals].map((s) => s.slice(SIGNAL_PREFIX.length)).join(", ") || "—"} |`);
  lines.push(`| Phases touched | ${[...phases].sort().join(", ") || "—"} |`);
  lines.push(`| Spec sections to re-read | ${specList.join(", ") || "—"} |`);
  if (candidatesTouched.length) lines.push(`| Candidate (unapproved) systems in the blast radius | ${candidatesTouched.length}: ${candidatesTouched.slice(0, 24).join(", ")}${candidatesTouched.length > 24 ? ` … +${candidatesTouched.length - 24} more` : ""} |`);
  lines.push(``);
  lines.push(renderReach(graph, id, down, "out"));
  lines.push(``);
  lines.push(renderReach(graph, id, up, "in"));
  lines.push(``);
  lines.push(`## Review checklist`);
  lines.push(`- [ ] Every **hard** downstream row above has been read, and its owner is on the PR.`);
  if (signals.size) lines.push(`- [ ] Signal payload(s) unchanged — or spec §5 is edited in this same PR (R-EB1).`);
  lines.push(`- [ ] Spec sections listed above still describe the behavior after this change (§14 change control).`);
  lines.push(`- [ ] Tests updated for the verbs touched; determinism kept (R4); no presentation writes to state (R5).`);
  if (candidatesTouched.length) lines.push(`- [ ] Candidate systems touched are either approved by the DIRECTOR (spec PR) or left untouched.`);
  lines.push(`- [ ] \`systems/registry\` edited if this change adds, removes, or rewires a system; then \`scripts/systems-map.sh render\`.`);
  return lines.join("\n");
}

export function stats(graph) {
  const nodes = [...graph.nodes.values()];
  const byTier = {};
  const byStatus = {};
  for (const n of nodes) { byTier[n.tier] = (byTier[n.tier] || 0) + 1; byStatus[n.status] = (byStatus[n.status] || 0) + 1; }
  const domains = nodes.filter((n) => n.tier === 1).map((d) => {
    const ids = subtreeIds(graph, d.id);
    const members = ids.map((i) => graph.nodes.get(i));
    const idSet = new Set(ids);
    let internal = 0, outbound = 0, inbound = 0;
    for (const ie of graph.influence) {
      const a = idSet.has(ie.src), b = idSet.has(ie.dst);
      if (a && b) internal++; else if (a) outbound++; else if (b) inbound++;
    }
    return {
      id: d.id, name: d.name, phase: d.phase, status: d.status,
      systems: members.filter((m) => m.tier === 2).length,
      parts: members.filter((m) => m.tier >= 3).length,
      spec: members.filter((m) => m.status === "spec").length,
      implied: members.filter((m) => m.status === "implied").length,
      candidate: members.filter((m) => m.status === "candidate").length,
      nonGoal: members.filter((m) => m.status === "non-goal").length,
      internal, outbound, inbound,
      coupling: internal + outbound + inbound ? Math.round((100 * (outbound + inbound)) / (internal + outbound + inbound)) : 0,
      blast: blastRadius(graph, d.id),
    };
  });
  const rank = (pred) => nodes.filter(pred).map((n) => ({
    id: n.id, name: n.name, domain: graph.nodes.get(n.domain).name, status: n.status, phase: n.phase,
    blast: blastRadius(graph, n.id), fanOut: (graph.out.get(n.id) || []).length, fanIn: (graph.in.get(n.id) || []).length,
  })).sort((a, b) => b.blast - a.blast || b.fanOut - a.fanOut || a.id.localeCompare(b.id)).slice(0, 15);
  const signals = nodes.filter((n) => n.kind === "signal").map((s) => ({
    id: s.id, status: s.status,
    emitters: (graph.in.get(s.id) || []).filter((ie) => ie.how === "emits").map((ie) => ie.src),
    listeners: (graph.out.get(s.id) || []).filter((ie) => ie.how === "listens").map((ie) => ie.dst),
  }));
  const candidates = nodes.filter((n) => n.status === "candidate");
  const nonGoals = nodes.filter((n) => n.status === "non-goal");
  return {
    nodes: nodes.length, edges: graph.influence.length, byTier, byStatus, domains,
    topSystems: rank((n) => n.tier === 2 && n.kind !== "signal"),
    topParts: rank((n) => n.tier >= 3 && n.kind !== "signal"),
    signals, candidates, nonGoals,
  };
}

// ── Renderers ───────────────────────────────────────────────────────────────

const mmLabel = (s) => String(s).replace(/"/g, "'").replace(/[\[\]{}()<>|]/g, "");

/** Tier-1 overview: domains as nodes, aggregated influence counts as labels. */
export function renderOverviewMermaid(graph, st) {
  const lines = ["flowchart LR"];
  for (const d of st.domains) lines.push(`  ${d.id}["${mmLabel(d.name)}<br/>${d.systems} systems · ${d.parts} parts"]`);
  const agg = new Map();
  for (const ie of graph.influence) {
    const a = graph.nodes.get(ie.src).domain;
    const b = graph.nodes.get(ie.dst).domain;
    if (a === b) continue;
    const k = `${a}|${b}`;
    agg.set(k, (agg.get(k) || 0) + 1);
  }
  for (const [k, c] of [...agg.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
    const [a, b] = k.split("|");
    lines.push(`  ${a} -- "${c}" --> ${b}`);
  }
  return lines.join("\n");
}

/** Per-domain: its tier-2 systems + the external tier-2 systems they wire to. */
export function renderDomainMermaid(graph, domainId) {
  const d = graph.nodes.get(domainId);
  const t2 = (id) => {
    const n = graph.nodes.get(id);
    if (n.tier <= 2) return n.id;
    return n.ancestors[n.ancestors.length - 2] || n.id; // tier-2 ancestor
  };
  const inside = new Set(descendants(graph, domainId).filter((id) => graph.nodes.get(id).tier === 2));
  const agg = new Map();
  const ext = new Set();
  for (const ie of graph.influence) {
    const a = t2(ie.src), b = t2(ie.dst);
    if (a === b) continue;
    const ai = inside.has(a), bi = inside.has(b);
    if (!ai && !bi) continue;
    if (!ai) ext.add(a);
    if (!bi) ext.add(b);
    const k = `${a}|${b}`;
    agg.set(k, (agg.get(k) || 0) + 1);
  }
  const lines = ["flowchart LR", `  subgraph ${domainId}["${mmLabel(d.name)}"]`];
  for (const id of inside) lines.push(`    ${id}["${mmLabel(graph.nodes.get(id).name)}"]`);
  lines.push("  end");
  for (const id of ext) {
    const n = graph.nodes.get(id);
    lines.push(`  ${id}(["${mmLabel(n.name)}<br/><i>${mmLabel(graph.nodes.get(n.domain).name)}</i>"])`);
  }
  for (const [k, c] of agg) {
    const [a, b] = k.split("|");
    lines.push(`  ${a} -- "${c}" --> ${b}`);
  }
  return lines.join("\n");
}

function renderTree(graph, id, depthLimit = 99, depth = 0) {
  const n = graph.nodes.get(id);
  const indent = "  ".repeat(depth);
  const where = n.where.length ? ` · \`${n.where[0]}\`${n.where.length > 1 ? ` +${n.where.length - 1}` : ""}` : "";
  const lines = [`${indent}- \`${n.id}\` **${n.name}** ${badge(n)} — ${n.summary}${where}`];
  if (depth < depthLimit) for (const c of n.children) lines.push(...renderTree(graph, c, depthLimit, depth + 1));
  return lines;
}

export function renderAtlas(graph, validation, { hash = "" } = {}) {
  const st = stats(graph);
  const L = [];
  L.push(`<!-- GENERATED by scripts/lib/systems-map.mjs render — do not edit; edit systems/registry/*.md and re-run. registry-hash: ${hash} -->`);
  L.push(`# EMBER Systems Atlas`);
  L.push(``);
  L.push(`> The map of every system the game needs, tiered by containment (1 = domain, 2 = system, 3–4 = parts), and the wiring between them. Per [ADR-0065](../adr/0065-systems-atlas-and-impact-map.md). Source of truth: [\`registry/\`](./registry/). Ask questions with \`scripts/systems-map.sh impact <id>\` — the answer is computed, not read.`);
  L.push(``);
  L.push(`**How to read a badge:** \`[P3][spec][orchestrator]\` = lands in **Phase 3**, is **in the spec**, owned by the **orchestrator** role. Status: \`spec\` = named in GAME_INFRA_SPEC.md · \`implied\` = required by something the spec says · \`candidate\` = requested (by the Director or genre-standard) but **not in the spec → needs a DIRECTOR decision and a spec PR (R10/§14)** · \`non-goal\` = the spec says do not build.`);
  L.push(``);
  L.push(`**How to read an arrow:** \`A → B\` means *a change in A can affect B*. Each edge carries **how** (listens/reads/references/…), **where** (the signal, field, or path it runs through), **strength** (hard = breaks; soft = degrades), and **why**.`);
  L.push(``);
  L.push(`## At a glance`);
  L.push(``);
  L.push(`| Nodes | Influence edges | Tier 1 | Tier 2 | Tier 3 | Tier 4 | spec | implied | candidate | non-goal |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|`);
  L.push(`| ${st.nodes} | ${st.edges} | ${st.byTier[1] || 0} | ${st.byTier[2] || 0} | ${st.byTier[3] || 0} | ${st.byTier[4] || 0} | ${st.byStatus.spec || 0} | ${st.byStatus.implied || 0} | ${st.byStatus.candidate || 0} | ${st.byStatus["non-goal"] || 0} |`);
  L.push(``);
  L.push(`| Domain | Phase | Systems | Parts | spec | implied | candidate | Edges in / internal / out | Coupling | Blast radius |`);
  L.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const d of st.domains) L.push(`| [${d.name}](#${d.id}) | ${d.phase ?? "—"} | ${d.systems} | ${d.parts} | ${d.spec} | ${d.implied} | ${d.candidate} | ${d.inbound} / ${d.internal} / ${d.outbound} | ${d.coupling}% | ${d.blast} |`);
  L.push(``);
  L.push(`*Coupling* = share of a domain's edges that cross its border. *Blast radius* = how many systems outside the domain a change inside it can reach.`);
  L.push(``);
  L.push(`## The big picture (tier 1)`);
  L.push(``);
  L.push("```mermaid");
  L.push(renderOverviewMermaid(graph, st));
  L.push("```");
  L.push(``);
  L.push(`## Load-bearing systems (largest blast radius)`);
  L.push(``);
  L.push(`Change these carefully; they reach the most. *Fan-out / fan-in* are direct edges; *blast* is transitive.`);
  L.push(``);
  L.push(`| Tier-2 system | Domain | Status | Blast | Fan-out | Fan-in |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const r of st.topSystems) L.push(`| \`${r.id}\` ${r.name} | ${r.domain} | ${r.status} | ${r.blast} | ${r.fanOut} | ${r.fanIn} |`);
  L.push(``);
  L.push(`| Tier-3+ part | Domain | Status | Blast | Fan-out | Fan-in |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const r of st.topParts) L.push(`| \`${r.id}\` ${r.name} | ${r.domain} | ${r.status} | ${r.blast} | ${r.fanOut} | ${r.fanIn} |`);
  L.push(``);
  L.push(`## DIRECTOR decisions needed (candidate systems)`);
  L.push(``);
  L.push(`These were asked for but are **not in GAME_INFRA_SPEC.md**. Each needs a yes/no/later and, if yes, a spec PR (R10 / §14). Nothing below is built until then.`);
  L.push(``);
  const candByDomain = new Map();
  for (const c of st.candidates) { const k = c.domain; if (!candByDomain.has(k)) candByDomain.set(k, []); candByDomain.get(k).push(c); }
  for (const [dom, list] of candByDomain) {
    L.push(`- **${graph.nodes.get(dom).name}** — ${list.map((c) => `\`${c.id}\`${c.tier <= 2 ? ` (${c.name}${c.children.length ? `, ${c.children.length} parts` : ""})` : ""}`).join(", ")}`);
  }
  if (st.nonGoals.length) {
    L.push(``);
    L.push(`**Non-goals (kept on the map so the boundary is visible):** ${st.nonGoals.map((n) => `\`${n.id}\``).join(", ")}`);
  }
  L.push(``);
  L.push(`## EventBus signals (mechanically derived from the ledger — compare with spec §5)`);
  L.push(``);
  L.push(`| Signal | Status | Emitted by | Listeners |`);
  L.push(`|---|---|---|---|`);
  for (const s of st.signals) L.push(`| \`${s.id.slice(SIGNAL_PREFIX.length)}\` | ${s.status} | ${s.emitters.map((e) => `\`${e}\``).join(", ") || "—"} | ${s.listeners.map((e) => `\`${e}\``).join(", ") || "—"} |`);
  L.push(``);
  L.push(`## Findings from \`validate\``);
  L.push(``);
  if (validation.errors.length) { L.push(`**Errors (${validation.errors.length}):**`); for (const e of validation.errors) L.push(`- ${e}`); L.push(``); }
  if (validation.warnings.length) { L.push(`**Warnings (${validation.warnings.length}) — design questions the ledger surfaced, not typos:**`); for (const w of validation.warnings) L.push(`- ${w}`); L.push(``); }
  for (const i of validation.info) L.push(`- ℹ ${i}`);
  L.push(``);
  L.push(`---`);
  L.push(``);
  L.push(`# Domain pages`);
  L.push(``);
  L.push(`One page per domain: its tree with badges, its tier-2 wiring diagram, the Director decisions inside it, and every edge that crosses its border.`);
  L.push(``);
  st.domains.forEach((d, i) => {
    const n = graph.nodes.get(d.id);
    L.push(`- [${n.name}](./atlas/${domainFile(i, d.id)}) — ${badge(n)} ${n.summary}`);
  });
  L.push(``);
  return L.join("\n") + "\n";
}

export const ATLAS_DIR = "systems/atlas";
export const domainFile = (i, id) => `${String(i).padStart(2, "0")}-${id.replace(/_/g, "-")}.md`;

/** One generated page per tier-1 domain. */
export function renderDomainPage(graph, domainId, { hash = "" } = {}) {
  const n = graph.nodes.get(domainId);
  const L = [];
  L.push(`<!-- GENERATED by scripts/lib/systems-map.mjs render — do not edit; edit systems/registry/*.md and re-run. registry-hash: ${hash} -->`);
  L.push(`# ${n.name} \`${n.id}\``);
  L.push(``);
  L.push(`[← Atlas index](../ATLAS.md) · source: [\`registry/\`](../registry/) · decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md) · ask: \`scripts/systems-map.sh impact <id>\``);
  L.push(``);
  L.push(`${badge(n)} · ${n.summary}`);
  if (n.analogy) L.push(``, `> **Analogy:** ${n.analogy}`);
  L.push(``);
  L.push(`| Where | Spec |`, `|---|---|`, `| ${n.where.map((w) => `\`${w}\``).join(", ") || "—"} | ${n.spec || "—"} |`);
  L.push(``);
  L.push(`## Systems and parts`);
  L.push(``);
  L.push(`Badge = \`[phase][status][owner]\`. Indentation = containment.`);
  L.push(``);
  for (const c of n.children) L.push(...renderTree(graph, c));
  L.push(``);
  L.push(`## Wiring at tier 2`);
  L.push(``);
  L.push(`Boxes inside the frame are this domain's systems; rounded boxes are the outside systems they wire to. Arrow labels count edges; direction is influence (a change at the tail can affect the head).`);
  L.push(``);
  L.push("```mermaid");
  L.push(renderDomainMermaid(graph, domainId));
  L.push("```");
  L.push(``);
  L.push(`## Director decisions in this domain`);
  L.push(``);
  const cands = subtreeIds(graph, domainId).map((id) => graph.nodes.get(id)).filter((x) => x.status === "candidate" && x.kind !== "signal");
  const nonGoals = subtreeIds(graph, domainId).map((id) => graph.nodes.get(id)).filter((x) => x.status === "non-goal");
  if (!cands.length) L.push(`*(none — everything here is in the spec or implied by it)*`);
  else {
    L.push(`| Candidate | Tier | Owner | What it would be |`, `|---|---|---|---|`);
    for (const c of cands) L.push(`| \`${c.id}\` ${c.name} | ${c.tier}${c.children.length ? ` (+${c.children.length} parts)` : ""} | ${c.owner.join("/")} | ${c.summary} |`);
  }
  if (nonGoals.length) L.push(``, `**Non-goals (spec §1):** ${nonGoals.map((x) => `\`${x.id}\` ${x.name}`).join(" · ")}`);
  L.push(``);
  L.push(`## Cross-domain edges`);
  L.push(``);
  const idSet = new Set(subtreeIds(graph, domainId));
  const cross = graph.influence.filter((ie) => idSet.has(ie.src) !== idSet.has(ie.dst));
  if (!cross.length) L.push(`*(none)*`);
  else {
    L.push(`${cross.filter((ie) => idSet.has(ie.src)).length} outbound (a change here reaches out), ${cross.filter((ie) => !idSet.has(ie.src)).length} inbound (a change elsewhere reaches in).`);
    L.push(``);
    L.push(`| Direction | Edge | How | Via | Strength | Why |`, `|---|---|---|---|---|---|`);
    for (const ie of cross) {
      const dir = idSet.has(ie.src) ? "→ out" : "← in";
      L.push(`| ${dir} | \`${ie.src}\` → \`${ie.dst}\` | ${ie.how} | ${ie.via ? `\`${ie.via}\`` : "—"} | ${ie.strength} | ${ie.why} |`);
    }
  }
  L.push(``);
  return L.join("\n") + "\n";
}

/** Every generated file, keyed by repo-relative path. The CLI and the doctor share this. */
export function renderAll(graph, validation, { hash = "", template } = {}) {
  const st = stats(graph);
  const out = new Map();
  out.set(ATLAS_FILE, renderAtlas(graph, validation, { hash }));
  st.domains.forEach((d, i) => out.set(`${ATLAS_DIR}/${domainFile(i, d.id)}`, renderDomainPage(graph, d.id, { hash })));
  out.set(EXPLORER_FILE, renderExplorer(graph, validation, { hash, template }));
  return out;
}

/** Generated files that are missing, differ, or are orphans (a page for a domain that no longer exists). */
export async function staleGenerated(files, root) {
  const stale = [];
  for (const [rel, content] of files) {
    const p = path.resolve(root, rel);
    if (!existsSync(p) || (await fs.readFile(p, "utf8")).replace(/\r\n/g, "\n") !== content) stale.push(rel);
  }
  const atlasDir = path.resolve(root, ATLAS_DIR);
  if (existsSync(atlasDir)) {
    for (const f of await fs.readdir(atlasDir)) if (f.endsWith(".md") && !files.has(`${ATLAS_DIR}/${f}`)) stale.push(`${ATLAS_DIR}/${f} (orphan)`);
  }
  return stale;
}

export function atlasJson(graph, validation, { hash = "" } = {}) {
  const st = stats(graph);
  return {
    hash,
    nodes: [...graph.nodes.values()].map((n) => ({
      id: n.id, name: n.name, tier: n.tier, parent: n.parent, phase: n.phase, status: n.status, owner: n.owner,
      where: n.where, spec: n.spec, summary: n.summary, analogy: n.analogy, kind: n.kind, domain: n.domain,
      children: n.children, blast: blastRadius(graph, n.id),
    })),
    edges: graph.influence.map((ie) => ({ src: ie.src, dst: ie.dst, how: ie.how, via: ie.via, strength: ie.strength, why: ie.why })),
    domains: st.domains,
    hows: HOWS,
    findings: { errors: validation.errors, warnings: validation.warnings, info: validation.info },
  };
}

export function renderExplorer(graph, validation, { hash = "", template } = {}) {
  const tpl = template ?? readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "systems-explorer.template.html"), "utf8");
  const json = JSON.stringify(atlasJson(graph, validation, { hash })).replace(/<\/script/gi, "<\\/script");
  return tpl.replace("/*__ATLAS_JSON__*/null", json).split("__REGISTRY_HASH__").join(hash);
}

// ── Event log (Rule 22 trace for queries) ───────────────────────────────────

async function trace(eventType, fields) {
  try {
    const lib = await import("../hooks/_lib.mjs");
    lib.appendEvent(lib.mechanicalRecord(eventType, { session_id: process.env.CLAUDE_SESSION_ID || "cli", ...fields }));
  } catch { /* the trace never blocks the answer */ }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (["depth", "phase", "registry", "spec", "out"].includes(k)) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { cmd: pos[0], args: pos.slice(1), flags };
}

const USAGE = `systems-map — the EMBER systems atlas (ADR-0065)

  validate                     check the registry; exit 1 on errors (design warnings listed)
  affects <id>                 everything a change in <id> can reach (downstream), with how/where/why
  affected-by <id>             everything that can reach <id> (upstream)
  impact <id>                  PR-ready report: both directions + review checklist
  show <id>                    one system's card: parts, direct in/out edges
  tree [id] [--depth N]        the containment hierarchy with badges
  find <text>                  search ids, names, summaries, paths
  stats                        counts, load-bearing systems, DIRECTOR decisions, signals
  render [--check]             write systems/ATLAS.md + systems/explorer.html (--check: fail if stale)

  flags: --depth N  --phase N (hide systems that land after phase N)  --no-expand (do not include contained parts)
         --no-candidates  --json  --registry <dir>  --spec <file>`;

export async function loadAll({ registryDir = DEFAULT_REGISTRY_DIR, specFile = DEFAULT_SPEC_FILE, root = process.cwd() } = {}) {
  const dir = path.resolve(root, registryDir || DEFAULT_REGISTRY_DIR);
  if (!existsSync(dir)) throw new Error(`registry dir not found: ${dir}`);
  const registry = await loadRegistry(dir);
  const graph = buildGraph(registry);
  const specPath = path.resolve(root, specFile || DEFAULT_SPEC_FILE);
  const specText = existsSync(specPath) ? await fs.readFile(specPath, "utf8") : null;
  const validation = validate(registry, graph, { specText });
  return { registry, graph, validation, hash: contentHash(registry), specText };
}

async function main() {
  const { cmd, args, flags } = parseArgs(process.argv.slice(2));
  if (!cmd || flags.help) { console.log(USAGE); process.exit(cmd ? 0 : 1); }
  const root = process.cwd();
  const { graph, validation, hash } = await loadAll({ registryDir: flags.registry, specFile: flags.spec, root });
  const opts = {
    depth: flags.depth ? Number(flags.depth) : Infinity,
    expand: !flags["no-expand"],
    phase: flags.phase != null ? Number(flags.phase) : null,
    candidates: !flags["no-candidates"],
  };
  const printValidation = () => {
    for (const e of validation.errors) console.log(`  ✗ ${e}`);
    for (const w of validation.warnings) console.log(`  ! ${w}`);
    for (const i of validation.info) console.log(`  ℹ ${i}`);
    console.log(`\n${validation.errors.length} error(s), ${validation.warnings.length} warning(s) · ${graph.nodes.size} nodes · ${graph.influence.length} edges · registry ${hash}`);
  };

  switch (cmd) {
    case "validate": {
      if (flags.json) console.log(JSON.stringify({ ...validation, nodes: graph.nodes.size, edges: graph.influence.length, hash }, null, 2));
      else printValidation();
      process.exit(validation.ok ? 0 : 1);
    }
    // eslint-disable-next-line no-fallthrough
    case "affects":
    case "affected-by": {
      const id = args[0];
      if (!id) { console.error(`usage: ${cmd} <id>`); process.exit(1); }
      const r = cmd === "affects" ? affects(graph, id, opts) : affectedBy(graph, id, opts);
      await trace("systems_impact_query", { query: cmd, system: id, hits: r.hits.length });
      if (flags.json) console.log(JSON.stringify({ id, direction: cmd, hits: r.hits.map((h) => ({ id: h.id, depth: h.depth, how: h.edge.how, via: h.edge.via, strength: h.edge.strength, why: h.edge.why, src: h.edge.src, dst: h.edge.dst })) }, null, 2));
      else console.log(renderReach(graph, id, r, cmd === "affects" ? "out" : "in"));
      break;
    }
    case "impact": {
      const id = args[0];
      if (!id) { console.error("usage: impact <id>"); process.exit(1); }
      const text = impactReport(graph, id, opts);
      await trace("systems_impact_query", { query: "impact", system: id, downstream: affects(graph, id, opts).hits.length, upstream: affectedBy(graph, id, opts).hits.length });
      console.log(text);
      break;
    }
    case "show": {
      const id = args[0];
      if (!id) { console.error("usage: show <id>"); process.exit(1); }
      console.log(nodeCard(graph, id));
      break;
    }
    case "tree": {
      const depthLimit = flags.depth ? Number(flags.depth) : 99;
      const roots = args[0] ? [args[0]] : [...graph.nodes.values()].filter((n) => n.tier === 1).map((n) => n.id);
      for (const r of roots) { if (!graph.nodes.has(r)) { console.error(`unknown id: ${r}`); process.exit(1); } console.log(renderTree(graph, r, depthLimit).join("\n")); }
      break;
    }
    case "find": {
      const q = args.join(" ").toLowerCase();
      if (!q) { console.error("usage: find <text>"); process.exit(1); }
      const hits = [...graph.nodes.values()].filter((n) => [n.id, n.name, n.summary, n.analogy, ...n.where].join(" ").toLowerCase().includes(q));
      for (const n of hits) console.log(`${n.id.padEnd(34)} ${badge(n).padEnd(36)} ${pathOf(graph, n.id)} › ${n.name} — ${n.summary}`);
      console.log(`\n${hits.length} match(es)`);
      break;
    }
    case "stats": {
      const st = stats(graph);
      if (flags.json) { console.log(JSON.stringify(st, null, 2)); break; }
      console.log(`nodes ${st.nodes} · edges ${st.edges} · tiers ${JSON.stringify(st.byTier)} · status ${JSON.stringify(st.byStatus)}\n`);
      console.log("domain".padEnd(22) + "phase  sys  parts  spec impl cand  in/int/out   coupling  blast");
      for (const d of st.domains) console.log(`${d.id.padEnd(22)}${String(d.phase ?? "—").padEnd(7)}${String(d.systems).padEnd(5)}${String(d.parts).padEnd(7)}${String(d.spec).padEnd(5)}${String(d.implied).padEnd(5)}${String(d.candidate).padEnd(6)}${`${d.inbound}/${d.internal}/${d.outbound}`.padEnd(13)}${(d.coupling + "%").padEnd(10)}${d.blast}`);
      console.log("\nload-bearing tier-2 systems (blast / fan-out / fan-in):");
      for (const r of st.topSystems) console.log(`  ${r.id.padEnd(30)} ${String(r.blast).padStart(4)} ${String(r.fanOut).padStart(4)} ${String(r.fanIn).padStart(4)}   ${r.domain}`);
      console.log("\nload-bearing tier-3+ parts:");
      for (const r of st.topParts) console.log(`  ${r.id.padEnd(30)} ${String(r.blast).padStart(4)} ${String(r.fanOut).padStart(4)} ${String(r.fanIn).padStart(4)}   ${r.domain}`);
      console.log(`\nDIRECTOR decisions (candidate systems): ${st.candidates.length}`);
      console.log(`signals: ${st.signals.length} (${st.signals.filter((s) => s.status === "spec").length} in spec §5, ${st.signals.filter((s) => s.status !== "spec").length} proposed)`);
      break;
    }
    case "render": {
      const files = renderAll(graph, validation, { hash });
      if (flags.check) {
        const stale = await staleGenerated(files, root);
        if (stale.length) { console.error(`stale generated file(s): ${stale.join(", ")} — run: node scripts/lib/systems-map.mjs render`); process.exit(1); }
        console.log(`generated files are current (${files.size})`);
        break;
      }
      for (const [rel, content] of files) { const p = path.resolve(root, rel); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, content, "utf8"); console.log(`wrote ${rel} (${content.length} bytes)`); }
      const atlasDir = path.resolve(root, ATLAS_DIR);
      for (const f of await fs.readdir(atlasDir)) if (f.endsWith(".md") && !files.has(`${ATLAS_DIR}/${f}`)) { await fs.unlink(path.join(atlasDir, f)); console.log(`removed orphan ${ATLAS_DIR}/${f}`); }
      printValidation();
      process.exit(validation.ok ? 0 : 1);
    }
    default:
      console.error(`unknown command: ${cmd}\n\n${USAGE}`);
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
}
