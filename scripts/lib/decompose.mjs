#!/usr/bin/env node
// /decompose — register → dispatchable task graph (ADR-0064).
//
// ── The missing spine ────────────────────────────────────────────────────
//
// Loom's pipeline is requirements → decompose → synthesize-missing-specialist
// → build → verify → learn. Every stage existed except the second: the
// register (ADR-0046/0061) defined the work, verifier gates (ADR-0044) closed
// it, the EAC could synthesize specialists — and nothing connected them. The
// register's `Owner Role` and `Verifier` columns were added by ADR-0061 as
// exactly this join, and this module is the join running.
//
// The design matches the gated-phase pattern the field converged on
// (specify → plan → approve → implement — Spec Kit, Anthropic's workflow
// guidance): the PLAN IS THE ARTIFACT. This module emits a reviewable file,
// not chat scrollback; approval happens on the file; execution follows the
// file. "Trust the file, not the chat."
//
// Three decisions this module makes mechanically, so no agent has to judge:
//
//   1. NODES + OWNERS. Every BR and solution step becomes a node carrying its
//      Owner Role and Verifier from the register. A node with no owner or no
//      verifier is reported, not guessed at.
//   2. SPECIALIST GAPS — the chameleon trigger. An Owner Role that matches no
//      installed agent, registry specialist, or known runtime/human role is a
//      `specialist_gap`: the EAC's cue to synthesize (per its embed-vs-split
//      rule), cache in the registry, and dispatch. This is the mechanism that
//      makes "spun up dynamically, per the right reason" a pipeline instead of
//      an aspiration.
//   3. CONTEXT PACKETS. Each node lists the register rows relevant to it (the
//      step + its attached exceptions), so a dispatcher can hand a specialist
//      the pruned slice rather than the whole conversation. Failures observed
//      in multi-agent systems concentrate in specification and handoff; a
//      packet keeps the handoff small and checkable.
//
// Proportionality (the anti-ceremony rule): a register with ≤1 solution step
// is flagged `direct_execution_advised` — if the change can be described in
// one sentence, skip the ceremony. A discipline that taxes trivial work gets
// disabled, and a disabled discipline protects nothing.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";
import { parseRegister } from "./requirements-register.mjs";
import { loadRoster } from "./skill-adherence.mjs";

// Owner Roles that are runtime machinery or humans — never specialist gaps.
const RUNTIME_ROLES = new Set([
  "main", "main session", "session", "stop hook", "hooks", "doctor", "loom doctor",
  "ci", "harness", "runtime",
]);
const HUMAN_ROLES = new Set([
  "architect", "human", "user", "requester", "owner", "reviewer", "architect / infra",
  "infra", "nick",
]);

const norm = (s) => String(s || "").toLowerCase().replace(/[`*]/g, "").trim();

/** Load registry specialist names from the manifest (best-effort). */
export async function loadRegistryNames(root = PROJECT_ROOT) {
  try {
    const dir = path.join(root, "agents", "specialists", "_registry");
    return (await fs.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
      .map((e) => e.name.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Classify one Owner Role string against the known populations.
 * @returns {"agent"|"registry"|"runtime"|"human"|"gap"|"empty"}
 */
export function classifyOwner(raw, { roster = [], registry = [] } = {}) {
  const owner = norm(raw);
  if (!owner || owner === "—" || owner === "-") return "empty";
  if (RUNTIME_ROLES.has(owner)) return "runtime";
  if (HUMAN_ROLES.has(owner)) return "human";
  // "architect / infra" style compounds: any human part makes it human-owned.
  if (owner.split(/[/,]| or /).some((p) => HUMAN_ROLES.has(p.trim()))) return "human";
  if (roster.includes(owner)) return "agent";
  if (registry.includes(owner)) return "registry";
  // "any claiming agent" and similar quantified roles are satisfiable by the
  // session itself — not a gap.
  if (/\bany\b/.test(owner)) return "runtime";
  return "gap";
}

/**
 * Decompose one parsed register into a task graph.
 *
 * @param {object} opts
 * @param {{columns: string[], rows: object[]}} opts.parsed
 * @param {string[]} [opts.roster]   - installed agent names (lowercase)
 * @param {string[]} [opts.registry] - registry specialist names (lowercase)
 * @returns {{
 *   nodes: object[], gaps: object[], unowned: string[], unverified: string[],
 *   direct_execution_advised: boolean, steps: number
 * }}
 */
export function decomposeRegister({ parsed, roster = [], registry = [] } = {}) {
  const rows = (parsed && parsed.rows) || [];
  const steps = rows.filter((r) => r.Type === "---");
  const brs = rows.filter((r) => r.Type === "BR");
  // TR rows are prerequisites — accounts, credentials, paid tiers, human
  // steps. They go in the plan as blocking nodes: what no agent can clear
  // belongs in front of a person BEFORE dispatch, not as a mid-build surprise.
  const trs = rows.filter((r) => r.Type === "TR");

  // Exceptions travel with their step (ADR-0061 step-level attachment); for
  // legacy requirement-level registers they attach to the BR node instead.
  const exceptionsFor = (nodeId) =>
    rows
      .filter((r) => (r.Type === "SE" || r.Type === "BE") && r.ID.startsWith(`${nodeId}_`))
      .map((r) => r.ID);

  const nodes = [];
  const gaps = [];
  const unowned = [];
  const unverified = [];

  for (const row of [...trs, ...brs, ...steps]) {
    const owner = row["Owner Role"] || "";
    const verifier = row["Verifier"] || "";
    const ownerKind = classifyOwner(owner, { roster, registry });

    const node = {
      id: row.ID,
      kind: row.Type === "BR" ? "requirement" : row.Type === "TR" ? "prerequisite" : "step",
      usecase: row.Usecase || "",
      owner_role: owner || null,
      owner_kind: ownerKind,
      verifier: verifier || null,
      // The context packet: what a dispatcher hands the owner — this node's
      // row plus its attached exceptions. Never the whole register, never the
      // conversation.
      context_packet: [row.ID, ...exceptionsFor(row.ID)],
    };
    nodes.push(node);

    if (ownerKind === "empty") unowned.push(row.ID);
    if (!norm(verifier) || norm(verifier) === "—") unverified.push(row.ID);
    if (ownerKind === "gap") {
      gaps.push({
        node: row.ID,
        owner_role: owner,
        action: "EAC: synthesize (or extend, per embed-vs-split) a specialist for this role, cache in the registry, then dispatch",
      });
    }
  }

  return {
    nodes,
    gaps,
    unowned,
    unverified,
    steps: steps.length,
    direct_execution_advised: steps.length <= 1,
  };
}

/** Decompose a register file on disk, resolving roster + registry. */
export async function decomposeFile(registerPath, root = PROJECT_ROOT) {
  const text = await fs.readFile(registerPath, "utf8");
  const roster = await loadRoster(root);
  const registry = await loadRegistryNames(root);
  return decomposeRegister({ parsed: parseRegister(text), roster, registry });
}

/** Render the graph as the reviewable plan artifact (markdown). */
export function renderPlan(result, registerName = "register") {
  const lines = [];
  lines.push(`# Decomposition — ${registerName}`);
  lines.push("");
  if (result.direct_execution_advised) {
    lines.push(`> **Proportionality:** ${result.steps} solution step(s) — if the change fits in one sentence, skip the ceremony and execute directly (ADR-0064).`);
    lines.push("");
  }
  lines.push("| Node | Kind | Owner Role | Owner kind | Verifier | Context packet |");
  lines.push("|---|---|---|---|---|---|");
  for (const n of result.nodes) {
    lines.push(
      `| ${n.id} | ${n.kind} | ${n.owner_role || "**UNOWNED**"} | ${n.owner_kind} | ${n.verifier || "**UNVERIFIED**"} | ${n.context_packet.join(", ")} |`
    );
  }
  lines.push("");
  if (result.gaps.length) {
    lines.push(`## Specialist gaps (${result.gaps.length}) — the EAC trigger`);
    lines.push("");
    for (const g of result.gaps) lines.push(`- **${g.owner_role}** (node ${g.node}) — ${g.action}`);
    lines.push("");
  }
  if (result.unowned.length) lines.push(`**Unowned nodes:** ${result.unowned.join(", ")} — a step with no owner is a step nobody is dispatched for.`);
  if (result.unverified.length) lines.push(`**Unverified nodes:** ${result.unverified.join(", ")} — a node with no verifier cannot be closed (ADR-0044).`);
  lines.push("");
  lines.push("> Execute from THIS FILE after approval, in a fresh session with only the approved plan + per-node context packets loaded (context hygiene). Trust the file, not the chat.");
  return lines.join("\n");
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node decompose.mjs <register.md | BR_NN>");
    process.exit(2);
  }
  const p = /^BR[_-]?\d+$/i.test(arg)
    ? path.join(PROJECT_ROOT, "observability", "eval-suite", "requirements", `${arg.toUpperCase().replace("-", "_")}.md`)
    : arg;
  if (!existsSync(p)) {
    console.error(`register not found: ${p}`);
    process.exit(1);
  }
  const result = await decomposeFile(p);
  console.log("\n" + renderPlan(result, path.basename(p)));
  // Audit trail: the decomposition and each gap are events (Rule 22).
  try {
    const { appendEvent, mechanicalRecord } = await import("../hooks/_lib.mjs");
    appendEvent(mechanicalRecord("decomposition", {
      session_id: process.env.CLAUDE_SESSION_ID,
      register: path.basename(p),
      nodes: result.nodes.length,
      gaps: result.gaps.length,
      unowned: result.unowned.length,
      unverified: result.unverified.length,
      direct_execution_advised: result.direct_execution_advised,
      rule: "ADR-0064",
    }));
    for (const g of result.gaps) {
      appendEvent(mechanicalRecord("specialist_gap", {
        session_id: process.env.CLAUDE_SESSION_ID,
        register: path.basename(p),
        node: g.node,
        owner_role: g.owner_role,
        rule: "ADR-0064",
      }));
    }
  } catch { /* best-effort */ }
  process.exit(result.gaps.length > 0 ? 3 : 0);
}
