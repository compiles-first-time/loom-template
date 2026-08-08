/**
 * scoring.mjs — the weighted formula. DETERMINISTIC.
 *
 *   Score = 0.25·EdgeFit + 0.25·Asymmetry + 0.20·Tractability
 *         + 0.15·Timing  + 0.15·DownsideProtection
 *
 * Agents supply the 0-10 factor ratings (judgment about the world).
 * This module does ALL the arithmetic. An agent must never compute a score.
 */

export const FACTORS = /** @type {const} */ ([
  'edgeFit',
  'asymmetry',
  'tractability',
  'timing',
  'downsideProtection',
]);

export const FACTOR_LABELS = {
  edgeFit: 'Edge fit',
  asymmetry: 'Asymmetry',
  tractability: 'Tractability',
  timing: 'Timing',
  downsideProtection: 'Downside protection',
};

export const DEFAULT_WEIGHTS = Object.freeze({
  edgeFit: 0.25,
  asymmetry: 0.25,
  tractability: 0.2,
  timing: 0.15,
  downsideProtection: 0.15,
});

const WEIGHT_SUM_TOLERANCE = 1e-9;

export function validateWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    throw new TypeError('weights must be an object');
  }
  const missing = FACTORS.filter((f) => !(f in weights));
  if (missing.length) throw new Error(`weights missing factor(s): ${missing.join(', ')}`);

  const extra = Object.keys(weights).filter((k) => !FACTORS.includes(k));
  if (extra.length) throw new Error(`weights has unknown factor(s): ${extra.join(', ')}`);

  for (const f of FACTORS) {
    const w = weights[f];
    if (typeof w !== 'number' || !Number.isFinite(w)) throw new TypeError(`weight "${f}" must be a finite number`);
    if (w < 0) throw new RangeError(`weight "${f}" must be >= 0`);
  }
  const sum = FACTORS.reduce((acc, f) => acc + weights[f], 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE + 1e-9) {
    throw new RangeError(`weights must sum to 1, got ${sum}`);
  }
  return true;
}

/**
 * @param {Record<string, number|{value:number,why?:string}>} factors
 * @returns {{score:number, breakdown:Array, arithmetic:string, weights:object, max:number}}
 */
export function score(factors, { weights = DEFAULT_WEIGHTS, min = 0, max = 10 } = {}) {
  validateWeights(weights);
  if (!factors || typeof factors !== 'object') throw new TypeError('factors must be an object');
  if (!(max > min)) throw new RangeError('max must be greater than min');

  const breakdown = FACTORS.map((f) => {
    if (!(f in factors)) throw new Error(`missing factor: ${f}`);
    const entry = factors[f];
    const value = typeof entry === 'object' && entry !== null ? entry.value : entry;
    const why = typeof entry === 'object' && entry !== null ? entry.why ?? '' : '';

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`factor "${f}" must be a finite number, got ${JSON.stringify(value)}`);
    }
    if (value < min || value > max) {
      throw new RangeError(`factor "${f}" must be within ${min}..${max}, got ${value}`);
    }
    return {
      factor: f,
      label: FACTOR_LABELS[f],
      raw: value,
      weight: weights[f],
      contribution: round(value * weights[f], 4),
      why,
    };
  });

  const total = round(
    breakdown.reduce((acc, b) => acc + b.raw * b.weight, 0),
    4,
  );

  const arithmetic =
    breakdown.map((b) => `${b.weight}×${b.raw}`).join(' + ') +
    ` = ${breakdown.map((b) => b.contribution.toFixed(2)).join(' + ')}` +
    ` = ${total.toFixed(2)} / ${max.toFixed(2)}`;

  return { score: total, breakdown, arithmetic, weights: { ...weights }, max };
}

/** Sort descending by score; deterministic tie-break on edgeFit then id. */
export function rank(scored) {
  return [...scored].sort((a, b) => {
    const d = (b.scoring?.score ?? 0) - (a.scoring?.score ?? 0);
    if (Math.abs(d) > 1e-9) return d;
    const e =
      (b.scoring?.breakdown?.find((x) => x.factor === 'edgeFit')?.raw ?? 0) -
      (a.scoring?.breakdown?.find((x) => x.factor === 'edgeFit')?.raw ?? 0);
    if (Math.abs(e) > 1e-9) return e;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

export function round(n, dp = 2) {
  const m = 10 ** dp;
  return Math.round((n + Number.EPSILON) * m) / m;
}
