/**
 * agent-runner.mjs — how a persona actually executes.
 *
 * §7 of the kickoff: the source layer must be an ADAPTER WITH TWO TRANSPORTS,
 * because the sandbox and the operator's laptop have different network reality.
 *
 *   research transport   'websearch'   WebSearch only. Works in the sandbox
 *                                      (WebFetch / curl are EGRESS_BLOCKED).
 *                        'direct-api'  WebSearch + WebFetch + direct HTTP.
 *                                      Works on the operator's own machine.
 *
 *   agent transport      'claude-cli'  shells out to `claude -p` headless
 *                        'mock'        injected function, for tests
 *
 * Nothing here decides anything about the world. It moves prompts out and
 * validated JSON back, and it refuses to spend more than the run budget (LR-06).
 */
import { spawn } from 'node:child_process';

export const RESEARCH_TRANSPORTS = {
  websearch: {
    id: 'websearch',
    allowedTools: ['WebSearch'],
    note: 'Sandbox-safe. WebFetch/curl are blocked by the egress proxy; WebSearch is server-side and reaches Tier-1 content indirectly.',
  },
  'direct-api': {
    id: 'direct-api',
    allowedTools: ['WebSearch', 'WebFetch'],
    note: "Operator's own machine: can hit sec.gov / fred / bls directly.",
  },
};

export class BudgetExceededError extends Error {
  constructor(msg, ledger) {
    super(msg);
    this.name = 'BudgetExceededError';
    this.ledger = ledger;
  }
}

/**
 * @param {object} opts
 * @param {'claude-cli'|'mock'} opts.transport
 * @param {'websearch'|'direct-api'} opts.researchTransport
 * @param {(prompt:string, meta:object)=>Promise<{text:string,costUsd?:number}>} [opts.invoke] for 'mock'
 */
export function createAgentRunner({
  transport = 'claude-cli',
  researchTransport = 'websearch',
  model = 'claude-sonnet-5',
  timeoutMs = 900_000,
  maxTurns = 40,
  maxRetries = 2,
  maxSpendUsd = 8,
  invoke = null,
  logger = console,
} = {}) {
  const rt = RESEARCH_TRANSPORTS[researchTransport];
  if (!rt) throw new Error(`unknown research transport "${researchTransport}"`);
  if (transport === 'mock' && typeof invoke !== 'function') {
    throw new Error('transport "mock" requires an invoke(prompt, meta) function');
  }

  const ledger = { calls: [], spentUsd: 0, maxSpendUsd };

  function assertBudget(label) {
    if (ledger.spentUsd >= maxSpendUsd) {
      throw new BudgetExceededError(
        `run budget exhausted: $${ledger.spentUsd.toFixed(4)} spent of $${maxSpendUsd} before "${label}". ` +
          'Raise agent.maxSpendUsd in config, or narrow the domain.',
        ledger,
      );
    }
  }

  /**
   * Run one agent turn and return parsed JSON matching `expect`.
   * @returns {Promise<{ok:boolean, data:any, costUsd:number, attempts:number, error?:string, raw?:string}>}
   */
  async function run({ label, prompt, expect = 'object' }) {
    assertBudget(label);
    let lastErr = null;
    let raw = '';
    let cost = 0;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const fullPrompt =
        attempt === 1
          ? prompt
          : `${prompt}\n\n---\nYOUR PREVIOUS REPLY COULD NOT BE PARSED: ${lastErr}\nReply with ONLY the raw JSON ${expect}. No prose, no markdown fence, no commentary.`;

      let res;
      const started = Date.now();
      try {
        res =
          transport === 'mock'
            ? await invoke(fullPrompt, { label, attempt, model })
            : await runClaudeCli(fullPrompt, { model, timeoutMs, maxTurns, allowedTools: rt.allowedTools });
      } catch (err) {
        lastErr = err.message;
        logger.warn?.(`  ! ${label} attempt ${attempt} failed to execute: ${err.message}`);
        continue;
      }

      raw = res.text ?? '';
      const spent = Number(res.costUsd) || 0;
      cost += spent;
      ledger.spentUsd += spent;
      ledger.calls.push({ label, attempt, costUsd: spent, ms: Date.now() - started });

      try {
        const data = extractJson(raw, expect);
        return { ok: true, data, costUsd: cost, attempts: attempt, raw };
      } catch (err) {
        lastErr = err.message;
        logger.warn?.(`  ! ${label} attempt ${attempt}: ${err.message}`);
      }
      if (attempt <= maxRetries) assertBudget(`${label} retry ${attempt + 1}`);
    }

    return { ok: false, data: null, costUsd: cost, attempts: maxRetries + 1, error: lastErr, raw };
  }

  return { run, ledger, researchTransport: rt, model, transport };
}

// --- claude-cli transport ---------------------------------------------------

export function runClaudeCli(prompt, { model, timeoutMs, maxTurns, allowedTools, bin = 'claude' } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'json',
      '--model', model,
      '--max-turns', String(maxTurns),
      '--allowed-tools', allowedTools.join(','),
    ];
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`could not spawn "${bin}": ${e.message}. Is Claude Code installed and on PATH?`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`claude CLI exited ${code}: ${err.slice(-500) || out.slice(-500)}`));
      }
      let envelope;
      try {
        envelope = JSON.parse(out);
      } catch {
        return reject(new Error(`claude CLI did not return JSON envelope: ${out.slice(-300)}`));
      }
      if (envelope.is_error) {
        return reject(new Error(`claude CLI reported an error: ${String(envelope.result).slice(0, 300)}`));
      }
      resolve({ text: String(envelope.result ?? ''), costUsd: Number(envelope.total_cost_usd) || 0, envelope });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// --- JSON extraction --------------------------------------------------------

/**
 * Models wrap JSON in prose and fences no matter how firmly you ask. Recover it.
 * @param {string} text
 * @param {'object'|'array'} expect
 */
export function extractJson(text, expect = 'object') {
  const s = String(text ?? '').trim();
  if (!s) throw new Error('empty response');

  const open = expect === 'array' ? '[' : '{';
  const close = expect === 'array' ? ']' : '}';

  const tryParse = (candidate) => {
    const v = JSON.parse(candidate);
    const isArr = Array.isArray(v);
    if (expect === 'array' && !isArr) throw new Error('expected a JSON array');
    if (expect === 'object' && (isArr || v === null || typeof v !== 'object')) throw new Error('expected a JSON object');
    return v;
  };

  // 1. straight parse
  try { return tryParse(s); } catch { /* fall through */ }

  // 2. fenced block
  const fence = s.match(/```(?:json|jsonc)?\s*\n([\s\S]*?)\n?```/i);
  if (fence) {
    try { return tryParse(fence[1].trim()); } catch { /* fall through */ }
  }

  // 3. first balanced bracket run (string- and escape-aware)
  const start = s.indexOf(open);
  if (start >= 0) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try { return tryParse(s.slice(start, i + 1)); } catch (e) { throw new Error(`found a JSON ${expect} but it did not parse: ${e.message}`); }
        }
      }
    }
  }

  throw new Error(`no JSON ${expect} found in response (got ${s.length} chars starting "${s.slice(0, 80)}...")`);
}
