// Canonical BR_11 test cases (verifier gate → reputation emission / ADR-0044 + ADR-0053).
//
// Consumed by scripts/lib/verify-gate.test.mjs. Closes the map's finding that
// emitReputationEvent was never called: this asserts the verifier gate is a REAL
// emission point. The end-to-end case spawns the gate in a temp Loom root and
// reads back the emitted events; projection cases use synthetic event streams.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { recordVerification, recordLessonContributed, VERIFIER_TYPES } from "../../../scripts/lib/verify-gate.mjs";
import { computeReputation } from "../../../observatory/lib/reputation.mjs";
import { Aggregator } from "../../../observatory/lib/aggregator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const T = "2026-07-15T12:00:00.000Z";
const ev = (event_type, extra = {}) => ({ timestamp: T, session_id: "s1", event_type, ...extra });

// Run the verify-gate CLI in a throwaway Loom root; return the events it wrote.
function runGateInTempRoot(agent, outcome) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "loom-verify-"));
  try {
    writeFileSync(path.join(tmp, "loom-spec.md"), "x");
    mkdirSync(path.join(tmp, "constitution"), { recursive: true });
    writeFileSync(path.join(tmp, "constitution", "kernel-v6.md"), "x");
    mkdirSync(path.join(tmp, ".claude"), { recursive: true });
    writeFileSync(path.join(tmp, ".claude", "loom-permissions.yaml"), "x");
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/lib/verify-gate.mjs"), agent, outcome, "did the thing"], {
      cwd: tmp, env: { ...process.env, LOOM_PROJECT_ROOT: tmp }, encoding: "utf8",
    });
    const events = [];
    const logDir = path.join(tmp, "memory", "event-log");
    if (existsSync(logDir)) {
      for (const f of readdirSync(logDir)) {
        for (const line of readFileSync(path.join(logDir, f), "utf8").split("\n")) {
          if (line.trim()) { try { events.push(JSON.parse(line)); } catch { /* skip */ } }
        }
      }
    }
    return { status: r.status, events };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export const BR_11_CASES = [
  {
    id: "BR_11", type: "BR", framework_location: "scripts/lib/verify-gate.mjs",
    title: "Reputation accrues from a REAL verifier signal (not just invocation)",
    expected_input: "verify-gate CLI: agent + pass, run in a temp Loom root",
    expected_output: "a verifier_result event + a reputation_event(verifier_pass); projection reflects it",
    justification: "The map found emitReputationEvent was never called — only 'invocation' populated. The verifier gate is the missing call site (ADR-0044 → ADR-0053).",
    run() {
      const { status, events } = runGateInTempRoot("eac", "pass");
      const vr = events.find((e) => e.event_type === "verifier_result" && e.agent === "eac" && e.passed === true);
      const re = events.find((e) => e.event_type === "reputation_event" && e.agent === "eac" && e.kind === "verifier_pass");
      const proj = computeReputation(events);
      const ok = status === 0 && !!vr && !!re && proj.agents.eac?.verifier_pass === 1 && proj.agents.eac?.score > 0;
      return { actual: `status=${status}, verifier_result=${!!vr}, reputation_event=${!!re}, eac.score=${proj.agents.eac?.score?.toFixed(3)}`, pass: ok };
    },
  },
  {
    id: "BR-11_s1", type: "---", framework_location: "scripts/lib/verify-gate.mjs",
    title: "recordVerification returns the outcome + validates verifier_type",
    expected_input: "recordVerification({agent, passed:true, verifier_type:'test_suite'})",
    expected_output: "{agent, passed:true, verifier_type}; type is an ADR-0044 type",
    justification: "The gate's contract: an auditable, typed verifier outcome per ADR-0044.",
    run() {
      const r = recordVerification({ agent: "critic", passed: true, verifier_type: "test_suite", task: "unit" });
      const ok = r.agent === "critic" && r.passed === true && VERIFIER_TYPES.includes(r.verifier_type);
      return { actual: JSON.stringify(r), pass: ok };
    },
  },
  {
    id: "BR-11_SE-01", type: "SE", framework_location: "scripts/lib/verify-gate.mjs",
    title: "Verification with NO agent → audit only, no crash, no accrual",
    expected_input: "recordVerification({passed:true}) (agent omitted)",
    expected_output: "returns {agent:null}; does not throw",
    justification: "A verifier outcome not attributable to an agent must still audit-log without corrupting the projection.",
    run() {
      let threw = false; let r;
      try { r = recordVerification({ passed: true, task: "anon" }); } catch { threw = true; }
      const ok = !threw && r && r.agent === null && r.passed === true;
      return { actual: threw ? "threw" : `agent=${r.agent}`, pass: ok };
    },
  },
  {
    id: "BR-11_BE-01", type: "BE", framework_location: "observatory/lib/reputation.mjs",
    title: "A verifier_fail smooths, does not tank a small-sample agent",
    expected_input: "one verifier_fail reputation_event for a new agent",
    expected_output: "score reflects Beta-prior smoothing (>0), not 0",
    justification: "Reputation is a quality RATE — a single failure must not zero out a new agent (2026-07-07 refinement).",
    run() {
      const proj = computeReputation([ev("reputation_event", { agent: "rookie", kind: "verifier_fail" })]);
      const rec = proj.agents.rookie;
      const ok = rec && Math.abs(rec.smoothed_pass_rate - 0.4) < 1e-9 && rec.score > 0;
      return { actual: `smoothed=${rec?.smoothed_pass_rate}, score=${rec?.score}`, pass: !!ok };
    },
  },
  {
    id: "BR-11_Lesson", type: "---", framework_location: "scripts/lib/verify-gate.mjs",
    title: "recordLessonContributed accrues lesson_contributed (promote-lessons path)",
    expected_input: "recordLessonContributed({agent:'memory-keeper', lesson_id})",
    expected_output: "returns the attribution; projection would credit lesson_contributed",
    justification: "The specialist-lifecycle promote-lessons path credits shared-lesson contributions (ADR-0030 → ADR-0053).",
    run() {
      const r = recordLessonContributed({ agent: "memory-keeper", lesson_id: "2026-07-10-x" });
      // Projection effect (synthetic — proves the kind is scored):
      const proj = computeReputation([ev("reputation_event", { agent: "memory-keeper", kind: "lesson_contributed" })]);
      const ok = r.agent === "memory-keeper" && proj.agents["memory-keeper"]?.lessons_contributed === 1;
      return { actual: `attributed=${r.agent}, lessons=${proj.agents["memory-keeper"]?.lessons_contributed}`, pass: !!ok };
    },
  },
  {
    id: "BR-11_Wire", type: "---", framework_location: "observatory/lib/aggregator.mjs",
    title: "verifier_result is audited + reputation accrues in the aggregator",
    expected_input: "Aggregator.ingestEvent(verifier_result) + paired reputation_event",
    expected_output: "state.compliance.verifications populated; state.reputation.agents scored",
    justification: "The Observatory surfaces verifier outcomes (audit) and the reputation panel reflects the accrual.",
    run() {
      const agg = new Aggregator();
      agg.ingestEvent(ev("verifier_result", { agent: "ci", passed: true, verifier_type: "test_suite", task: "suite" }));
      agg.ingestEvent(ev("reputation_event", { agent: "ci", kind: "verifier_pass" }));
      const audited = (agg.state.compliance.verifications || []).some((v) => v.agent === "ci" && v.passed);
      const scored = agg.state.reputation.agents.ci?.verifier_pass === 1;
      return { actual: `audited=${audited}, scored=${scored}`, pass: audited && scored };
    },
  },
];
