/**
 * mock-transport.mjs — deterministic fixtures for `--dry-run` and tests.
 *
 * Exercises the whole pipeline with zero network and zero spend: one candidate
 * that passes, one that trips the capital constraint, one that trips a
 * disconfirmed domain, and evidence containing an SEO content farm that the
 * source-tier gate must strip.
 */

export const FIXTURE_SCAN = {
  persona: 'ai-automation-analyst',
  standingAnswers: {
    whatChanged: '[fixture] Agentic deployments outran governance budgets.',
    demandOutpacingSupply: '[fixture] Validation of AI tooling under existing regulated-industry SOPs.',
    singleMoveIdWouldMake: '[fixture] Sell a fixed-scope AI system validation package.',
  },
  candidates: [
    {
      id: 'fixture-validation-package',
      title: '[FIXTURE] Fixed-scope AI system validation for GxP vendors',
      thesis: 'Small pharma software vendors cannot sell into GxP environments without a validation package, and cannot afford a Big-4 one.',
      category: 'productized-service',
      tags: ['compliance', 'pharma', 'validation'],
      catalyst: { whyNow: '[fixture] Buyers now require AI-tool validation evidence in vendor questionnaires.', whatClosesTheWindow: '[fixture] Vendors productize their own validation kits.' },
      whyNick: 'Merck GxP / 21 CFR Part 11 tour plus automation build velocity.',
      capitalRequiredUsd: 0,
      hoursPerWeek: 20,
      monthsToFirstRevenue: 4,
      requiresQuittingJob: false,
      displacesHeadcount: false,
      harmsOthers: false,
      ethicalFlags: [],
      ethicalNote: 'Adds compliance capacity; displaces no one.',
      distribution: {
        buyer: 'VP Quality or Head of Regulatory at a sub-200-person clinical software vendor',
        channel: 'Direct outbound to vendors listed as sponsors in ClinicalTrials.gov records',
        firstFiveTargets: ['[fixture] vendor A', '[fixture] vendor B'],
      },
      factors: {
        edgeFit: { value: 9, why: 'Directly uses the GxP/Part 11 tour.' },
        asymmetry: { value: 7, why: 'Zero capital; a single engagement covers months of effort.' },
        tractability: { value: 8, why: 'One person can scope and deliver this part-time.' },
        timing: { value: 7, why: 'Window is open but competitors are productizing.' },
        downsideProtection: { value: 8, why: 'Artifacts and relationships survive failure.' },
      },
      sources: [{ url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents', title: 'FDA guidance documents', publisher: 'FDA', date: '2026-01-15' }],
    },
    {
      id: 'fixture-capital-reject',
      title: '[FIXTURE] Buy a compliance SaaS and turn it around',
      thesis: 'Acquire a distressed compliance SaaS and fix its churn.',
      category: 'product',
      tags: ['acquisition'],
      catalyst: { whyNow: 'x', whatClosesTheWindow: 'y' },
      whyNick: 'Automation background.',
      capitalRequiredUsd: 250000,
      hoursPerWeek: 25,
      monthsToFirstRevenue: 6,
      requiresQuittingJob: false,
      displacesHeadcount: false,
      harmsOthers: false,
      ethicalFlags: [],
      distribution: { buyer: 'Existing SaaS customers', channel: 'Existing renewal motion', firstFiveTargets: [] },
      factors: {
        edgeFit: { value: 5, why: '-' }, asymmetry: { value: 6, why: '-' }, tractability: { value: 2, why: '-' },
        timing: { value: 5, why: '-' }, downsideProtection: { value: 3, why: '-' },
      },
      sources: [],
    },
    {
      id: 'fixture-disconfirmed',
      title: '[FIXTURE] Skin trading arbitrage bot',
      thesis: 'Arbitrage price gaps in the Steam community market.',
      category: 'product',
      tags: ['gaming market'],
      catalyst: { whyNow: 'x', whatClosesTheWindow: 'y' },
      whyNick: 'Build velocity.',
      capitalRequiredUsd: 400,
      hoursPerWeek: 15,
      monthsToFirstRevenue: 2,
      requiresQuittingJob: false,
      displacesHeadcount: false,
      harmsOthers: false,
      ethicalFlags: [],
      distribution: { buyer: 'n/a', channel: 'organic', firstFiveTargets: [] },
      factors: {
        edgeFit: { value: 1, why: '-' }, asymmetry: { value: 5, why: '-' }, tractability: { value: 6, why: '-' },
        timing: { value: 4, why: '-' }, downsideProtection: { value: 5, why: '-' },
      },
      sources: [],
    },
  ],
};

export const FIXTURE_DEEPDIVE = {
  id: 'fixture-validation-package',
  verdictSummary: '[fixture] Survives, with the buyer-intent question unresolved.',
  claims: [
    {
      claim: '[fixture] Federal guidance on computerised systems in regulated settings is publicly maintained.',
      kind: 'fact',
      confidence: 5,
      whatWouldRaiseConfidence: '',
      verificationPath: '',
      sources: [
        { url: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents', title: 'FDA guidance', publisher: 'FDA', date: '2026-01-15' },
        { url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11', title: '21 CFR Part 11', publisher: 'eCFR', date: '2026-02-01' },
      ],
    },
    {
      claim: '[fixture] Independent AI consultants bill $150-350/hr.',
      kind: 'speculation',
      confidence: 2,
      whatWouldRaiseConfidence: 'A signed SOW or a public GSA schedule rate.',
      verificationPath: '',
      sources: [
        { url: 'https://consultingsuccess.com/blog/how-much-do-consultants-charge-in-2026', title: 'How much do consultants charge in 2026', publisher: 'Consulting Success', date: '2026-03-01' },
        { url: 'https://www.freelancermap.com/blog/average-hourly-rates-2026', title: 'Average hourly rates 2026', publisher: 'freelancermap', date: '2026-02-01' },
      ],
    },
  ],
  baseRate: {
    statement: 'unknown',
    survivorshipCheck: '[fixture] Solo consultancies that fail rarely publish; visible examples are survivors.',
    confidence: 2,
    sources: [],
  },
  capitalAndEffort: { capitalBandUsd: '$0-500', hoursPerWeek: '15-30', note: '[fixture]' },
  risks: [
    { risk: '[fixture] Buyers hire an FTE instead of a consultant.', likelihood: 'high', mitigation: 'Test with 10 direct conversations before building anything.' },
    { risk: '[fixture] Big 4 productizes first.', likelihood: 'medium', mitigation: 'Compete on price and turnaround, not brand.' },
  ],
  killCriteria: ['[fixture] 10 target buyers contacted, fewer than 2 take a call within 30 days.'],
  blindSpots: ['[fixture] No visibility into whether budget sits with Quality or IT.'],
  nextActions: ['[fixture] Build the target list.', '[fixture] Write the one-page offer.', '[fixture] Send 10 outbound notes.'],
  unknowns: ['[fixture] Actual contract values for this work.'],
};

export async function mockInvoke(prompt, { label } = {}) {
  const text = label?.startsWith('deepdive') ? JSON.stringify(FIXTURE_DEEPDIVE) : JSON.stringify(FIXTURE_SCAN);
  return { text, costUsd: 0 };
}
