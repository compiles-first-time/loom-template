import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createMemory, LEARNING_RATES } from '../lib/memory.mjs';

function sandbox() {
  const root = mkdtempSync(resolve(tmpdir(), 'prospector-mem-'));
  mkdirSync(resolve(root, 'references'), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('reads an empty bank as an empty entry list rather than throwing', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  assert.deepEqual(m.read('verdicts').entries, []);
  cleanup();
});

test('append is additive, idempotent on id, and round-trips', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  assert.equal(m.append('examples', { id: 'e1', title: 'one' }).added, true);
  assert.equal(m.append('examples', { id: 'e1', title: 'one revised' }).added, false);
  const entries = m.read('examples').entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'one revised');
  cleanup();
});

test('a corrupt bank fails loudly instead of being silently reset', () => {
  const { root, cleanup } = sandbox();
  writeFileSync(resolve(root, 'references/verdicts.json'), '{not json', 'utf8');
  assert.throws(() => createMemory({ root }).read('verdicts'), /corrupt/);
  cleanup();
});

test('unknown bank names are rejected', () => {
  const { root, cleanup } = sandbox();
  assert.throws(() => createMemory({ root }).read('feelings'), /unknown memory bank/);
  cleanup();
});

test('records act/watch/kill and rejects anything else', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  m.recordVerdict({ briefId: 'b1', verdict: 'ACT', rationale: 'buyer confirmed' });
  const e = m.read('verdicts').entries[0];
  assert.equal(e.verdict, 'act');
  assert.equal(e.briefId, 'b1');
  assert.equal(e.endorsedAt6Months, null);
  assert.throws(() => m.recordVerdict({ briefId: 'b2', verdict: 'maybe' }), /must be one of/);
  assert.throws(() => m.recordVerdict({ verdict: 'act' }), /needs a briefId/);
  cleanup();
});

// --- learning rates: the anti-overfit guard --------------------------------
test('one signal updates an example but cannot change a process rule', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  assert.equal(m.canLearn({ kind: 'example', signals: ['s1'] }).allowed, true);
  const p = m.canLearn({ kind: 'process', signals: ['s1'] });
  assert.equal(p.allowed, false);
  assert.match(p.reason, /Never overfit to one bad brief/);
  cleanup();
});

test('two signals unlock a process rule; three plus approval unlock a structural change', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  assert.equal(m.canLearn({ kind: 'process', signals: ['a', 'b'] }).allowed, true);
  assert.equal(m.canLearn({ kind: 'structural', signals: ['a', 'b', 'c'] }).allowed, false, 'needs approval too');
  assert.match(m.canLearn({ kind: 'structural', signals: ['a', 'b', 'c'] }).reason, /explicit operator approval/);
  assert.equal(m.canLearn({ kind: 'structural', signals: ['a', 'b', 'c'], approved: true }).allowed, true);
  assert.equal(m.canLearn({ kind: 'structural', signals: ['a', 'b'], approved: true }).allowed, false, 'approval does not bypass the signal count');
  cleanup();
});

test('learning rates match the spec', () => {
  assert.equal(LEARNING_RATES.example.minSignals, 1);
  assert.equal(LEARNING_RATES.process.minSignals, 2);
  assert.equal(LEARNING_RATES.structural.minSignals, 3);
  assert.equal(LEARNING_RATES.structural.requiresApproval, true);
});

test('unknown learning kinds are rejected', () => {
  const { root, cleanup } = sandbox();
  assert.throws(() => createMemory({ root }).canLearn({ kind: 'vibes', signals: [] }), /unknown learning kind/);
  cleanup();
});

// --- north star ------------------------------------------------------------
test('north star reports null until an Acted brief reaches its checkpoint', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  m.recordVerdict({ briefId: 'b1', verdict: 'act' });
  assert.equal(m.northStar().rate, null);
  assert.match(m.northStar().note, /6-month checkpoint/);

  const data = m.read('verdicts');
  data.entries[0].endorsedAt6Months = true;
  m.write('verdicts', data);
  assert.equal(m.northStar().rate, 1);
  assert.equal(m.northStar().actedCount, 1);
  cleanup();
});

test('north star counts only Acted briefs', () => {
  const { root, cleanup } = sandbox();
  const m = createMemory({ root });
  m.recordVerdict({ briefId: 'b1', verdict: 'kill' });
  m.recordVerdict({ briefId: 'b2', verdict: 'watch' });
  assert.equal(m.northStar().actedCount, 0);
  cleanup();
});
