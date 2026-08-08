import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySource, classifyAll, validateEvidence, detectSeoFarm, registrableDomain, normaliseConfidence, TIER, REASONS,
} from '../lib/source-tiers.mjs';

const tier = (url, extra = {}) => classifySource({ url, ...extra }).tier;

// --- Tier 1 ---------------------------------------------------------------
test('primary data and filings are Tier 1', () => {
  assert.equal(tier('https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany'), 1);
  assert.equal(tier('https://www.bls.gov/oes/current/oes151299.htm'), 1);
  assert.equal(tier('https://fred.stlouisfed.org/series/GDP'), 1);
  assert.equal(tier('https://www.ecfr.gov/current/title-21/part-11'), 1);
  assert.equal(tier('https://www.federalregister.gov/documents/2026/01/02/x'), 1);
  assert.equal(tier('https://www.courtlistener.com/docket/123/'), 1);
});

test('any .gov domain is Tier 1 by construction', () => {
  assert.equal(tier('https://www.mass.gov/orgs/division-of-insurance'), 1);
});

// --- Tier 2 ---------------------------------------------------------------
test('institutional research is Tier 2', () => {
  assert.equal(tier('https://www2.deloitte.com/us/en/insights/state-of-ai-2026.html'), 2);
  assert.equal(tier('https://www.gartner.com/en/newsroom/press-releases/x'), 2);
  assert.equal(tier('https://www.pewresearch.org/short-reads/2026/x/'), 2);
  assert.equal(tier('https://www.rand.org/pubs/research_reports/RRA000.html'), 2);
});

test('universities are Tier 2', () => {
  assert.equal(tier('https://hai.stanford.edu/ai-index/2026-report'), 2);
});

test('corporate investor-relations pages are Tier 2 disclosure', () => {
  const r = classifySource({ url: 'https://investors.examplecorp.com/investors/quarterly-results' });
  assert.equal(r.tier, 2);
  assert.equal(r.reason, 'corporate-disclosure');
});

// --- Tier 3 ---------------------------------------------------------------
test('newspapers of record and trade press are Tier 3, flagged recent-events-only', () => {
  const r = classifySource({ url: 'https://www.reuters.com/technology/some-story-2026-01-02/', title: 'Regulator opens inquiry into AI vendor' });
  assert.equal(r.tier, 3);
  assert.match(r.detail, /RECENT EVENTS only/);
  assert.equal(tier('https://www.statnews.com/2026/01/02/x/', { title: 'FDA clears device' }), 3);
});

// --- REJECTED: named ------------------------------------------------------
test('forums, social and open-publishing platforms are REJECTED', () => {
  for (const url of [
    'https://www.reddit.com/r/consulting/comments/abc/',
    'https://medium.com/@someone/how-i-made-10k',
    'https://news.ycombinator.com/item?id=1',
    'https://x.com/someone/status/1',
    'https://www.linkedin.com/posts/someone_activity-1',
    'https://someone.substack.com/p/post',
    'https://www.youtube.com/watch?v=abc',
  ]) {
    assert.equal(tier(url), TIER.REJECTED, url);
  }
});

test('rate and salary aggregators are REJECTED — this is the v1 trap', () => {
  for (const url of [
    'https://www.glassdoor.com/Salaries/ai-consultant-salary-SRCH.htm',
    'https://www.payscale.com/research/US/Job=Consultant/Hourly_Rate',
    'https://www.upwork.com/hire/ai-consultants/',
    'https://clutch.co/consulting',
    'https://www.ziprecruiter.com/Salaries/AI-Consultant-Salary',
  ]) {
    assert.equal(tier(url), TIER.REJECTED, url);
  }
});

test('press-release wires and market-research PDF sellers are REJECTED', () => {
  assert.equal(tier('https://www.prnewswire.com/news-releases/x.html'), TIER.REJECTED);
  assert.equal(tier('https://www.grandviewresearch.com/industry-analysis/ai-market'), TIER.REJECTED);
  assert.equal(tier('https://www.mordorintelligence.com/industry-reports/x'), TIER.REJECTED);
});

test('Wikipedia is a pointer, never a source', () => {
  const r = classifySource({ url: 'https://en.wikipedia.org/wiki/Regulatory_compliance' });
  assert.equal(r.tier, TIER.REJECTED);
  assert.equal(r.reason, REASONS.POINTER_ONLY);
  assert.equal(r.pointerOnly, true);
  assert.match(r.detail, /follow its citations/);
});

// --- REJECTED: SEO content farms ------------------------------------------
test('SEO content farms are caught by title shape on an unknown domain', () => {
  for (const title of [
    'How Much Do AI Consultants Charge in 2026?',
    'Average Consulting Rates by Industry',
    'The Ultimate Guide to AI Compliance Consulting',
    'Top 10 Compliance Automation Tools',
    '7 Proven Ways to Land Your First Consulting Client',
    'Everything You Need to Know About 21 CFR Part 11',
    '25 AI Statistics You Should Know',
  ]) {
    const r = classifySource({ url: 'https://some-agency-blog.com/post', title });
    assert.equal(r.tier, TIER.REJECTED, title);
    assert.equal(r.reason, REASONS.SEO_FARM, title);
  }
});

test('SEO content farms are caught by URL shape even with no title', () => {
  for (const url of [
    'https://randomconsultancy.com/blog/ai-consulting-rates',
    'https://x-agency.io/how-much-does-ai-consulting-cost',
    'https://y.co/ultimate-guide-to-compliance-automation',
    'https://z.net/top-15-ai-governance-tools',
  ]) {
    const r = classifySource({ url });
    assert.equal(r.tier, TIER.REJECTED, url);
    assert.equal(r.reason, REASONS.SEO_FARM, url);
  }
});

test('an SEO-shaped page on a Tier-3 outlet is still rejected', () => {
  const r = classifySource({ url: 'https://www.cio.com/article/123/top-10-ai-tools.html', title: 'Top 10 AI tools for 2026' });
  assert.equal(r.tier, TIER.REJECTED);
  assert.equal(r.reason, REASONS.SEO_FARM);
});

test('a Tier-1 page is NOT rejected even if its title looks listicle-ish', () => {
  assert.equal(tier('https://www.gao.gov/products/gao-26-1', { title: 'Top 10 Management Challenges' }), 1);
});

test('detectSeoFarm returns null for a plain informative title', () => {
  assert.equal(detectSeoFarm({ title: 'Notice of proposed rulemaking on electronic records', url: 'https://x.com/a', path: '/a' }), null);
});

// --- unknown domains ------------------------------------------------------
test('an unknown domain is REJECTED as unverifiable, not silently trusted', () => {
  const r = classifySource({ url: 'https://complianceinsights.io/article/42', title: 'Notes on the new rule' });
  assert.equal(r.tier, TIER.REJECTED);
  assert.equal(r.reason, REASONS.UNKNOWN_DOMAIN);
  assert.match(r.detail, /find the primary source/);
});

test('a missing or unparseable URL is REJECTED', () => {
  assert.equal(classifySource({ title: 'no url' }).reason, REASONS.NO_URL);
  assert.equal(classifySource({}).tier, TIER.REJECTED);
  assert.equal(classifySource({ url: 'ht!tp://%%%' }).tier, TIER.REJECTED);
});

// --- helpers --------------------------------------------------------------
test('registrableDomain collapses subdomains and handles multi-part TLDs', () => {
  assert.equal(registrableDomain('www.sec.gov'), 'sec.gov');
  assert.equal(registrableDomain('a.b.example.com'), 'example.com');
  assert.equal(registrableDomain('news.bbc.co.uk'), 'bbc.co.uk');
});

test('classifyAll maps over a list', () => {
  assert.equal(classifyAll([{ url: 'https://sec.gov/a' }, { url: 'https://reddit.com/b' }]).length, 2);
});

// --- evidence gate --------------------------------------------------------
const src = (url, date = '2026-01-01') => ({ url, title: 'Report', publisher: 'p', date });

test('a claim with two independent Tier-1/2 sources is usable', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 4, sources: [src('https://www.bls.gov/a'), src('https://www2.deloitte.com/b')] }]);
  assert.equal(r.usable.length, 1);
  assert.equal(r.claims[0].bestTier, 1);
  assert.equal(r.claims[0].singleSource, false);
});

test('two URLs on the SAME domain do not count as independent', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 4, sources: [src('https://www.bls.gov/a'), src('https://www.bls.gov/b')] }]);
  assert.equal(r.claims[0].singleSource, true);
  assert.equal(r.claims[0].usable, false);
  assert.match(r.claims[0].problems.join(' '), /single-source/);
});

test('single-source is acceptable WITH an explicit verification path', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 4, verificationPath: 'FOIA the contract', sources: [src('https://www.bls.gov/a')] }]);
  assert.equal(r.claims[0].singleSource, true);
  assert.equal(r.claims[0].usable, true);
});

test('an undated source fails the gate — every number gets a source AND a date', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 4, verificationPath: 'y', sources: [{ url: 'https://www.bls.gov/a', title: 't' }] }]);
  assert.equal(r.claims[0].usable, false);
  assert.match(r.claims[0].problems.join(' '), /undated/);
});

test('a claim sourced only to content farms is stripped to zero usable sources', () => {
  const r = validateEvidence([{
    claim: 'Independent AI consultants bill $150-350/hr',
    confidence: 2,
    whatWouldRaiseConfidence: 'a signed SOW',
    sources: [
      { url: 'https://consultingsuccess.com/blog/how-much-do-consultants-charge-in-2026', title: 'How much do consultants charge in 2026', date: '2026-03-01' },
      { url: 'https://www.freelancermap.com/blog/average-hourly-rates-2026', title: 'Average hourly rates 2026', date: '2026-02-01' },
    ],
  }]);
  assert.equal(r.claims[0].accepted.length, 0);
  assert.equal(r.claims[0].dropped.length, 2);
  assert.equal(r.usable.length, 0);
  assert.equal(r.droppedSourceCount, 2);
  assert.match(r.claims[0].problems.join(' '), /all 2 source\(s\) rejected/);
});

test('low confidence must be paired with what would raise it', () => {
  const s = [src('https://www.bls.gov/a'), src('https://www2.deloitte.com/b')];
  assert.equal(validateEvidence([{ claim: 'x', confidence: 2, sources: s }]).claims[0].usable, false);
  assert.equal(validateEvidence([{ claim: 'x', confidence: 2, whatWouldRaiseConfidence: 'a filing', sources: s }]).claims[0].usable, true);
});

// --- confidence scale ------------------------------------------------------
test('normaliseConfidence detects the 1-5 scale and the 0-1 probability scale', () => {
  assert.deepEqual(normaliseConfidence(4), { value: 4, scale: '1-5', raw: 4 });
  assert.deepEqual(normaliseConfidence(1), { value: 1, scale: '1-5', raw: 1 }, 'integer 1 reads as lowest-of-5, the conservative choice');
  assert.equal(normaliseConfidence(0.9).scale, 'probability');
  assert.equal(normaliseConfidence(0.9).value, 4.5);
  assert.equal(normaliseConfidence(0.35).value, 1.75);
  assert.equal(normaliseConfidence(7).scale, 'unknown');
  assert.equal(normaliseConfidence('high').value, null);
  assert.equal(normaliseConfidence(undefined).value, null);
});

test('a probability-scale confidence does not spuriously fail a Tier-1 claim', () => {
  // Regression: agents return 0.85 when asked for 1-5. Read naively that is
  // "below 3" and a well-sourced Tier-1 claim gets marked unusable.
  const r = validateEvidence([{
    claim: 'x', confidence: 0.85, verificationPath: 'cite the notice directly',
    sources: [src('https://grants.nih.gov/notice')],
  }]);
  assert.equal(r.claims[0].confidenceNormalised.scale, 'probability');
  assert.equal(r.claims[0].confidenceNormalised.value, 4.25);
  assert.equal(r.claims[0].usable, true);
});

test('a genuinely low probability still fails the gate without a path to raise it', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 0.3, verificationPath: 'p', sources: [src('https://grants.nih.gov/notice')] }]);
  assert.equal(r.claims[0].usable, false);
  assert.match(r.claims[0].problems.join(' '), /1\.5\/5 \(from p=0\.3\)/);
});

test('a confidence on no recognised scale is flagged rather than ignored', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 42, verificationPath: 'p', sources: [src('https://grants.nih.gov/n')] }]);
  assert.match(r.claims[0].problems.join(' '), /no recognised scale/);
});

test('a claim with no sources at all is unusable', () => {
  const r = validateEvidence([{ claim: 'x', confidence: 5, sources: [] }]);
  assert.equal(r.claims[0].usable, false);
  assert.match(r.claims[0].problems.join(' '), /no sources supplied/);
});
