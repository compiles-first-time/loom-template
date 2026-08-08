import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runFunnel, dedupe } from '../lib/funnel.mjs';
import { createAgentRunner, extractJson, BudgetExceededError } from '../lib/agent-runner.mjs';
import { createMemory } from '../lib/memory.mjs';
import { loadConfig } from '../lib/config.mjs';
import { PERSONAS } from '../lib/personas/index.mjs';
import { mockInvoke, FIXTURE_SCAN } from '../lib/mock-transport.mjs';
import { renderBrief, checkContract, BriefContractError, briefFilename } from '../lib/report.mjs';

const quiet = { log() {}, warn() {}, error() {} };

function sandbox() {
  const root = mkdtempSync(resolve(tmpdir(), 'prospector-fun-'));
  mkdirSync(resolve(root, 'references'), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

async function run(overrides = {}) {
  const { root, cleanup } = sandbox();
  const config = loadConfig();
  const runner = createAgentRunner({ transport: 'mock', invoke: mockInvoke, maxSpendUsd: 1, logger: quiet });
  const result = await runFunnel({
    domain: 'test domain',
    personas: [PERSONAS['ai-automation-analyst']],
    runner,
    memory: createMemory({ root }),
    config: { ...config, ...overrides },
    operatorProfile: '## Operator\nfixture profile',
    date: '2026-08-08',
    runId: 'test-run',
    logger: quiet,
  });
  cleanup();
  return result;
}

// --- end-to-end ------------------------------------------------------------
test('SMOKE: the funnel runs end to end and produces at least one brief', async () => {
  const r = await run();
  assert.equal(r.ok, true, r.reason ?? '');
  assert.ok(r.briefs.length >= 1);
  assert.match(r.briefs[0].markdown, /^# /);
});

test('the constraint filter runs BEFORE any deep-dive spend', async () => {
  const r = await run();
  const rejectedIds = r.rejected.map((x) => x.id);
  assert.ok(rejectedIds.includes('fixture-capital-reject'), 'the $250k candidate must be rejected');
  assert.ok(rejectedIds.includes('fixture-disconfirmed'), 'the gaming-market candidate must be rejected');
  // Only the survivor reached the deep-dive stage.
  const deepDiveCalls = r.ledger.calls.filter((c) => c.label.startsWith('deepdive'));
  assert.equal(deepDiveCalls.length, 1);
  assert.equal(r.shortlist[0].id, 'fixture-validation-package');
});

test('scoring is done by code, and the brief shows the arithmetic', async () => {
  const r = await run();
  // 0.25*9 + 0.25*7 + 0.20*8 + 0.15*7 + 0.15*8 = 7.85
  assert.equal(r.shortlist[0].score, 7.85);
  assert.match(r.briefs[0].markdown, /= 7\.85 \/ 10\.00/);
});

test('the source-tier gate strips SEO content farms from the brief evidence', async () => {
  const r = await run();
  const ev = r.briefs[0].evidence;
  assert.ok(ev.droppedSourceCount >= 2, 'the two rate-farm sources must be dropped');
  const farmClaim = ev.claims.find((c) => c.claim.includes('$150-350/hr'));
  assert.equal(farmClaim.accepted.length, 0);
  assert.equal(farmClaim.usable, false);
  assert.match(r.briefs[0].markdown, /Appendix — rejected sources/);
  assert.match(r.briefs[0].markdown, /consultingsuccess\.com/);
});

test('every brief carries blind spots and kill criteria', async () => {
  const r = await run();
  for (const b of r.briefs) {
    assert.match(b.markdown, /## Blind spots/);
    assert.match(b.markdown, /## Kill criteria/);
    assert.match(b.markdown, /## Base-rate honesty/);
    assert.match(b.markdown, /## Next 3 actions/);
  }
});

test('a run record captures the stages, ledger and rejections', async () => {
  const r = await run();
  assert.deepEqual(r.stages.map((s) => s.stage), ['generate', 'filter', 'dedupe', 'score', 'deep-dive']);
  assert.ok(typeof r.ledger.spentUsd === 'number');
  assert.ok(r.standingAnswers.length === 1);
  assert.ok(r.standingAnswers[0].whatChanged);
});

test('an impossible score floor yields no briefs and says why, instead of failing silently', async () => {
  const config = loadConfig();
  const r = await run({ scoring: { ...config.scoring, shortlistMinScore: 9.9 } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /nothing scored >= 9\.9/);
  assert.equal(r.briefs.length, 0);
});

// --- report contract -------------------------------------------------------
test('a brief with no blind spots does not render — the section is mandatory', () => {
  const base = {
    candidate: {
      id: 'x', title: 't', thesis: 'th', category: 'services', catalyst: { whyNow: 'n' },
      whyNick: 'w', capitalRequiredUsd: 0, hoursPerWeek: 20, distribution: { buyer: 'b', channel: 'c' },
    },
    scoring: { score: 7, max: 10, arithmetic: 'a', breakdown: [], weights: {} },
    evidence: { claims: [], droppedSourceCount: 0 },
    deepDive: {
      baseRate: { statement: 'unknown' }, risks: [{ risk: 'r', likelihood: 'high' }],
      killCriteria: ['k'], blindSpots: [], nextActions: ['a'],
    },
  };
  assert.throws(() => renderBrief(base), BriefContractError);
  assert.deepEqual(checkContract(base), ['blindSpots']);
  base.deepDive.blindSpots = ['we cannot see budget ownership'];
  assert.deepEqual(checkContract(base), []);
  assert.match(renderBrief(base), /we cannot see budget ownership/);
});

test('brief filenames are dated and slugged', () => {
  assert.equal(briefFilename('GxP Validation!! Package', '2026-08-08'), '2026-08-08-gxp-validation-package.md');
});

// --- dedupe ----------------------------------------------------------------
test('dedupe collapses reworded duplicates and records convergence', () => {
  const mk = (id, title, persona, edgeFit) => ({ id, title, persona, factors: { edgeFit: { value: edgeFit } } });
  const out = dedupe([
    mk('ai-audit-readiness', 'AI audit readiness', 'a', 7),
    mk('audit-readiness-ai', 'Audit readiness for AI', 'b', 9),
    mk('something-else', 'Something else', 'a', 5),
  ]);
  assert.equal(out.length, 2);
  const kept = out.find((c) => c.title.startsWith('Audit'));
  assert.deepEqual(kept.convergedWith, ['a']);
});

// --- agent runner ----------------------------------------------------------
test('extractJson survives fences, prose wrappers and nested braces', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Sure! Here you go:\n```\n{"a":{"b":2}}\n```\nHope that helps.'), { a: { b: 2 } });
  assert.deepEqual(extractJson('noise {"a":"}"} noise'), { a: '}' }, 'braces inside strings must not end the scan');
  assert.deepEqual(extractJson('[1,2]', 'array'), [1, 2]);
  assert.throws(() => extractJson('no json here'), /no JSON object found/);
  assert.throws(() => extractJson(''), /empty response/);
  assert.throws(() => extractJson('[1]', 'object'), /no JSON object found/);
});

test('the runner retries an unparseable reply, then reports failure honestly', async () => {
  let calls = 0;
  const runner = createAgentRunner({
    transport: 'mock', maxRetries: 2, maxSpendUsd: 10, logger: quiet,
    invoke: async () => { calls++; return { text: 'I cannot help with that.', costUsd: 0.01 }; },
  });
  const r = await runner.run({ label: 'x', prompt: 'p' });
  assert.equal(r.ok, false);
  assert.equal(calls, 3);
  assert.equal(r.attempts, 3);
  assert.ok(r.error);
  assert.ok(Math.abs(runner.ledger.spentUsd - 0.03) < 1e-9);
});

test('the runner recovers when a retry returns valid JSON', async () => {
  let calls = 0;
  const runner = createAgentRunner({
    transport: 'mock', maxRetries: 2, maxSpendUsd: 10, logger: quiet,
    invoke: async () => (++calls === 1 ? { text: 'nope', costUsd: 0 } : { text: '{"ok":true}', costUsd: 0 }),
  });
  const r = await runner.run({ label: 'x', prompt: 'p' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { ok: true });
  assert.equal(r.attempts, 2);
});

test('the runner refuses to exceed the run budget (LR-06 token-cost awareness)', async () => {
  const runner = createAgentRunner({
    transport: 'mock', maxSpendUsd: 0.05, maxRetries: 0, logger: quiet,
    invoke: async () => ({ text: '{"ok":true}', costUsd: 0.04 }),
  });
  await runner.run({ label: 'a', prompt: 'p' });
  await runner.run({ label: 'b', prompt: 'p' });
  await assert.rejects(() => runner.run({ label: 'c', prompt: 'p' }), BudgetExceededError);
});

test('mock transport without an invoke function is a configuration error', () => {
  assert.throws(() => createAgentRunner({ transport: 'mock' }), /requires an invoke/);
});

test('an unknown research transport is rejected', () => {
  assert.throws(() => createAgentRunner({ researchTransport: 'carrier-pigeon' }), /unknown research transport/);
});

test('research transports expose the right tool sets for each environment', () => {
  const sandboxRunner = createAgentRunner({ transport: 'mock', invoke: mockInvoke, researchTransport: 'websearch' });
  const laptopRunner = createAgentRunner({ transport: 'mock', invoke: mockInvoke, researchTransport: 'direct-api' });
  assert.deepEqual(sandboxRunner.researchTransport.allowedTools, ['WebSearch']);
  assert.ok(laptopRunner.researchTransport.allowedTools.includes('WebFetch'));
});

// --- fixture integrity -----------------------------------------------------
test('the dry-run fixture still covers pass / capital-reject / disconfirmed', () => {
  const ids = FIXTURE_SCAN.candidates.map((c) => c.id);
  assert.deepEqual(ids, ['fixture-validation-package', 'fixture-capital-reject', 'fixture-disconfirmed']);
});
