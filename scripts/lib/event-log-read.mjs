#!/usr/bin/env node
// Shared event-log reader (ADR-0059).
//
// Three modules now need to read records back out of `memory/event-log/*.jsonl`
// (skill-adherence, session-compliance, claim-provenance), and the JSONL
// parse-and-skip-bad-lines loop had already been hand-written twice. One reader,
// one place where a malformed line is tolerated.
//
// Reading is deliberately lenient: a corrupt line is skipped, not fatal. The log
// is an audit trail, and a trail with one unreadable entry is still evidence.

import { promises as fs } from "node:fs";
import path from "node:path";
import { EVENT_LOG_DIR, todayLogPath } from "../hooks/_lib.mjs";

/** Parse JSONL text into records, skipping unparseable lines. */
export function parseJsonl(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // Skip — a truncated final line is normal for an append-only log being
      // written concurrently.
    }
  }
  return out;
}

/** Records from today's log. Returns [] when the log does not exist. */
export async function readTodayRecords() {
  try {
    return parseJsonl(await fs.readFile(todayLogPath(), "utf8"));
  } catch {
    return [];
  }
}

/** Records from one specific log file. */
export async function readLogFile(filePath) {
  try {
    return parseJsonl(await fs.readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Records from the most recent `days` log files (newest first by filename,
 * which is ISO-dated so lexicographic order is chronological).
 */
export async function readRecentRecords(days = 7, dir = EVENT_LOG_DIR) {
  try {
    const files = (await fs.readdir(dir))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort()
      .reverse()
      .slice(0, Math.max(1, days));
    const all = [];
    for (const f of files) all.push(...(await readLogFile(path.join(dir, f))));
    return all;
  } catch {
    return [];
  }
}
