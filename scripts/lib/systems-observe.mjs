#!/usr/bin/env node
// Declared versus observed (ADR-0067).
//
// The registry DECLARES how systems depend on each other. Once game code exists,
// the code and the content files SHOW how they actually depend on each other:
// which EventBus signals are emitted and connected, which scripts preload which,
// which .tres defs reference which ids and paths. This module extracts those
// facts from a Godot project, maps every file to its owning system through the
// registry's Where paths, and reports the difference:
//
//   - observed dependencies the ledger does not declare  (add the edge, or fix the code)
//   - declared signal wiring not yet seen in code         (fine early; stale later)
//   - signals declared in code, in the registry and in spec §5 that disagree
//   - architecture rule violations from GAME_INFRA_SPEC.md §4, as fitness checks:
//       R2  a core/ subsystem reaching into another core/ subsystem by preload,
//           class use or node path instead of the EventBus (a declared `calls`
//           edge or core/util/ helpers are the allowed exceptions)
//       R4  global RNG or wall-clock time inside core/
//       R5  presentation (ui/, art/, audio/, actor animation and camera) emitting
//           gameplay signals
//       R6  functions without typed parameters, a return type and a `##` docstring
//       R3  binary files outside art/ and audio/
//
// A line may carry an explicit, reviewable exception:  # atlas: allow R4 — reason
// The reason is mandatory; an allow without one is still a violation.
//
// Everything here is regex-level static analysis of GDScript and Godot text
// resources — deliberately simple, zero dependencies, and fast. It will miss
// dynamic patterns (get_node with computed paths, call_deferred by string); it
// never edits anything. Suggested `add-edge` commands are printed, not applied.

import path from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { whichSystems, subtreeIds, SIGNAL_PREFIX } from "./systems-map.mjs";

export const GAME_DIRS = ["core", "data", "scenes", "actors", "ui", "art", "audio", "tests", "tools", "server"];
export const PRESENTATION_PREFIXES = ["ui/", "art/", "audio/"];
export const PRESENTATION_ACTOR_RE = /^actors\/.*\/(anim|camera|vfx|sfx)[^/]*\//;
export const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".glb", ".gltf", ".fbx", ".obj", ".blend", ".ogg", ".wav", ".mp3", ".ttf", ".otf", ".zip", ".pck", ".exe", ".dll", ".so", ".dylib", ".bin"]);
export const ENGINE_CALLBACKS = new Set(["_ready", "_process", "_physics_process", "_input", "_unhandled_input", "_enter_tree", "_exit_tree", "_init", "_notification", "_draw", "_gui_input", "_to_string", "_get_configuration_warnings"]);
export const RULES = Object.freeze({
  R2: "systems communicate only through the EventBus (spec §4 R2)",
  R3: "plain text everywhere except art/ and audio/ (spec §4 R3)",
  R4: "deterministic simulation: seeded RNG passed in, no wall clock in core/ (spec §4 R4)",
  R5: "presentation reads state and reacts to events; it never mutates or emits gameplay (spec §4 R5)",
  R6: "static typing and a one-line docstring on every function (spec §4 R6)",
});

const isSignal = (id) => String(id).startsWith(SIGNAL_PREFIX);
// Global RNG functions only: `rng.randf_range(...)` on a seeded RandomNumberGenerator is the compliant form.
const RNG_GLOBALS = /(?<![.\w])(randf|randi|randf_range|randi_range|randfn|randomize|rand_from_seed)\s*\(/;
const WALL_CLOCK = /\b(Time\.get_(?:ticks_msec|ticks_usec|unix_time_from_system|datetime_dict_from_system|time_dict_from_system|date_dict_from_system|datetime_string_from_system)|OS\.get_(?:ticks_msec|ticks_usec|unix_time|system_time_msecs))\s*\(/;
const ALLOW_RE = /#\s*atlas:\s*allow\s+(R[0-9]+)\s*(?:[—–:-]\s*(.*))?$/i;

/** Where the Godot project root sits: `game/` when it has a project.godot, else the repo root. */
export function godotRoot(root) {
  return existsSync(path.join(root, "game", "project.godot")) ? path.join(root, "game") : root;
}

export function hasGameCode(root) {
  const g = godotRoot(root);
  return GAME_DIRS.some((d) => existsSync(path.join(g, d)));
}

/** Walk the game dirs; return text files (.gd/.tres/.tscn/.cfg/.godot) with contents and every other path with its extension. */
export async function scanProject(root, { dirs = GAME_DIRS } = {}) {
  const g = godotRoot(root);
  const files = [];
  const others = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "addons" || e.name === "node_modules") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(full); continue; }
      const rel = path.relative(g, full).split(path.sep).join("/");
      const ext = path.extname(e.name).toLowerCase();
      if ([".gd", ".tres", ".tscn", ".cfg", ".godot"].includes(ext)) files.push({ rel, ext, text: await fs.readFile(full, "utf8") });
      else others.push({ rel, ext });
    }
  }
  for (const d of dirs) await walk(path.join(g, d));
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  others.sort((a, b) => a.rel.localeCompare(b.rel));
  return { godotRoot: g, files, others };
}

const resToRel = (p) => String(p).replace(/^res:\/\//, "").replace(/^\.\//, "");

/** Facts from one GDScript file. */
export function extractGd(rel, text) {
  const lines = text.split(/\r?\n/);
  const f = { rel, kind: "gd", classNameDeclared: null, extendsPath: null, signals: [], emits: [], listens: [], preloads: [], classUses: [], nodePaths: [], rng: [], wallClock: [], funcs: [], allows: [] };
  lines.forEach((raw, i) => {
    const line = i + 1;
    const code = raw.replace(/(^|[^"'])#.*$/, "$1").trimEnd(); // strip comments (naive: no # inside strings after the first quote)
    const allow = raw.match(ALLOW_RE);
    if (allow) f.allows.push({ line, rule: allow[1].toUpperCase(), reason: (allow[2] || "").trim() });
    let m;
    if ((m = code.match(/^\s*class_name\s+([A-Za-z_][A-Za-z0-9_]*)/))) f.classNameDeclared = m[1];
    if ((m = code.match(/^\s*extends\s+"?(res:\/\/[^"\s]+)"?/))) f.extendsPath = resToRel(m[1]);
    if ((m = code.match(/^\s*signal\s+([a-z_][a-z0-9_]*)/))) f.signals.push({ name: m[1], line });
    for (const mm of code.matchAll(/EventBus\.([a-z_][a-z0-9_]*)\.emit\s*\(/g)) f.emits.push({ signal: mm[1], line });
    for (const mm of code.matchAll(/EventBus\.emit_signal\s*\(\s*"([a-z_][a-z0-9_]*)"/g)) f.emits.push({ signal: mm[1], line });
    for (const mm of code.matchAll(/EventBus\.([a-z_][a-z0-9_]*)\.connect\s*\(/g)) f.listens.push({ signal: mm[1], line });
    for (const mm of code.matchAll(/EventBus\.connect\s*\(\s*"([a-z_][a-z0-9_]*)"/g)) f.listens.push({ signal: mm[1], line });
    for (const mm of code.matchAll(/\b(?:preload|load)\s*\(\s*"(res:\/\/[^"]+)"\s*\)/g)) f.preloads.push({ path: resToRel(mm[1]), line });
    for (const mm of code.matchAll(/\bget_node\s*\(\s*"(\/root\/[^"]+)"/g)) f.nodePaths.push({ path: mm[1], line });
    for (const mm of code.matchAll(/\b([A-Z][A-Za-z0-9]+)\.(?:[a-z_][A-Za-z0-9_]*)\s*\(/g)) f.classUses.push({ name: mm[1], line });
    if ((m = code.match(RNG_GLOBALS))) f.rng.push({ line, call: m[1] });
    if ((m = code.match(WALL_CLOCK))) f.wallClock.push({ line, call: m[1] });
    if ((m = code.match(/^\s*(?:static\s+)?func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(->\s*[A-Za-z_][A-Za-z0-9_.\[\]]*)?\s*:/))) {
      const name = m[1];
      const params = m[2].trim();
      const untypedParams = params ? params.split(",").map((p) => p.trim()).filter((p) => p && !/:\s*[A-Za-z_]/.test(p) && !/:=/.test(p)) : [];
      let j = i - 1;
      while (j >= 0 && /^\s*@/.test(lines[j])) j--; // skip annotations
      const docstring = j >= 0 && /^\s*##/.test(lines[j]);
      f.funcs.push({ name, line, untypedParams, hasReturn: Boolean(m[3]), docstring, callback: ENGINE_CALLBACKS.has(name) });
    }
  });
  return f;
}

/** Facts from a .tres / .tscn text resource. */
export function extractResource(rel, text) {
  const f = { rel, kind: rel.endsWith(".tscn") ? "tscn" : "tres", id: null, scriptPath: null, extResources: [], pathRefs: [], idRefs: [] };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    let m;
    if ((m = raw.match(/^\[ext_resource\b([^\]]*)\]/))) {
      const attrs = m[1];
      const p = attrs.match(/path="([^"]+)"/);
      const t = attrs.match(/type="([^"]+)"/);
      if (p) { const rp = resToRel(p[1]); f.extResources.push({ path: rp, type: t ? t[1] : "", line }); if (t && t[1] === "Script" && !f.scriptPath) f.scriptPath = rp; }
      return;
    }
    if ((m = raw.match(/^id\s*=\s*"([a-z][a-z0-9_]*)"\s*$/))) { f.id = m[1]; return; }
    for (const mm of raw.matchAll(/"(res:\/\/[^"]+)"/g)) f.pathRefs.push({ path: resToRel(mm[1]), line });
    if ((m = raw.match(/^([a-z_][a-z0-9_]*)\s*=\s*"([a-z]+_[a-z0-9_]+)"\s*$/)) && m[1] !== "id") f.idRefs.push({ field: m[1], id: m[2], line });
    for (const mm of raw.matchAll(/"item_id"\s*:\s*"([a-z]+_[a-z0-9_]+)"|"effect_id"\s*:\s*"([a-z]+_[a-z0-9_]+)"|"target_id"\s*:\s*"([a-z]+_[a-z0-9_]+)"/g)) f.idRefs.push({ field: "entry", id: mm[1] || mm[2] || mm[3], line });
  });
  return f;
}

export function extractAll(scan) {
  return scan.files.map((file) => (file.ext === ".gd" ? extractGd(file.rel, file.text) : [".tres", ".tscn"].includes(file.ext) ? extractResource(file.rel, file.text) : { rel: file.rel, kind: "other" }));
}

const coreSubsystem = (rel) => { const m = rel.match(/^core\/([^/]+)\//); return m ? m[1] : null; };
const isPresentation = (rel) => PRESENTATION_PREFIXES.some((p) => rel.startsWith(p)) || PRESENTATION_ACTOR_RE.test(rel);

/**
 * Compare observed facts with the registry graph. `specSignals` (a Set of §5 names) is optional.
 */
export function observe(graph, scan, facts, { specSignals = null } = {}) {
  const owner = new Map(); // rel -> primary system id or null
  const unowned = [];
  const sysOf = (rel) => {
    if (owner.has(rel)) return owner.get(rel);
    const m = whichSystems(graph, rel);
    const id = m.primary[0]?.id || null;
    owner.set(rel, id);
    return id;
  };
  const family = (id) => { const n = graph.nodes.get(id); return new Set([id, ...subtreeIds(graph, id), ...(n ? n.ancestors : [])]); };
  const related = (a, b) => a === b || family(a).has(b) || family(b).has(a);
  const declaredBetween = (a, b) => graph.registry.edges.filter((e) => (family(a).has(e.from) && family(b).has(e.to)));
  const declaredSignal = (a, how, sig) => graph.registry.edges.some((e) => e.how === how && e.to === `${SIGNAL_PREFIX}${sig}` && family(a).has(e.from));

  const classFiles = new Map(); // ClassName -> rel
  const idFiles = new Map(); // content id -> rel
  for (const f of facts) {
    if (f.kind === "gd" && f.classNameDeclared) classFiles.set(f.classNameDeclared, f.rel);
    if ((f.kind === "tres" || f.kind === "tscn") && f.id) idFiles.set(f.id, f.rel);
  }
  for (const f of facts) if (!sysOf(f.rel)) unowned.push(f.rel);

  const edges = new Map(); // key -> observed edge
  const addEdge = (src, dst, how, via, file, line) => {
    if (!src || !dst || related(src, dst)) return;
    const key = `${src}|${how}|${dst}`;
    if (!edges.has(key)) edges.set(key, { src, dst, how, via, evidence: [], declared: false, declaredHow: [] });
    const e = edges.get(key);
    e.evidence.push({ file, line });
    if (via && !e.via) e.via = via;
  };
  const signalsInCode = new Set();
  const emitsObserved = new Set(); // "sys|signal"
  const listensObserved = new Set();
  const violations = [];
  const violate = (rule, f, line, message) => {
    const allow = f.allows?.find((a) => a.rule === rule && (a.line === line || a.line === line - 1));
    if (allow && allow.reason) violations.push({ rule, file: f.rel, line, message, allowed: true, reason: allow.reason });
    else if (allow) violations.push({ rule, file: f.rel, line, message: `${message} — an "atlas: allow ${rule}" needs a reason after a dash`, allowed: false });
    else violations.push({ rule, file: f.rel, line, message, allowed: false });
  };

  for (const f of facts) {
    const sys = sysOf(f.rel);
    if (f.kind === "gd") {
      const inCore = f.rel.startsWith("core/");
      const sub = coreSubsystem(f.rel);
      for (const s of f.signals) if (f.rel.includes("event_bus")) signalsInCode.add(s.name);
      for (const e of f.emits) {
        if (sys) { emitsObserved.add(`${sys}|${e.signal}`); if (!declaredSignal(sys, "emits", e.signal)) addEdge(sys, `${SIGNAL_PREFIX}${e.signal}`, "emits", null, f.rel, e.line); }
        if (isPresentation(f.rel)) violate("R5", f, e.line, `presentation emits gameplay signal \`${e.signal}\` — presentation reacts to events, it never emits them`);
      }
      for (const l of f.listens) { if (sys) { listensObserved.add(`${sys}|${l.signal}`); if (!declaredSignal(sys, "listens", l.signal)) addEdge(sys, `${SIGNAL_PREFIX}${l.signal}`, "listens", null, f.rel, l.line); } }
      const deps = [...f.preloads.map((p) => ({ rel: p.path, line: p.line, kind: "preload" })), ...(f.extendsPath ? [{ rel: f.extendsPath, line: 1, kind: "extends" }] : [])];
      for (const u of f.classUses) { const target = classFiles.get(u.name); if (target && target !== f.rel) deps.push({ rel: target, line: u.line, kind: `class ${u.name}` }); }
      for (const d of deps) {
        const tsys = sysOf(d.rel);
        if (tsys && sys && !related(sys, tsys)) addEdge(sys, tsys, d.rel.startsWith("data/") ? "reads" : "calls", d.kind, f.rel, d.line);
        const tsub = coreSubsystem(d.rel);
        if (inCore && sub && tsub && sub !== tsub && tsub !== "util" && tsub !== "events" && tsub !== "schemas") {
          const declaredCalls = sys && tsys ? declaredBetween(sys, tsys).some((e) => e.how === "calls") : false;
          if (!declaredCalls) violate("R2", f, d.line, `core/${sub} reaches into core/${tsub} by ${d.kind} (${d.rel}) — route through the EventBus or a command intent, or declare a reviewed \`calls\` edge`);
        }
      }
      for (const n of f.nodePaths) if (inCore) violate("R2", f, n.line, `core/ code addresses another system by node path ${n.path} — reference actors by id (§12) and talk through the EventBus`);
      if (inCore && !f.rel.startsWith("core/util/") && !f.rel.startsWith("core/debug/")) {
        for (const r of f.rng) violate("R4", f, r.line, `global RNG \`${r.call}()\` inside core/ — take a seeded RandomNumberGenerator as a parameter`);
        for (const w of f.wallClock) violate("R4", f, w.line, `wall clock \`${w.call}()\` inside core/ — simulation time is the fixed tick`);
      }
      for (const fn of f.funcs) {
        if (fn.callback) continue;
        if (fn.untypedParams.length) violate("R6", f, fn.line, `\`${fn.name}\` has untyped parameter(s): ${fn.untypedParams.join(", ")}`);
        if (!fn.hasReturn) violate("R6", f, fn.line, `\`${fn.name}\` has no return type (use \`-> void\` when it returns nothing)`);
        if (!fn.docstring) violate("R6", f, fn.line, `\`${fn.name}\` has no \`##\` docstring line above it`);
      }
    } else if (f.kind === "tres" || f.kind === "tscn") {
      for (const r of f.extResources) { const tsys = sysOf(r.path); if (tsys && sys) addEdge(sys, tsys, r.type === "Script" ? "reads" : "references", `ext_resource ${r.type || ""}`.trim(), f.rel, r.line); }
      for (const p of f.pathRefs) { const tsys = sysOf(p.path); if (tsys && sys) addEdge(sys, tsys, "references", "path", f.rel, p.line); }
      for (const i of f.idRefs) { const target = idFiles.get(i.id); if (!target) continue; const tsys = sysOf(target); if (tsys && sys) addEdge(sys, tsys, "references", i.field, f.rel, i.line); }
    }
  }
  for (const o of scan.others) {
    if (BINARY_EXT.has(o.ext) && !o.rel.startsWith("art/") && !o.rel.startsWith("audio/")) violations.push({ rule: "R3", file: o.rel, line: 0, message: `binary file outside art/ and audio/ (${o.ext})`, allowed: false });
  }

  // declared vs observed
  for (const e of edges.values()) {
    const decl = isSignal(e.dst) ? [] : declaredBetween(e.src, e.dst);
    e.declared = decl.length > 0;
    e.declaredHow = [...new Set(decl.map((d) => d.how))];
  }
  const undeclared = [...edges.values()].filter((e) => !e.declared).map((e) => ({
    ...e,
    suggest: isSignal(e.dst)
      ? `scripts/systems-map.sh add-edge --from ${e.src} --how ${e.how} --to ${e.dst} --why "<observed in ${e.evidence[0].file}:${e.evidence[0].line}>"`
      : `scripts/systems-map.sh add-edge --from ${e.src} --how ${e.how} --to ${e.dst}${e.via ? ` --via "${e.via}"` : ""} --strength hard --why "<observed in ${e.evidence[0].file}:${e.evidence[0].line}>"`,
  }));
  const codedSystems = new Set(facts.filter((f) => f.kind === "gd").map((f) => sysOf(f.rel)).filter(Boolean));
  const unobserved = [];
  for (const e of graph.registry.edges) {
    if (e.how !== "emits" && e.how !== "listens") continue;
    const sig = e.to.slice(SIGNAL_PREFIX.length);
    const fam = family(e.from);
    if (![...fam].some((x) => codedSystems.has(x))) continue; // no code for that system yet
    const seen = e.how === "emits" ? emitsObserved : listensObserved;
    if (![...fam].some((x) => seen.has(`${x}|${sig}`))) unobserved.push({ from: e.from, how: e.how, signal: sig, file: e.file, line: e.line });
  }
  const registrySignals = new Set([...graph.nodes.values()].filter((n) => n.kind === "signal").map((n) => n.id.slice(SIGNAL_PREFIX.length)));
  const busFileSeen = facts.some((f) => f.kind === "gd" && f.rel.includes("event_bus") && f.signals.length);
  const signals = {
    inCode: [...signalsInCode].sort(),
    onlyInCode: busFileSeen ? [...signalsInCode].filter((s) => !registrySignals.has(s)).sort() : [],
    onlyInRegistry: busFileSeen ? [...registrySignals].filter((s) => !signalsInCode.has(s)).sort() : [],
    onlyInSpec: specSignals && busFileSeen ? [...specSignals].filter((s) => !signalsInCode.has(s)).sort() : [],
  };
  const real = violations.filter((v) => !v.allowed);
  return {
    godotRoot: scan.godotRoot,
    files: facts.length, unowned, edges: [...edges.values()], undeclared, unobserved, signals, violations,
    counts: { files: facts.length, unowned: unowned.length, observed: edges.size, undeclared: undeclared.length, unobserved: unobserved.length, violations: real.length, allowed: violations.length - real.length, byRule: Object.fromEntries(Object.keys(RULES).map((r) => [r, real.filter((v) => v.rule === r).length])) },
    strictFail: real.length > 0 || undeclared.length > 0 || signals.onlyInCode.length > 0,
  };
}

export async function observeProject(root, graph, { specSignals = null } = {}) {
  const scan = await scanProject(root);
  return observe(graph, scan, extractAll(scan), { specSignals });
}

export function renderObserve(o) {
  const L = [];
  L.push(`# Declared versus observed — ${o.counts.files} game file(s) under ${o.godotRoot}`);
  L.push(`observed dependencies ${o.counts.observed} · undeclared ${o.counts.undeclared} · declared-but-unseen signal wiring ${o.counts.unobserved} · rule violations ${o.counts.violations} (${Object.entries(o.counts.byRule).filter(([, n]) => n).map(([r, n]) => `${r} ${n}`).join(", ") || "none"}) · allowed exceptions ${o.counts.allowed} · unowned files ${o.counts.unowned}`);
  if (o.counts.files === 0) { L.push(``, `No game code yet — nothing to compare. This check becomes live the moment \`core/\`, \`data/\` or \`scenes/\` exist.`); return L.join("\n"); }
  const real = o.violations.filter((v) => !v.allowed);
  L.push(``, `## Rule violations (${real.length})`);
  if (!real.length) L.push(`- none`);
  for (const v of real) L.push(`- **${v.rule}** \`${v.file}:${v.line}\` — ${v.message}`);
  const allowed = o.violations.filter((v) => v.allowed);
  if (allowed.length) { L.push(``, `## Allowed exceptions (${allowed.length}) — each carries a reason in the code`); for (const v of allowed) L.push(`- ${v.rule} \`${v.file}:${v.line}\` — ${v.reason}`); }
  L.push(``, `## Observed but undeclared (${o.undeclared.length}) — add the edge or change the code`);
  if (!o.undeclared.length) L.push(`- none`);
  for (const e of o.undeclared) L.push(`- \`${e.src}\` ${e.how} \`${e.dst}\`${e.via ? ` via ${e.via}` : ""} — seen at ${e.evidence.slice(0, 3).map((x) => `\`${x.file}:${x.line}\``).join(", ")}${e.evidence.length > 3 ? ` +${e.evidence.length - 3}` : ""}\n  \`${e.suggest}\``);
  L.push(``, `## Declared signal wiring not yet seen in code (${o.unobserved.length})`);
  if (!o.unobserved.length) L.push(`- none`);
  for (const u of o.unobserved) L.push(`- \`${u.from}\` ${u.how} \`${u.signal}\` (${u.file}:${u.line}) — the system has code but the ${u.how === "emits" ? "emit" : "connect"} is not there`);
  L.push(``, `## Signals — code vs registry vs spec §5`);
  L.push(`- declared in code: ${o.signals.inCode.length ? o.signals.inCode.map((s) => `\`${s}\``).join(", ") : "(no event_bus.gd with signals found)"}`);
  if (o.signals.onlyInCode.length) L.push(`- **only in code** (undeclared in the registry — R-EB1): ${o.signals.onlyInCode.map((s) => `\`${s}\``).join(", ")}`);
  if (o.signals.onlyInRegistry.length) L.push(`- in the registry, not yet in code: ${o.signals.onlyInRegistry.map((s) => `\`${s}\``).join(", ")}`);
  if (o.signals.onlyInSpec.length) L.push(`- in spec §5, not yet in code: ${o.signals.onlyInSpec.map((s) => `\`${s}\``).join(", ")}`);
  if (o.unowned.length) { L.push(``, `## Files no system owns (${o.unowned.length}) — add a node or fix a Where`); for (const f of o.unowned.slice(0, 30)) L.push(`- \`${f}\``); if (o.unowned.length > 30) L.push(`- … +${o.unowned.length - 30}`); }
  L.push(``, `## Observed dependencies (${o.edges.length})`);
  for (const e of o.edges) L.push(`- \`${e.src}\` ${e.how} \`${e.dst}\`${e.via ? ` via ${e.via}` : ""} — ${e.declared ? `declared (${e.declaredHow.join("/")})` : "**undeclared**"} · ${e.evidence.length} site(s)`);
  return L.join("\n");
}
