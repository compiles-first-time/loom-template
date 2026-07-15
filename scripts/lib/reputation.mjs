// Agent-reputation signal emitter — ADR-0053 Step 1 (Guardrail A).
//
// Mirrors the testcase/ticket emitters: appends a `reputation_event` (a single
// track-record accrual) to today's event log so the Observatory reputation
// projection (observatory/lib/reputation.mjs) populates. Signals should carry a
// `source_event` provenance link (Rule 22) — best-effort, defaulted to null.
//
// Projection-only: emitting a signal records track record; it confers NO
// dispatch preference. Preferential dispatch (ADR-0053 Steps 2-3) is gated on a
// constitution-service re-validation and is intentionally absent here.

import { appendEvent, mechanicalRecord } from "../hooks/_lib.mjs";
import { REPUTATION_KINDS } from "../../observatory/lib/reputation.mjs";

export { REPUTATION_KINDS };

export function buildReputationEventFields(r = {}) {
  return {
    agent: r.agent || null,
    kind: r.kind || null,          // one of REPUTATION_KINDS
    source_event: r.source_event || null, // provenance: the event this accrues from
    note: r.note || "",
  };
}

/**
 * Emit a `reputation_event`. Best-effort: never throws (returns false on
 * failure) so a hook or verifier gate can call it without risk.
 */
export function emitReputationEvent(r = {}) {
  try {
    appendEvent(mechanicalRecord("reputation_event", { session_id: r.session_id, ...buildReputationEventFields(r) }));
    return true;
  } catch {
    return false;
  }
}
