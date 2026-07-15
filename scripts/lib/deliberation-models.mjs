// Deliberation panel — model adapters (ADR-0056). The model-diverse arm.
//
// A model adapter is an async fn returning a vote { agent, model, family,
// answer, reason } or { ok:false, error } when the model is unavailable /
// unparseable. The panel core (deliberation.mjs) degrades gracefully on
// { ok:false } — an external model must never break the panel (SE).
//
// `ollamaVote` is a LIVE call to a local Ollama server — a genuine non-Claude
// vote (honest scope: the second model really runs; it is not stubbed). No
// credential is needed (local), so LR-03 is satisfied by construction; a hosted
// model (Gemini) would fetch its key via scripts/lib/keyring.mjs, never args.
//
// The Claude arm is model-in-the-loop: the orchestrating Claude supplies its own
// answer + self-consistency samples (the Loom Claim convention) — see the
// getSamples() callback in runDeliberation. This module is the *second* model.

import { appendEvent, mechanicalRecord } from "../hooks/_lib.mjs";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.LOOM_PANEL_OLLAMA_MODEL || "llama3:8b-instruct-q4_K_M";

/**
 * Emit a `loop_cost_summary` for a completed deliberation run (LR-06 — an
 * iterative multi-agent pattern must record its actual call count + estimated
 * spend to the event log). Best-effort; never throws. Pass as runDeliberation's
 * `onCost`, or call directly with the result. The Observatory cost panel already
 * ingests `loop_cost_summary` (see observatory/lib/aggregator.mjs).
 */
export function emitDeliberationCost(result = {}, { loop_id = "deliberation", model = DEFAULT_MODEL, estTokensPerCall = 1500 } = {}) {
  try {
    const calls = result.cost || 0;
    appendEvent(mechanicalRecord("loop_cost_summary", {
      loop_id,
      pattern: "deliberation-panel",
      iteration_count: calls,
      agent_count: (result.votes && result.votes.length) || 0,
      model,
      estimated_input_tokens: calls * estTokensPerCall,
      estimated_output_tokens: calls * Math.round(estTokensPerCall / 3),
      exit_reason: result.method || "unknown",
      wall_clock_ms: null,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * One live vote from a local Ollama model. Returns a normalized vote, or
 * { ok:false, error } on timeout / connection failure / unparseable output —
 * never throws (the panel degrades on it).
 *
 * @param {object} o
 * @param {string} o.question   the decision to vote on
 * @param {string[]} [o.options] allowed answers (the model is told to pick one)
 * @param {number} [o.timeoutMs]
 */
export async function ollamaVote({ question, options = null, model = DEFAULT_MODEL, host = OLLAMA_HOST, timeoutMs = 120000 } = {}) {
  // 120s default tolerates a cold model load (first call loads ~5GB into RAM);
  // warm calls return in a few seconds. On timeout the panel degrades (SE-01).
  const optionLine = options && options.length
    ? `Choose EXACTLY ONE of these answers: ${options.map((o) => JSON.stringify(o)).join(", ")}.`
    : "Give a single short answer.";
  const prompt =
    `${question}\n\n${optionLine}\n` +
    `Respond ONLY as compact JSON: {"answer": <your answer>, "reason": "<one sentence>"}.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0 } }),
      signal: controller.signal,
    });
    if (!resp.ok) return { ok: false, error: `http_${resp.status}`, model };
    const data = await resp.json();
    // With format:"json", data.response is a JSON string.
    let parsed;
    try { parsed = JSON.parse(data.response); } catch { return { ok: false, error: "unparseable", model, raw: data.response }; }
    let answer = parsed.answer;
    if (answer === undefined || answer === null) return { ok: false, error: "no_answer", model, raw: data.response };
    // Snap to an allowed option if provided (case-insensitive), else keep raw.
    if (options && options.length) {
      const match = options.find((o) => String(o).toLowerCase() === String(answer).toLowerCase());
      if (match !== undefined) answer = match;
    }
    return {
      ok: true, agent: `ollama/${model}`, model, family: "llama",
      answer, reason: parsed.reason || "", raw: data.response,
    };
  } catch (e) {
    return { ok: false, error: e.name === "AbortError" ? "timeout" : "unavailable", model, detail: String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Is a local Ollama server reachable? (fast, no generation). */
export async function ollamaAvailable({ host = OLLAMA_HOST, timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${host}/api/tags`, { signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
