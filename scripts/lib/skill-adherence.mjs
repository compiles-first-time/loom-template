#!/usr/bin/env node
// Skill-adherence ledger (ADR-0059) — closes the loop the intent nag left open.
//
// `user-prompt-submit.mjs` has emitted `subagent_suggestion` events since
// ADR-0017. Nothing ever read them back. So the question the architect actually
// cares about — *did the session use the agent it was told to use?* — was
// structurally unanswerable: the suggestion and the invocation lived in the same
// log with no join between them.
//
// This module is that join. Given a session's event records it reports, per
// suggestion, one of three outcomes:
//
//   matched   — a suggested agent/skill was invoked at or after the suggestion
//   declined  — the session explicitly recorded a `skill_declined` with a reason
//   unmatched — neither happened, and nobody said why
//
// The rule that keeps this constitutional: **unmatched is not a violation.**
// Kernel Rules 1/2/8 give an agent the right to author its own approach and
// forbid the kernel deciding what is good for it. A mandatory-invocation gate
// would narrow that. What Loom is entitled to require is a *record*: use it, or
// say why not. The defect is silence — which is exactly the silent-degradation
// failure mode ADR-0054 names, and which the multi-turn adherence-decay
// literature says is structural rather than motivational (see
// research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md §3.3).
//
// Pure functions only. Every input is passed in, so this is testable without a
// hook payload or a live event log.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

// A suggestion entry is prose as often as it is an identifier. ADR-0017's rules
// suggest things like "deploy primitive (scripts/deploy.{sh,ps1})", which is
// advice about a script, not an agent anyone can invoke. Counting those in the
// denominator would make 100% adherence unreachable — a metric that cannot be
// satisfied gets ignored, and an ignored metric is worse than none.
const ADVISORY_MARKERS = [
  /\bprimitive\b/i,
  /\bscripts?\//i,
  /\.(sh|ps1|mjs|js)\b/i,
  /\bconvention\b/i,
  /\bchecklist\b/i,
];

/**
 * Reduce a raw suggestion string to a comparable key.
 * "constitution-service" → "constitution-service"
 * "deploy primitive (scripts/deploy.{sh,ps1})" → advisory (not invocable)
 */
export function normalizeSuggestion(raw, roster = []) {
  const text = String(raw || "").trim();
  if (!text) return null;

  for (const re of ADVISORY_MARKERS) {
    if (re.test(text)) return { key: text.toLowerCase(), kind: "advisory", raw: text };
  }

  // Strip backticks/parentheticals, take the leading identifier-ish token run.
  const cleaned = text.replace(/[`*]/g, "").replace(/\(.*?\)/g, "").trim();
  const m = /^([a-z][a-z0-9]*(?:[-_][a-z0-9]+)*)/i.exec(cleaned);
  const key = (m ? m[1] : cleaned).toLowerCase();
  if (!key) return null;

  // A key we can see in the roster is definitely invocable. A key we cannot is
  // still treated as invocable when it looks like a bare identifier — the
  // roster may legitimately be unavailable (a caller passing no roster), and
  // silently demoting real agents to advisory would inflate the adherence rate.
  const kind = roster.length === 0 || roster.includes(key) ? "agent" : "advisory";
  return { key, kind, raw: text };
}

/** Every name a record could be claiming to have invoked. */
function invokedKeys(rec) {
  const out = [];
  if (rec.event_type === "agent_invoked" && rec.agent) out.push(String(rec.agent).toLowerCase());
  if (rec.event_type === "skill_invoked" && rec.skill) out.push(String(rec.skill).toLowerCase());
  // The specialist lifecycle emits its own spawn event.
  if (rec.event_type === "specialist_spawned" && rec.agent) out.push(String(rec.agent).toLowerCase());
  return out;
}

function tsOf(rec) {
  const t = Date.parse(rec && rec.timestamp);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Compute skill/agent adherence for one session.
 *
 * @param {object}   opts
 * @param {object[]} opts.records   - event-log records (any order)
 * @param {string}   [opts.sessionId] - restrict to this session; omit for all
 * @param {string[]} [opts.roster]  - known invocable agent names (lowercase)
 * @returns {{
 *   suggestions: number, invocable: number, matched: number, declined: number,
 *   unmatched: number, adherence_rate: number|null, advisory: number,
 *   detail: Array<{intent: string|null, suggested: string[], outcome: string, matched_on: string|null, reason: string|null}>
 * }}
 */
export function computeSkillAdherence({ records = [], sessionId = null, roster = [] } = {}) {
  const rows = (Array.isArray(records) ? records : []).filter(
    (r) => r && typeof r === "object" && (!sessionId || !r.session_id || r.session_id === sessionId)
  );

  const invocations = [];
  const declines = [];
  for (const r of rows) {
    for (const k of invokedKeys(r)) invocations.push({ key: k, at: tsOf(r) });
    if (r.event_type === "skill_declined") {
      const key = String(r.skill || r.agent || "").toLowerCase();
      declines.push({ key, at: tsOf(r), reason: r.reason || null });
    }
  }

  const detail = [];
  let matched = 0;
  let declined = 0;
  let unmatched = 0;
  let advisory = 0;
  let suggestionCount = 0;

  for (const r of rows) {
    if (r.event_type !== "subagent_suggestion") continue;
    const at = tsOf(r);
    const list = Array.isArray(r.suggestions) ? r.suggestions : [];

    for (const s of list) {
      suggestionCount++;
      const raws = Array.isArray(s.suggest) ? s.suggest : s.suggest ? [s.suggest] : [];
      const norm = raws.map((x) => normalizeSuggestion(x, roster)).filter(Boolean);
      const invocable = norm.filter((n) => n.kind === "agent");

      // Nothing invocable was suggested — advisory only. Not scoreable, and
      // saying so beats quietly counting it as a miss.
      if (invocable.length === 0) {
        advisory++;
        detail.push({
          intent: s.intent || null,
          suggested: raws,
          outcome: "advisory",
          matched_on: null,
          reason: "no invocable agent among the suggestions",
        });
        continue;
      }

      // Alternatives, not a checklist: satisfying ANY of them satisfies the
      // suggestion. Only invocations at or after the suggestion count — an
      // agent used before being suggested did not act on the suggestion.
      const hit = invocable.find((n) => invocations.some((i) => i.key === n.key && i.at >= at));
      if (hit) {
        matched++;
        detail.push({
          intent: s.intent || null,
          suggested: raws,
          outcome: "matched",
          matched_on: hit.key,
          reason: null,
        });
        continue;
      }

      const dec = invocable
        .map((n) => declines.find((d) => d.key === n.key && d.at >= at))
        .find(Boolean);
      if (dec) {
        declined++;
        detail.push({
          intent: s.intent || null,
          suggested: raws,
          outcome: "declined",
          matched_on: dec.key,
          reason: dec.reason || "(no reason recorded)",
        });
        continue;
      }

      unmatched++;
      detail.push({
        intent: s.intent || null,
        suggested: raws,
        outcome: "unmatched",
        matched_on: null,
        reason: null,
      });
    }
  }

  const invocableTotal = matched + declined + unmatched;
  // A declined suggestion counts as adherence: the discipline is "use it or say
  // why not", so an owned refusal is compliance, not a miss (Rule 1).
  const adherence_rate = invocableTotal === 0 ? null : (matched + declined) / invocableTotal;

  return {
    suggestions: suggestionCount,
    invocable: invocableTotal,
    matched,
    declined,
    unmatched,
    advisory,
    adherence_rate,
    detail,
  };
}

/**
 * Read the installed subagent roster from `.claude/agents/*.md` filenames.
 * Best-effort: an unreadable directory yields `[]`, which normalizeSuggestion
 * treats as "trust bare identifiers" rather than demoting everything.
 */
export async function loadRoster(root = PROJECT_ROOT) {
  try {
    const dir = path.join(root, ".claude", "agents");
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, "").toLowerCase());
  } catch {
    return [];
  }
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { readTodayRecords } = await import("./event-log-read.mjs");
  const sessionId = process.argv[2] || null;
  const records = await readTodayRecords();
  const roster = await loadRoster();
  const result = computeSkillAdherence({ records, sessionId, roster });
  const pct = result.adherence_rate === null ? "n/a" : `${Math.round(result.adherence_rate * 100)}%`;
  console.log(`skill adherence: ${pct}  (matched ${result.matched}, declined ${result.declined}, unmatched ${result.unmatched}, advisory ${result.advisory})`);
  for (const d of result.detail) {
    if (d.outcome === "unmatched") console.log(`  ✗ ${d.intent || "?"} → suggested ${d.suggested.join(" / ")} — never invoked, no reason recorded`);
  }
}
