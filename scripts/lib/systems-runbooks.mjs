#!/usr/bin/env node
// Change runbooks for the EMBER systems atlas (ADR-0066).
//
// The atlas answers "what moves when I change X?". A runbook turns that answer
// into a procedure an agent can execute: which artifact to create, update,
// delete or check, in which system, in what order, verified by what. Runbooks
// are curated (a person or an agent writes them) but they are VALIDATED against
// the registry, which is what keeps them honest:
//
//   - every system id a runbook names must exist in the registry;
//   - every direct hard-downstream system of the runbook's Primary system must
//     appear as a step OR under "Not touched" with a reason. A runbook that
//     silently skips a system the map says is affected fails the check.
//
// Format — one file per runbook under systems/runbooks/<name>.md:
//
//   # rb_add_item — Add an item
//
//   ## Runbook
//   | Field | Value |
//   |---|---|
//   | Trigger | when this procedure applies |
//   | Primary | items |                         (a registry id)
//   | Roles | content-smith; world-builder |    (spec §7.1 roles)
//   | Director | none | or the decision the Director must make first
//   | Spec | §6.1, §11 |
//   | Not touched | equipment: only when slot != none (see step 6); ... |
//
//   ## Steps
//   | # | Action | System | Artifact | Verify | Note |
//   |---|---|---|---|---|---|
//   | 1 | create | items | data/_inbox/<id>.json | tools/json_to_tres.gd | ... |
//
// Action vocabulary: create · update · delete · check · run · decide.
// A `decide` step is a DIRECTOR stop and may leave System empty.

import path from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { findTable, affects, subtreeIds, OWNERS } from "./systems-map.mjs";

export const RUNBOOK_DIR = "systems/runbooks";
export const RUNBOOK_PREFIX = "rb_";
export const ACTIONS = ["create", "update", "delete", "check", "run", "decide"];
export const STEP_COLUMNS = ["#", "action", "system", "artifact", "verify", "note"];
export const META_FIELDS = ["trigger", "primary", "roles", "director", "spec", "not touched"];

const DASH = new Set(["", "—", "-", "–", "n/a", "none"]);
const isDash = (s) => DASH.has(String(s ?? "").trim().toLowerCase());
const isSignal = (id) => String(id).startsWith("sig_");

function parseNotTouched(value) {
  if (isDash(value)) return [];
  return value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf(":");
      if (i < 0) return { system: entry.trim(), reason: "" };
      return { system: entry.slice(0, i).trim(), reason: entry.slice(i + 1).trim() };
    });
}

/** Parse one runbook file's text. Never throws; problems are collected. */
export function parseRunbookText(text, file = "<memory>") {
  const problems = [];
  const lines = String(text).split(/\r?\n/);
  const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  const title = titleIdx >= 0 ? lines[titleIdx].replace(/^#\s+/, "").trim() : "";
  const m = title.match(/^(rb_[a-z0-9_]+)\s+[—–-]+\s+(.+)$/);
  const id = m ? m[1] : (title.split(/\s+/)[0] || "");
  const name = m ? m[2].trim() : title;
  if (!m) problems.push(`${file}:${Math.max(titleIdx, 0) + 1}: title must read "# rb_<name> — <Title>"`);

  const meta = { trigger: "", primary: "", roles: [], director: "", spec: "", notTouched: [] };
  const mt = findTable(text, "Runbook");
  if (!mt) problems.push(`${file}: no \`## Runbook\` table`);
  else {
    for (const r of mt.rows) {
      const k = (r.cells[0] || "").trim().toLowerCase();
      const v = (r.cells[1] || "").trim();
      if (k === "trigger") meta.trigger = isDash(v) ? "" : v;
      else if (k === "primary") meta.primary = isDash(v) ? "" : v;
      else if (k === "roles") meta.roles = isDash(v) ? [] : v.split(/[;,/]/).map((s) => s.trim()).filter(Boolean);
      else if (k === "director") meta.director = isDash(v) ? "" : v;
      else if (k === "spec") meta.spec = isDash(v) ? "" : v;
      else if (k === "not touched") meta.notTouched = parseNotTouched(v);
      else problems.push(`${file}:${r.line}: unknown runbook field "${k}" (allowed: ${META_FIELDS.join(", ")})`);
    }
  }

  const steps = [];
  const st = findTable(text, "Steps");
  if (!st) problems.push(`${file}: no \`## Steps\` table`);
  else {
    const missing = STEP_COLUMNS.filter((c) => !st.header.includes(c));
    if (missing.length) problems.push(`${file}:${st.line}: Steps table missing column(s): ${missing.join(", ")}`);
    else {
      for (const r of st.rows) {
        const o = {};
        st.header.forEach((h, i) => { o[h] = (r.cells[i] ?? "").trim(); });
        steps.push({
          n: o["#"],
          action: o.action.toLowerCase(),
          system: isDash(o.system) ? "" : o.system,
          artifact: isDash(o.artifact) ? "" : o.artifact,
          verify: isDash(o.verify) ? "" : o.verify,
          note: isDash(o.note) ? "" : o.note,
          line: r.line,
        });
      }
    }
  }
  return { id, name, file, line: titleIdx + 1, meta, steps, problems };
}

/** Load every runbook under `dir` (sorted). A missing dir is an empty set, not an error. */
export async function loadRunbooks(dir) {
  const out = { runbooks: [], problems: [], files: [] };
  if (!existsSync(dir)) return out;
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_") && f.toLowerCase() !== "readme.md").sort();
  for (const f of files) {
    const text = await fs.readFile(path.join(dir, f), "utf8");
    const rb = parseRunbookText(text, f);
    out.runbooks.push(rb);
    out.problems.push(...rb.problems);
    out.files.push(f);
  }
  return out;
}

/** Is `id` covered by a step system, by containment either way? */
function coveredBy(graph, id, stepSystems) {
  if (stepSystems.has(id)) return true;
  const n = graph.nodes.get(id);
  if (!n) return false;
  for (const a of n.ancestors) if (stepSystems.has(a)) return true; // a step names the whole parent system
  for (const s of stepSystems) {
    const sn = graph.nodes.get(s);
    if (sn && sn.ancestors.includes(id)) return true; // a step names one of its parts
  }
  return false;
}

/**
 * Direct hard-downstream systems of the primary (its parts included). Signals are
 * excluded, and so is anything reached THROUGH one of the primary's own signal
 * parts: a listener of an existing signal is a consumer of that signal, not
 * something a change to the emitting system breaks (this matters for event_bus,
 * whose parts are all the signals).
 */
export function coverageTargets(graph, primary) {
  if (!graph.nodes.has(primary)) return [];
  const own = new Set(subtreeIds(graph, primary));
  return affects(graph, primary, { depth: 1 }).hits.filter((h) => h.edge.strength === "hard" && !isSignal(h.id) && !own.has(h.id) && !isSignal(h.viaNode));
}

/** Validate runbooks against the registry graph. Returns { errors, warnings, info }. */
export function validateRunbooks(runbooks, graph) {
  const errors = [];
  const warnings = [];
  const info = [];
  const at = (rb, line) => `${rb.file}:${line ?? rb.line}`;
  const seen = new Map();
  for (const rb of runbooks) {
    errors.push(...rb.problems);
    if (!rb.id) { errors.push(`${at(rb)}: runbook has no id`); continue; }
    if (!/^rb_[a-z][a-z0-9_]*$/.test(rb.id)) errors.push(`${at(rb)}: id "${rb.id}" must be snake_case with the rb_ prefix`);
    if (seen.has(rb.id)) errors.push(`${at(rb)}: duplicate runbook id "${rb.id}" (first in ${seen.get(rb.id)})`);
    else seen.set(rb.id, rb.file);
    if (!rb.name) errors.push(`${at(rb)}: ${rb.id} has no title`);
    if (!rb.meta.trigger) warnings.push(`${at(rb)}: ${rb.id} has no Trigger — an agent cannot tell when it applies`);
    if (!rb.meta.primary) errors.push(`${at(rb)}: ${rb.id} has no Primary system`);
    else if (!graph.nodes.has(rb.meta.primary)) errors.push(`${at(rb)}: ${rb.id} Primary "${rb.meta.primary}" is not a registry id`);
    for (const role of rb.meta.roles) if (!OWNERS.includes(role)) errors.push(`${at(rb)}: ${rb.id} role "${role}" not in ${OWNERS.join("|")}`);
    for (const nt of rb.meta.notTouched) {
      if (!graph.nodes.has(nt.system)) errors.push(`${at(rb)}: ${rb.id} "Not touched" names unknown system "${nt.system}"`);
      if (!nt.reason) errors.push(`${at(rb)}: ${rb.id} "Not touched: ${nt.system}" has no reason — write why it is safe to skip`);
    }
    if (!rb.steps.length) errors.push(`${at(rb)}: ${rb.id} has no steps`);
    const stepSystems = new Set();
    for (const s of rb.steps) {
      if (!ACTIONS.includes(s.action)) errors.push(`${at(rb, s.line)}: ${rb.id} step ${s.n} Action "${s.action}" not in ${ACTIONS.join("|")}`);
      if (!s.system && s.action !== "decide") errors.push(`${at(rb, s.line)}: ${rb.id} step ${s.n} needs a System (only a decide step may leave it empty)`);
      if (s.system && !graph.nodes.has(s.system)) errors.push(`${at(rb, s.line)}: ${rb.id} step ${s.n} System "${s.system}" is not a registry id`);
      if (["create", "update", "delete"].includes(s.action) && !s.artifact) errors.push(`${at(rb, s.line)}: ${rb.id} step ${s.n} ${s.action} needs an Artifact (the file or record it changes)`);
      if (["check", "run"].includes(s.action) && !s.verify && !s.artifact) warnings.push(`${at(rb, s.line)}: ${rb.id} step ${s.n} ${s.action} has neither Verify nor Artifact — how does the agent know it passed?`);
      if (s.system) stepSystems.add(s.system);
    }
    if (rb.meta.primary && graph.nodes.has(rb.meta.primary)) {
      const nt = new Set(rb.meta.notTouched.map((x) => x.system));
      for (const h of coverageTargets(graph, rb.meta.primary)) {
        if (coveredBy(graph, h.id, stepSystems) || nt.has(h.id)) continue;
        warnings.push(`${at(rb)}: ${rb.id} never mentions ${h.id} — a direct hard downstream of ${rb.meta.primary} (${h.edge.how}: ${h.edge.why}); add a step or a "Not touched: ${h.id}: <reason>"`);
      }
    }
  }
  if (runbooks.length) info.push(`${runbooks.length} runbook(s) loaded from ${RUNBOOK_DIR}`);
  return { errors, warnings, info };
}

/**
 * Runbooks that apply to a system: `primary` (its own), `related` (a parent's or
 * a part's — containment either way), and `stepThrough` (runbooks that merely
 * have a step in this system — every runbook steps through `changelog`, so
 * callers show these as a count, not a list).
 */
export function runbooksFor(runbooks, graph, id) {
  const n = graph.nodes.get(id);
  const family = new Set([id, ...(n ? n.ancestors : []), ...(n ? subtreeIds(graph, id) : [])]);
  const primary = runbooks.filter((rb) => rb.meta.primary === id);
  const related = runbooks.filter((rb) => rb.meta.primary !== id && family.has(rb.meta.primary));
  const stepThrough = runbooks.filter((rb) => !family.has(rb.meta.primary) && rb.steps.some((s) => s.system && family.has(s.system)));
  return { primary, related, stepThrough };
}

const badge = (n) => `[P${n.phase ?? "—"}][${n.status}][${n.owner.join("/")}]`;

/** One runbook as LLM-readable markdown, with the registry's names and paths inlined. */
export function renderRunbook(rb, graph) {
  const L = [];
  const p = graph.nodes.get(rb.meta.primary);
  L.push(`# ${rb.id} — ${rb.name}`);
  L.push(``);
  L.push(`- **Trigger:** ${rb.meta.trigger || "—"}`);
  if (p) L.push(`- **Primary system:** \`${p.id}\` (${p.name}) ${badge(p)} · where: ${p.where.map((w) => `\`${w}\``).join(", ") || "—"}`);
  else L.push(`- **Primary system:** \`${rb.meta.primary || "—"}\``);
  L.push(`- **Roles:** ${rb.meta.roles.join(", ") || "—"} · **Director decision:** ${rb.meta.director || "none"} · **Spec:** ${rb.meta.spec || "—"}`);
  L.push(``);
  L.push(`| # | Action | System | Artifact | Verify | Note |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const s of rb.steps) {
    const sn = s.system ? graph.nodes.get(s.system) : null;
    const sys = s.system ? `\`${s.system}\`${sn ? ` (${sn.name})` : ""}` : "— DIRECTOR";
    L.push(`| ${s.n} | ${s.action} | ${sys} | ${s.artifact || "—"} | ${s.verify || "—"} | ${s.note || "—"} |`);
  }
  if (rb.meta.notTouched.length) {
    L.push(``);
    L.push(`**Not touched (and why):** ${rb.meta.notTouched.map((x) => `\`${x.system}\` — ${x.reason}`).join(" · ")}`);
  }
  if (p) {
    const targets = coverageTargets(graph, p.id);
    const stepSystems = new Set(rb.steps.map((s) => s.system).filter(Boolean));
    const nt = new Set(rb.meta.notTouched.map((x) => x.system));
    const gaps = targets.filter((h) => !coveredBy(graph, h.id, stepSystems) && !nt.has(h.id));
    L.push(``);
    L.push(gaps.length
      ? `**Coverage:** ${targets.length - gaps.length}/${targets.length} direct hard downstream systems of \`${p.id}\` addressed — gaps: ${gaps.map((g) => `\`${g.id}\``).join(", ")}`
      : `**Coverage:** all ${targets.length} direct hard downstream systems of \`${p.id}\` are addressed.`);
  }
  return L.join("\n");
}

/** Plain record for the LLM pack (systems/llm/runbooks.jsonl). */
export function runbookRecord(rb) {
  return {
    id: rb.id,
    name: rb.name,
    trigger: rb.meta.trigger,
    primary: rb.meta.primary,
    roles: rb.meta.roles,
    director: rb.meta.director || "none",
    spec: rb.meta.spec,
    steps: rb.steps.map((s) => ({ n: s.n, action: s.action, system: s.system || null, artifact: s.artifact || null, verify: s.verify || null, note: s.note || null })),
    not_touched: rb.meta.notTouched,
    file: `${RUNBOOK_DIR}/${rb.file}`,
  };
}
