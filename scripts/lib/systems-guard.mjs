#!/usr/bin/env node
// Systems-atlas edit guard for the PreToolUse hook (ADR-0066).
//
// The single most useful moment to tell an agent "you are inside system X,
// which hard-affects Y and Z, and runbook R applies" is the moment it reaches
// for the file — not after the PR. This module resolves a tool call that
// edits a file to the systems that own the path and returns:
//
//   { path, systems, decision: "context" | "deny", reason?, context? }
//
// Rules:
//   - generated atlas files (systems/ATLAS.md, systems/atlas/*, systems/explorer.html,
//     systems/llm/*) are DENIED with the fix: edit the registry and run render;
//   - registry / runbook / spec edits get a reminder of the ritual (validate, render, §5);
//   - game paths that map to a system get the system, its direct hard downstream,
//     the applicable runbooks and the owner's write scope;
//   - everything else returns null. Repeated edits inside the same system are
//     quiet after the first announcement (re-announced every 25th edit so the
//     context survives long sessions and compaction).
//
// Fail-open by design: the hook swallows any error and the tool call proceeds.

import path from "node:path";
import os from "node:os";
import { promises as fs, existsSync } from "node:fs";
import { loadRegistry, buildGraph, whichSystems, affects, subtreeIds, DEFAULT_REGISTRY_DIR, ATLAS_FILE, ATLAS_DIR, EXPLORER_FILE, LLM_DIR } from "./systems-map.mjs";
import { loadRunbooks, runbooksFor, RUNBOOK_DIR } from "./systems-runbooks.mjs";
import { WRITE_SCOPES } from "./systems-ops.mjs";

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "mcp__filesystem__write_file", "mcp__filesystem__edit_file", "mcp__filesystem__create_directory", "mcp__filesystem__move_file"]);
const REANNOUNCE_EVERY = 25;

export function editedPath(tool, input) {
  if (!EDIT_TOOLS.has(tool) || !input || typeof input !== "object") return null;
  const p = input.file_path || input.notebook_path || input.path || input.destination || null;
  return typeof p === "string" && p ? p : null;
}

export function toRepoRelative(p, root) {
  let s = String(p).replace(/\\/g, "/");
  if (path.isAbsolute(s)) {
    const rel = path.relative(root, s).split(path.sep).join("/");
    if (rel.startsWith("..")) return null; // outside the project
    s = rel;
  }
  return s.replace(/^\.\//, "").replace(/^res:\/\//, "");
}

export function isGeneratedAtlasPath(rel) {
  return rel === ATLAS_FILE || rel === EXPLORER_FILE || rel.startsWith(`${ATLAS_DIR}/`) || rel.startsWith(`${LLM_DIR}/`);
}

async function seenState(sessionId) {
  const file = path.join(os.tmpdir(), `loom-systems-guard-${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  let state = { announced: {} };
  try { state = JSON.parse(await fs.readFile(file, "utf8")); } catch { /* fresh */ }
  return {
    state,
    bump(ids) {
      const fresh = [];
      for (const id of ids) {
        const c = (state.announced[id] || 0) + 1;
        state.announced[id] = c;
        if (c === 1 || c % REANNOUNCE_EVERY === 0) fresh.push(id);
      }
      return fresh;
    },
    async save() { try { await fs.writeFile(file, JSON.stringify(state), "utf8"); } catch { /* best-effort */ } },
  };
}

const badge = (n) => `[P${n.phase ?? "—"}][${n.status}][${n.owner.join("/")}]`;
const pathOf = (graph, id) => {
  const n = graph.nodes.get(id);
  const chain = [...n.ancestors].reverse().map((a) => graph.nodes.get(a).name);
  return chain.length ? `${chain.join(" › ")} › ${n.name}` : n.name;
};

/**
 * Resolve an edit to atlas context. Returns null when the tool call is not an
 * edit, the path is outside the project, or no system owns it.
 */
export async function editContextFor({ tool, input, root = process.cwd(), sessionId = "cli" }) {
  const raw = editedPath(tool, input);
  if (!raw) return null;
  const rel = toRepoRelative(raw, root);
  if (!rel) return null;
  const registryDir = path.join(root, DEFAULT_REGISTRY_DIR);
  if (!existsSync(registryDir)) return null;

  if (isGeneratedAtlasPath(rel)) {
    return {
      path: rel, systems: [], decision: "deny",
      reason: `${rel} is generated from systems/registry by \`scripts/systems-map.sh render\`. Edit the registry (or use add-node / add-edge / set-node), then run render. Hand edits are overwritten and fail the doctor.`,
    };
  }
  if (rel.startsWith(`${DEFAULT_REGISTRY_DIR}/`)) {
    return {
      path: rel, systems: ["systems_atlas"], decision: "context",
      context: `[systems atlas] You are editing the registry itself (${rel}). Prefer the mutation commands, which escape cells, pick the file and refuse to leave the ledger invalid: \`scripts/systems-map.sh add-node|add-edge|set-node|remove-node|remove-edge\`. After any registry change run \`scripts/systems-map.sh validate\` then \`scripts/systems-map.sh render\` (ATLAS.md, atlas/, explorer.html and systems/llm/ are generated; the doctor fails when they are stale). Edge rule: write the row from the dependent's point of view (From depends on To) except \`emits\`.`,
    };
  }
  if (rel.startsWith(`${RUNBOOK_DIR}/`)) {
    return {
      path: rel, systems: ["systems_atlas"], decision: "context",
      context: `[systems atlas] You are editing a change runbook (${rel}). Every System cell must be a registry id, and every direct hard downstream of the Primary must be a step or a "Not touched: <id>: <reason>" entry — \`scripts/systems-map.sh validate\` checks both. Then \`render\` refreshes systems/llm/runbooks.jsonl.`,
    };
  }
  if (/(^|\/)GAME_INFRA_SPEC\.md$/.test(rel)) {
    return {
      path: rel, systems: ["game_infra_spec"], decision: "context",
      context: `[systems atlas] GAME_INFRA_SPEC.md is the law (§14 change control: contract changes need DIRECTOR approval in the PR). If you change §5, the registry's sig_* nodes must match — \`scripts/systems-map.sh validate\` cross-checks the table. If you change §6, follow runbook \`rb_change_schema\`. Then update the affected registry rows' Spec column.`,
    };
  }

  const registry = await loadRegistry(registryDir);
  const graph = buildGraph(registry);
  const m = whichSystems(graph, rel);
  if (!m.primary.length) return null;
  const rb = await loadRunbooks(path.join(root, RUNBOOK_DIR));
  const ids = m.primary.map((p) => p.id);
  const seen = await seenState(sessionId);
  const fresh = seen.bump(ids);
  await seen.save();
  if (!fresh.length) return { path: rel, systems: ids, decision: "context", context: null };

  const lines = [];
  for (const id of fresh.slice(0, 3)) {
    const n = graph.nodes.get(id);
    const own = new Set(subtreeIds(graph, id));
    const hard = affects(graph, id, { depth: 1 }).hits.filter((h) => h.edge.strength === "hard" && !h.id.startsWith("sig_") && !own.has(h.id));
    const hardIds = [...new Set(hard.map((h) => h.id))].sort();
    const emits = affects(graph, id, { depth: 1 }).hits.filter((h) => h.id.startsWith("sig_")).map((h) => h.id.slice(4));
    const rbs = runbooksFor(rb.runbooks, graph, id);
    const rbIds = [...rbs.primary, ...rbs.related].map((r) => r.id);
    if (!rbIds.length && rbs.stepThrough.length && rbs.stepThrough.length <= 3) rbIds.push(...rbs.stepThrough.map((r) => r.id));
    lines.push(`[systems atlas] Editing \`${rel}\` → system \`${id}\` (${pathOf(graph, id)}) ${badge(n)}.`);
    if (n.status === "candidate") lines.push(`  STOP: \`${id}\` is a candidate system (asked for, not in the spec). A DIRECTOR decision and a spec PR come first (§14).`);
    if (n.status === "non-goal") lines.push(`  STOP: \`${id}\` is a non-goal per the spec.`);
    lines.push(`  Direct hard downstream (${hardIds.length}): ${hardIds.length ? hardIds.slice(0, 14).map((x) => `\`${x}\``).join(", ") + (hardIds.length > 14 ? ` … +${hardIds.length - 14}` : "") : "none recorded"} — each may need an entry, an update, or a written "unaffected because".`);
    if (emits.length) lines.push(`  Emits: ${emits.map((s) => `\`${s}\``).join(", ")} — payload or new signals ⇒ spec §5 in the same PR (R-EB1).`);
    const stepNote = rbs.stepThrough.length > 3 ? `${rbs.stepThrough.length} runbooks step through it. ` : "";
    lines.push(`  ${rbIds.length ? `Runbook(s): ${rbIds.map((r) => `\`${r}\``).join(", ")} — \`scripts/systems-map.sh runbook ${rbIds[0]}\`. ` : stepNote}Checklist: \`scripts/systems-map.sh checklist ${id}\`. Write scope for ${n.owner.join("/")}: ${n.owner.map((o) => WRITE_SCOPES[o] || "—").join(" · ")}.`);
  }
  return { path: rel, systems: ids, decision: "context", context: lines.join("\n") };
}
