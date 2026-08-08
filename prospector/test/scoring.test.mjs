import test from 'node:test';
import assert from 'node:assert/strict';
import { score, rank, validateWeights, DEFAULT_WEIGHTS, FACTORS } from '../lib/scoring.mjs';

const perfect = { edgeFit: 10, asymmetry: 10, tractability: 10, timing: 10, downsideProtection: 10 };
const zero = { edgeFit: 0, asymmetry: 0, tractability: 0, timing: 0, downsideProtection: 0 };

test('weights sum to 1 and match the spec', () => {
  assert.equal(validateWeights(DEFAULT_WEIGHTS), true);
  assert.deepEqual(DEFAULT_WEIGHTS, {
    edgeFit: 0.25, asymmetry: 0.25, tractability: 0.2, timing: 0.15, downsideProtection: 0.15,
  });
});

test('rejects weights that do not sum to 1', () => {
  assert.throws(() => validateWeights({ ...DEFAULT_WEIGHTS, timing: 0.5 }), /sum to 1/);
});

test('rejects weights with a missing or unknown factor', () => {
  const { timing, ...missing } = DEFAULT_WEIGHTS;
  assert.throws(() => validateWeights(missing), /missing factor/);
  assert.throws(() => validateWeights({ ...DEFAULT_WEIGHTS, luck: 0 }), /unknown factor/);
});

test('bounds: all-10 scores 10, all-0 scores 0', () => {
  assert.equal(score(perfect).score, 10);
  assert.equal(score(zero).score, 0);
});

test('worked example matches hand arithmetic', () => {
  // 0.25*9 + 0.25*7 + 0.20*8 + 0.15*7 + 0.15*8
  // = 2.25 + 1.75 + 1.60 + 1.05 + 1.20 = 7.85
  const r = score({ edgeFit: 9, asymmetry: 7, tractability: 8, timing: 7, downsideProtection: 8 });
  assert.equal(r.score, 7.85);
});

test('is deterministic — same input, same output, every time', () => {
  const f = { edgeFit: 6, asymmetry: 9, tractability: 4, timing: 8, downsideProtection: 3 };
  const first = score(f);
  for (let i = 0; i < 50; i++) assert.equal(score(f).score, first.score);
});

test('accepts {value, why} objects and carries the justification through', () => {
  const r = score({
    edgeFit: { value: 9, why: 'uses the GxP tour' },
    asymmetry: 7, tractability: 8, timing: 7, downsideProtection: 8,
  });
  assert.equal(r.score, 7.85);
  assert.equal(r.breakdown[0].why, 'uses the GxP tour');
});

test('shows its arithmetic', () => {
  const r = score({ edgeFit: 9, asymmetry: 7, tractability: 8, timing: 7, downsideProtection: 8 });
  assert.match(r.arithmetic, /0\.25×9/);
  assert.match(r.arithmetic, /= 7\.85 \/ 10\.00$/);
});

test('breakdown covers every factor exactly once, with contributions summing to the score', () => {
  const r = score(perfect);
  assert.deepEqual(r.breakdown.map((b) => b.factor), [...FACTORS]);
  const sum = r.breakdown.reduce((a, b) => a + b.contribution, 0);
  assert.ok(Math.abs(sum - r.score) < 1e-9);
});

test('rejects a missing factor rather than silently treating it as 0', () => {
  const { timing, ...partial } = perfect;
  assert.throws(() => score(partial), /missing factor: timing/);
});

test('rejects out-of-range, non-numeric and NaN factor values', () => {
  assert.throws(() => score({ ...perfect, timing: 11 }), /within 0\.\.10/);
  assert.throws(() => score({ ...perfect, timing: -1 }), /within 0\.\.10/);
  assert.throws(() => score({ ...perfect, timing: 'high' }), /finite number/);
  assert.throws(() => score({ ...perfect, timing: NaN }), /finite number/);
  assert.throws(() => score({ ...perfect, timing: null }), /finite number/);
});

test('custom weights change the answer in the expected direction', () => {
  const f = { edgeFit: 10, asymmetry: 0, tractability: 0, timing: 0, downsideProtection: 0 };
  const base = score(f).score;                                   // 2.5
  const edgeHeavy = score(f, {
    weights: { edgeFit: 0.6, asymmetry: 0.1, tractability: 0.1, timing: 0.1, downsideProtection: 0.1 },
  }).score;                                                       // 6.0
  assert.equal(base, 2.5);
  assert.equal(edgeHeavy, 6);
});

test('rank sorts descending and breaks ties on edgeFit then id', () => {
  const mk = (id, factors) => ({ id, scoring: score(factors) });
  const a = mk('a', { edgeFit: 2, asymmetry: 10, tractability: 5, timing: 5, downsideProtection: 5 });
  const b = mk('b', { edgeFit: 10, asymmetry: 2, tractability: 5, timing: 5, downsideProtection: 5 });
  const c = mk('c', { edgeFit: 10, asymmetry: 10, tractability: 10, timing: 10, downsideProtection: 10 });
  assert.equal(a.scoring.score, b.scoring.score); // identical totals, different shape
  const out = rank([a, b, c]).map((x) => x.id);
  assert.deepEqual(out, ['c', 'b', 'a']); // c first; b beats a on edgeFit tie-break
});
