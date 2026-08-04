#!/usr/bin/env node
// Confidence-calibration scoring over the event log's `claim` records.
//
// CLAUDE.md's autonomy table (<60 / 60–80 / 80–95 / >95) is load-bearing:
// agents self-authorize based on confidence. Nothing previously checked
// whether those numbers are CALIBRATED — whether 80%-claims are right ~80%
// of the time (self-reported confidence is unreliable on its own: Kadavath
// et al., cited in L6). This module scores claims against recorded outcomes.
//
// Outcome convention (L6 §Claim resolution): a `claim_resolution` event
//   { event_type: "claim_resolution", resolves: "<timestamp>|<agent>",
//     outcome: true|false, note, resolved_by }
// appended by the monthly internal audit (or any human review) marks a prior
// claim correct/incorrect. Claims key = `${timestamp}|${agent}`.
//
// Pure functions + a CLI (guarded — importing never runs it).

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BANDS = [
  { name: "<60%", min: 0, max: 0.6 },
  { name: "60–80%", min: 0.6, max: 0.8 },
  { name: "80–95%", min: 0.8, max: 0.95 },
  { name: ">95%", min: 0.95, max: 1.000001 },
];

export function claimKey(ev) {
  return `${ev.timestamp}|${ev.agent || "unknown"}`;
}

// Batch-appended claims can share one timestamp+agent (found by the first
// monthly audit: four claims appended with a single shell $TS). The hashed
// key disambiguates; a resolution may target either form, but a BASE key that
// matches multiple claims is AMBIGUOUS and resolves none of them (resolving
// one would silently mis-resolve its siblings).
export function claimHash(ev) {
  const s = String(ev.claim || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function claimKeyHashed(ev) {
  return `${claimKey(ev)}|${claimHash(ev)}`;
}

// Split parsed event-log records into claims (with numeric confidence) and
// resolutions, tolerating malformed lines (dirty logs must not crash audits).
export function partitionEvents(records) {
  const claims = [];
  const resolutions = new Map();
  for (const ev of records) {
    if (!ev || typeof ev !== "object") continue;
    if (ev.event_type === "claim" && typeof ev.confidence === "number") claims.push(ev);
    else if (ev.event_type === "claim_resolution" && typeof ev.resolves === "string") {
      resolutions.set(ev.resolves, ev);
    }
  }
  return { claims, resolutions };
}

// Per-band calibration: total, resolved, correct, observed accuracy, and the
// Brier score over resolved claims (mean squared error of confidence vs
// outcome — proper scoring rule; lower is better).
export function calibrationReport(claims, resolutions) {
  const bands = BANDS.map((b) => ({ ...b, total: 0, resolved: 0, correct: 0, brierSum: 0 }));
  const unresolved = [];
  const baseKeyCounts = new Map();
  for (const c of claims) baseKeyCounts.set(claimKey(c), (baseKeyCounts.get(claimKey(c)) || 0) + 1);
  for (const c of claims) {
    const band = bands.find((b) => c.confidence >= b.min && c.confidence < b.max);
    if (!band) continue;
    band.total++;
    // Hashed key always wins; a base-key resolution applies only when unique.
    const res = resolutions.get(claimKeyHashed(c)) ||
      (baseKeyCounts.get(claimKey(c)) === 1 ? resolutions.get(claimKey(c)) : undefined);
    if (res && typeof res.outcome === "boolean") {
      band.resolved++;
      if (res.outcome) band.correct++;
      const o = res.outcome ? 1 : 0;
      band.brierSum += (c.confidence - o) ** 2;
    } else {
      unresolved.push({
        key: claimKey(c),
        hashed_key: claimKeyHashed(c),
        ambiguous_base_key: baseKeyCounts.get(claimKey(c)) > 1,
        confidence: c.confidence,
        claim: String(c.claim || "").slice(0, 100),
      });
    }
  }
  return {
    bands: bands.map((b) => ({
      band: b.name,
      total: b.total,
      resolved: b.resolved,
      correct: b.correct,
      observed_accuracy: b.resolved ? b.correct / b.resolved : null,
      brier: b.resolved ? b.brierSum / b.resolved : null,
    })),
    total_claims: claims.length,
    total_resolved: claims.length - unresolved.length,
    unresolved,
  };
}

export async function loadEventRecords(eventLogDir) {
  const records = [];
  if (!existsSync(eventLogDir)) return records;
  const files = (await fs.readdir(eventLogDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  for (const f of files.sort()) {
    const text = await fs.readFile(path.join(eventLogDir, f), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { records.push(JSON.parse(line)); } catch { /* dirty line — skip */ }
    }
  }
  return records;
}

async function main() {
  const dir = path.join(process.cwd(), "memory", "event-log");
  const { claims, resolutions } = partitionEvents(await loadEventRecords(dir));
  const report = calibrationReport(claims, resolutions);
  console.log("Confidence calibration — claims vs recorded outcomes\n");
  console.log("band      total  resolved  correct  observed  brier");
  for (const b of report.bands) {
    console.log(
      `${b.band.padEnd(9)} ${String(b.total).padStart(5)} ${String(b.resolved).padStart(9)} ${String(b.correct).padStart(8)}  ` +
      `${b.observed_accuracy == null ? "   —  " : (b.observed_accuracy * 100).toFixed(0).padStart(5) + "%"}  ${b.brier == null ? "  —" : b.brier.toFixed(3)}`
    );
  }
  console.log(`\n${report.total_resolved}/${report.total_claims} claims resolved; ${report.unresolved.length} awaiting a claim_resolution.`);
  console.log("Resolution is a human/audit act (L6): the monthly internal audit resolves what it can.");
  if (report.total_resolved > 0) {
    const bad = report.bands.find((b) => b.resolved >= 5 && b.observed_accuracy != null && b.observed_accuracy < b.min - 0.1);
    if (bad) {
      console.log(`\n⚠ Band ${bad.band} is materially over-confident (observed ${(bad.observed_accuracy * 100).toFixed(0)}%). The CLAUDE.md autonomy thresholds lean on this — investigate.`);
      process.exit(2);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
}
