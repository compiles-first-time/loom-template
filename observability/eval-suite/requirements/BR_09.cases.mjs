// Canonical BR_09 test cases (cold-start bootstrap fixes / registry per ADR-0046).
//
// Consumed by scripts/lib/cold-start.test.mjs. Tests the PURE helpers
// (COLD_START_ADVISORY, bootstrappedThisSessionPayload) + the aggregator's
// visibility handler — so the fix's contract is verified without running the
// session-start hook (which has heavy side effects).

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  COLD_START_ADVISORY,
  bootstrappedThisSessionPayload,
} from "../../../scripts/hooks/_lib.mjs";
import { Aggregator } from "../../../observatory/lib/aggregator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const advisoryText = COLD_START_ADVISORY.join(" ");
const ev = (event_type, extra = {}) => ({
  timestamp: "2026-07-15T12:00:00.000Z", session_id: "s1", event_type,
  kernel_version: "v6", loom_version: "0.2.0", ...extra,
});

export const BR_09_CASES = [
  {
    id: "BR_09", type: "BR", framework_location: "scripts/hooks/session-start.mjs",
    title: "Make the cold-start gap impossible to miss",
    expected_input: "a session that stamped the project this run",
    expected_output: "loud advisory (path 2b + hand-authored) + a visible marker",
    justification: "Lesson 2026-07-10 — the founding session can't self-govern (hooks/subagents register at session start). A silent gap produces a project that LOOKS bootstrapped while its audit trail is empty.",
    run() {
      const ok =
        /path 2b/i.test(advisoryText) &&
        /hand-authored/i.test(advisoryText) &&
        /restart/i.test(advisoryText) &&
        /clone/i.test(advisoryText);
      return { actual: `advisory covers: path-2b+hand-authored+restart+clone = ${ok}`, pass: ok };
    },
  },
  {
    id: "BR-09_SE-01", type: "SE", framework_location: "scripts/hooks/_lib.mjs",
    title: "Hooks inactive but the gap is NOT surfaced (the exact failure)",
    expected_input: "COLD_START_ADVISORY",
    expected_output: "non-empty; states hooks/subagents are NOT active",
    justification: "The failure being killed: a session runs ungoverned and nobody notices. The advisory must exist and say so explicitly.",
    run() {
      const ok = COLD_START_ADVISORY.length > 0 && /NOT active/i.test(advisoryText);
      return { actual: `lines=${COLD_START_ADVISORY.length}, says-NOT-active=${/NOT active/i.test(advisoryText)}`, pass: ok };
    },
  },
  {
    id: "BR-09_s1", type: "---", framework_location: "scripts/hooks/session-start.mjs",
    title: "Marker payload records the stamping",
    expected_input: "bootstrappedThisSessionPayload({project})",
    expected_output: "{stamped:true, cold_start_advised:true, project}",
    justification: "Recommendation #2 — a machine-checkable marker so the gap is visible in the log, not inferred.",
    run() {
      const p = bootstrappedThisSessionPayload({ project: "acme" });
      const ok = p.stamped === true && p.cold_start_advised === true && p.project === "acme";
      return { actual: JSON.stringify(p), pass: ok };
    },
  },
  {
    id: "BR-09_Wire", type: "---", framework_location: "observatory/lib/aggregator.mjs",
    title: "Marker is VISIBLE in the Observatory",
    expected_input: "Aggregator.ingestEvent(bootstrapped_this_session)",
    expected_output: "state.compliance.bootstrapped_this_session set + activity feed entry",
    justification: "Visibility is the whole point — the gap must surface in the Observatory, not just the raw log.",
    run() {
      const agg = new Aggregator();
      agg.ingestEvent(ev("bootstrapped_this_session", bootstrappedThisSessionPayload({ project: "acme" })));
      const rec = agg.state.compliance.bootstrapped_this_session;
      const feed = agg.state.activity.feed.some((f) => f.kind === "cold-start");
      const ok = !!rec && rec.project === "acme" && rec.cold_start_advised === true && feed;
      return { actual: `rec=${!!rec}, project=${rec?.project}, feed=${feed}`, pass: ok };
    },
  },
  {
    id: "BR-09_ScriptMarker", type: "---", framework_location: "scripts/lib/mark-bootstrapped.mjs",
    title: "Bootstrap SCRIPT persists the marker (true hookless cold-start)",
    expected_input: "node scripts/lib/mark-bootstrapped.mjs against a temp Loom root",
    expected_output: "a bootstrapped_this_session event (source: bootstrap-script) in that root's event log",
    justification: "Critic re-review 2026-07-15: the true founding session never fires the hook AND placeholders vanish after stamping — so ONLY the bootstrap-script call persists the marker. This exercises that path end-to-end.",
    run() {
      const tmp = mkdtempSync(path.join(os.tmpdir(), "loom-boot-"));
      try {
        // Make the temp dir look like a Loom root (isLoomRoot checks these).
        writeFileSync(path.join(tmp, "loom-spec.md"), "x");
        mkdirSync(path.join(tmp, "constitution"), { recursive: true });
        writeFileSync(path.join(tmp, "constitution", "kernel-v6.md"), "x");
        mkdirSync(path.join(tmp, ".claude"), { recursive: true });
        writeFileSync(path.join(tmp, ".claude", "loom-permissions.yaml"), "x");
        const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/lib/mark-bootstrapped.mjs"), "testproj"], {
          cwd: tmp, env: { ...process.env, LOOM_PROJECT_ROOT: tmp }, encoding: "utf8",
        });
        const logDir = path.join(tmp, "memory", "event-log");
        let found = null;
        if (existsSync(logDir)) {
          for (const f of readdirSync(logDir)) {
            for (const line of readFileSync(path.join(logDir, f), "utf8").split("\n")) {
              if (!line.trim()) continue;
              const rec = JSON.parse(line);
              if (rec.event_type === "bootstrapped_this_session") found = rec;
            }
          }
        }
        const ok = r.status === 0 && found && found.source === "bootstrap-script" && found.project === "testproj" && found.stamped === true;
        return { actual: found ? `marker: source=${found.source}, project=${found.project}, stamped=${found.stamped}` : "no marker written", pass: !!ok };
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    id: "BR-09_BE-01", type: "BE", framework_location: "observatory/lib/aggregator.mjs",
    title: "Banner shows on a healthy session (false-alarm fatigue)",
    expected_input: "a normal session_start (no bootstrap)",
    expected_output: "NO bootstrapped_this_session marker set",
    justification: "The marker/advisory must fire ONLY when the project was stamped this session — a spurious alarm on every healthy session would train operators to ignore it.",
    run() {
      const agg = new Aggregator();
      agg.ingestEvent(ev("session_start", { source: "claude-code" }));
      const ok = agg.state.compliance.bootstrapped_this_session === undefined;
      return { actual: `marker-after-healthy-session=${agg.state.compliance.bootstrapped_this_session === undefined ? "absent" : "PRESENT"}`, pass: ok };
    },
  },
];
