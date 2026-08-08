import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCandidate, filterCandidates, isVague, DISCONFIRMED_DOMAINS } from '../lib/constraint-filter.mjs';
import { loadConfig } from '../lib/config.mjs';

const { constraints } = loadConfig();

/** A candidate that passes everything — mutate it to test one rule at a time. */
const ok = () => ({
  id: 'gxp-validation',
  title: 'Fixed-scope AI validation for GxP software vendors',
  thesis: 'Small clinical software vendors need a validation package they cannot afford from the Big 4.',
  category: 'productized-service',
  tags: ['compliance', 'pharma'],
  capitalRequiredUsd: 0,
  hoursPerWeek: 20,
  monthsToFirstRevenue: 4,
  requiresQuittingJob: false,
  harmsOthers: false,
  ethicalFlags: [],
  distribution: {
    buyer: 'VP Quality at a sub-200-person clinical software vendor',
    channel: 'Direct outbound to sponsors named in ClinicalTrials.gov records',
  },
});

/** The distinct rules that fired. A rule can fire twice (vague buyer AND vague channel). */
const rules = (c) => [...new Set(checkCandidate(c, constraints).reasons.map((r) => r.rule))];

test('a compliant candidate passes', () => {
  const r = checkCandidate(ok(), constraints);
  assert.equal(r.rejected, false, JSON.stringify(r.reasons));
});

// --- constraint 1: capital -------------------------------------------------
test('rejects anything above the $500 capital ceiling', () => {
  assert.deepEqual(rules({ ...ok(), capitalRequiredUsd: 501 }), ['capital']);
  assert.deepEqual(rules({ ...ok(), capitalRequiredUsd: 250_000 }), ['capital']);
});

test('accepts exactly the ceiling', () => {
  assert.equal(checkCandidate({ ...ok(), capitalRequiredUsd: 500 }, constraints).rejected, false);
});

test('unstated capital is a reject, not an assumed zero', () => {
  const c = ok();
  delete c.capitalRequiredUsd;
  assert.deepEqual(rules(c), ['capital']);
});

// --- constraint 2: time ----------------------------------------------------
test('rejects above 30 hrs/week and anything requiring quitting the job', () => {
  assert.deepEqual(rules({ ...ok(), hoursPerWeek: 45 }), ['time']);
  assert.deepEqual(rules({ ...ok(), requiresQuittingJob: true }), ['time']);
});

test('does not reject low hours — 15-30 is a ceiling, not a quota', () => {
  assert.equal(checkCandidate({ ...ok(), hoursPerWeek: 5 }, constraints).rejected, false);
});

// --- constraint 3: horizon (soft) -----------------------------------------
test('a 12-month horizon warns but does not reject — "tolerated but not preferred"', () => {
  const r = checkCandidate({ ...ok(), monthsToFirstRevenue: 12 }, constraints);
  assert.equal(r.rejected, false);
  assert.equal(r.warnings.some((w) => w.rule === 'horizon'), true);
});

test('beyond the hard ceiling it is a reject', () => {
  assert.deepEqual(rules({ ...ok(), monthsToFirstRevenue: 36 }), ['horizon']);
});

// --- constraint 4: ethics --------------------------------------------------
test('rejects declared harm and denylisted ethical flags', () => {
  assert.deepEqual(rules({ ...ok(), harmsOthers: true }), ['ethics']);
  assert.deepEqual(rules({ ...ok(), ethicalFlags: ['predatory'] }), ['ethics']);
  assert.deepEqual(rules({ ...ok(), ethicalFlags: ['Regulatory-Evasion'] }), ['ethics'], 'flag matching is case-insensitive');
});

test('a missing ethical assessment is a reject, not a pass', () => {
  const c = ok();
  delete c.harmsOthers;
  delete c.ethicalFlags;
  assert.deepEqual(rules(c), ['ethics']);
});

test('headcount displacement is SURFACED as an open question, never auto-rejected', () => {
  const r = checkCandidate({ ...ok(), displacesHeadcount: true }, constraints);
  assert.equal(r.rejected, false);
  const w = r.warnings.find((x) => x.rule === 'open-question');
  assert.ok(w, 'expected an open-question warning');
  assert.match(w.detail, /has NOT decided/);
});

// --- constraint 5: distribution -------------------------------------------
test('"build it and they will come" is an automatic reject', () => {
  assert.deepEqual(rules({ ...ok(), distribution: { buyer: 'Small businesses', channel: 'Build it and they will come' } }), ['distribution']);
});

test('rejects missing, vague, and vague-compound distribution answers', () => {
  assert.deepEqual(rules({ ...ok(), distribution: {} }), ['distribution']);
  assert.deepEqual(rules({ ...ok(), distribution: { buyer: 'everyone', channel: 'word of mouth' } }), ['distribution']);
  assert.deepEqual(rules({ ...ok(), distribution: { buyer: 'companies', channel: 'social media marketing' } }), ['distribution']);
  assert.deepEqual(rules({ ...ok(), distribution: { buyer: 'users', channel: 'organic word of mouth' } }), ['distribution']);
});

test('a named buyer with a named channel passes', () => {
  assert.equal(
    checkCandidate({ ...ok(), distribution: { buyer: 'Chief Compliance Officer at a Massachusetts-chartered credit union', channel: 'NCUA examiner-referral network and state league conferences' } }, constraints).rejected,
    false,
  );
});

test('isVague catches the phrase list and lets real answers through', () => {
  assert.equal(isVague('word of mouth'), true);
  assert.equal(isVague('SEO'), true);
  assert.equal(isVague('TBD'), true);
  assert.equal(isVague('Direct outbound to named clinical software vendors'), false);
});

// --- constraint 6: disconfirmed domains ------------------------------------
test('gaming markets are rejected — the operator disconfirmed that edge', () => {
  assert.deepEqual(rules({ ...ok(), title: 'Steam community market arbitrage', tags: ['gaming market'] }), ['disconfirmed-domain']);
  assert.deepEqual(rules({ ...ok(), thesis: 'Flip CS skins via skin trading price gaps.' }), ['disconfirmed-domain']);
});

test('capital-deployment plays are rejected regardless of stated capital', () => {
  for (const thesis of [
    'Wholesale real estate investing in Hartford County.',
    'Crypto arbitrage across thin exchanges.',
    'Options trading on earnings volatility.',
    'Equities investing in small caps.',
  ]) {
    assert.deepEqual(rules({ ...ok(), thesis }), ['disconfirmed-domain'], thesis);
  }
});

test('does NOT false-positive on legitimate compliance work in those sectors', () => {
  for (const thesis of [
    'Automate BSA/AML evidence collection for crypto exchanges facing state money-transmitter exams.',
    'Automate lease-abstraction compliance for real estate investment trusts.',
    'Automate SOX evidence gathering for an equities brokerage.',
  ]) {
    assert.equal(checkCandidate({ ...ok(), thesis }, constraints).rejected, false, thesis);
  }
});

test('a "compliance" tag cannot smuggle an investing thesis past the filter', () => {
  // The exemption must appear in the SAME field as the match, not anywhere on
  // the candidate — otherwise any candidate can buy immunity with a tag.
  const c = { ...ok(), thesis: 'Wholesale real estate investing in Hartford County.', tags: ['compliance', 'automation'] };
  assert.deepEqual(rules(c), ['disconfirmed-domain']);
});

test('serving a disconfirmed sector passes, but is flagged for framing review', () => {
  const c = { ...ok(), thesis: 'Compliance automation for crypto trading desks facing state money-transmitter exams.' };
  const r = checkCandidate(c, constraints);
  assert.equal(r.rejected, false);
  assert.match(r.warnings.find((w) => w.rule === 'disconfirmed-domain').detail, /SERVING that sector/);
});

test('every disconfirmed domain carries a note explaining why', () => {
  for (const d of DISCONFIRMED_DOMAINS) {
    assert.ok(d.note && d.note.length > 20, `${d.id} needs a note`);
    assert.ok(d.patterns.length > 0);
  }
});

// --- aggregate -------------------------------------------------------------
test('filterCandidates partitions and explains every rejection', () => {
  const bad = { ...ok(), id: 'bad', capitalRequiredUsd: 100_000, hoursPerWeek: 60 };
  const r = filterCandidates([ok(), bad], constraints);
  assert.equal(r.passed.length, 1);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].candidate.id, 'bad');
  assert.deepEqual(r.rejected[0].reasons.map((x) => x.rule).sort(), ['capital', 'time']);
  for (const reason of r.rejected[0].reasons) assert.ok(reason.detail.length > 10, 'every reason must be legible');
});

test('filterCandidates rejects a non-array input rather than coercing', () => {
  assert.throws(() => filterCandidates(null, constraints), /must be an array/);
});
