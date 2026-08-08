/**
 * source-tiers.mjs — research standards as DATA, not judgment. DETERMINISTIC.
 *
 * A prior session correctly noticed that every "consulting rate" source it
 * found was an SEO content farm — but it caught that by hand. This module
 * catches it automatically, every run, the same way.
 *
 *   Tier 1  Primary data & filings (SEC EDGAR, FRED, BLS, BEA, Census, USPTO,
 *           CFTC, court records, official regulatory text)
 *   Tier 2  Established institutional research (Gartner, Deloitte, Pew, RAND,
 *           earnings calls, peer-reviewed / NBER)
 *   Tier 3  Newspapers of record & quality trade press — RECENT EVENTS ONLY
 *   REJECTED  Reddit, forums, Medium, social posts, SEO content farms.
 *             Wikipedia is a pointer to primary sources, never a source.
 */

export const TIER = { ONE: 1, TWO: 2, THREE: 3, REJECTED: 'REJECTED' };

// --- Tier 1: primary data & filings ---------------------------------------
export const TIER1_DOMAINS = [
  'sec.gov', 'efts.sec.gov', 'edgar.sec.gov',
  'federalreserve.gov', 'stlouisfed.org', 'newyorkfed.org',
  'bls.gov', 'bea.gov', 'census.gov', 'uspto.gov', 'cftc.gov',
  'federalregister.gov', 'regulations.gov', 'ecfr.gov', 'govinfo.gov',
  'congress.gov', 'gao.gov', 'cbo.gov', 'usaspending.gov', 'sam.gov',
  'fda.gov', 'cms.gov', 'hhs.gov', 'nih.gov', 'ftc.gov', 'dol.gov',
  'treasury.gov', 'irs.gov', 'justice.gov', 'dea.gov', 'ed.gov',
  'courtlistener.com', 'pacer.gov', 'supremecourt.gov',
  'eur-lex.europa.eu', 'europa.eu', 'ec.europa.eu',
  'nist.gov', 'ncua.gov', 'occ.gov', 'fdic.gov', 'finra.org',
  'naic.org', 'oecd.org', 'imf.org', 'worldbank.org', 'un.org',
];
/** Any US federal/state domain is primary by construction. */
export const TIER1_SUFFIXES = ['.gov', '.mil', '.gov.uk', '.europa.eu'];

// --- Tier 2: established institutional research ----------------------------
export const TIER2_DOMAINS = [
  'gartner.com', 'forrester.com', 'idc.com', 'deloitte.com', 'mckinsey.com',
  'pwc.com', 'ey.com', 'kpmg.com', 'accenture.com', 'bain.com', 'bcg.com',
  'pewresearch.org', 'rand.org', 'brookings.edu', 'urban.org',
  'nber.org', 'jamanetwork.com', 'nejm.org', 'thelancet.com', 'nature.com',
  'science.org', 'arxiv.org', 'ssrn.com', 'doi.org', 'pubmed.ncbi.nlm.nih.gov',
  'conference-board.org', 'kff.org', 'commonwealthfund.org',
  'iapp.org', 'isaca.org', 'shrm.org', 'aicpa.org',
];
/** Universities and research institutes. */
export const TIER2_SUFFIXES = ['.edu', '.ac.uk'];
/** Investor-relations paths on a corporate domain = primary-ish disclosure. */
export const TIER2_PATH_PATTERNS = [
  /\/investors?\b/i,
  /\/investor-relations\b/i,
  /\/(annual|quarterly)-report/i,
  /\/earnings\b/i,
  /\/sec-filings\b/i,
  /\/press-release/i,
];

// --- Tier 3: newspapers of record & quality trade press --------------------
export const TIER3_DOMAINS = [
  'wsj.com', 'nytimes.com', 'ft.com', 'washingtonpost.com', 'economist.com',
  'reuters.com', 'bloomberg.com', 'apnews.com', 'npr.org', 'bbc.com',
  'axios.com', 'politico.com', 'theatlantic.com', 'latimes.com', 'bostonglobe.com',
  'statnews.com', 'fiercepharma.com', 'fiercebiotech.com', 'endpts.com',
  'modernhealthcare.com', 'healthcareitnews.com', 'healthcaredive.com',
  'law360.com', 'reuters.com', 'americanbanker.com', 'insurancejournal.com',
  'chronicle.com', 'insidehighered.com', 'sciencemag.org',
  'theinformation.com', 'stratechery.com', 'protocol.com',
  'cio.com', 'computerworld.com', 'zdnet.com', 'techtarget.com',
  'ieee.org', 'acm.org',
];

// --- REJECTED: named ------------------------------------------------------
export const REJECTED_DOMAINS = [
  // social / forums / UGC
  'reddit.com', 'old.reddit.com', 'quora.com', 'stackexchange.com',
  'news.ycombinator.com', 'ycombinator.com', 'x.com', 'twitter.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'threads.net',
  'linkedin.com', 'discord.com', 'slack.com', 'telegram.org',
  // open-publishing platforms
  'medium.com', 'substack.com', 'dev.to', 'hashnode.com', 'hackernoon.com',
  'blogspot.com', 'wordpress.com', 'wixsite.com', 'tumblr.com', 'ghost.io',
  'youtube.com', 'youtu.be', 'vimeo.com', 'podcasts.apple.com',
  // rate/salary aggregators & marketplace content — the exact trap hit in v1
  'upwork.com', 'fiverr.com', 'freelancer.com', 'freelancermap.com',
  'toptal.com', 'clutch.co', 'g2.com', 'capterra.com', 'trustpilot.com',
  'glassdoor.com', 'payscale.com', 'salary.com', 'ziprecruiter.com',
  'indeed.com', 'levels.fyi', 'comparably.com',
  'consultingsuccess.com', 'consulting.com',
  // content mills / SEO estate
  'ehow.com', 'wikihow.com', 'investopedia.com', 'thebalancemoney.com',
  'forbes.com', 'entrepreneur.com', 'inc.com', 'fastcompany.com',
  'businessinsider.com', 'benzinga.com', 'motleyfool.com', 'seekingalpha.com',
  'marketwatch.com', 'yahoo.com', 'msn.com',
  'prnewswire.com', 'businesswire.com', 'globenewswire.com', 'einpresswire.com',
  'marketsandmarkets.com', 'grandviewresearch.com', 'alliedmarketresearch.com',
  'fortunebusinessinsights.com', 'precedenceresearch.com', 'mordorintelligence.com',
  'researchandmarkets.com', 'verifiedmarketresearch.com', 'imarcgroup.com',
];

/** Wikipedia: a pointer to primary sources, NEVER a source. */
export const POINTER_ONLY_DOMAINS = [
  'wikipedia.org', 'wikimedia.org', 'wiktionary.org', 'britannica.com',
];

// --- SEO content-farm heuristics ------------------------------------------
/** Title shapes that mean "written to rank, not to inform". */
export const SEO_TITLE_PATTERNS = [
  { id: 'howmuch-charge', re: /\bhow much (do|does|should|can)\b.*\b(charge|cost|make|earn|pay|bill)/i },
  // Intervening words are allowed: "Average CONSULTING Rates by Industry" must match.
  { id: 'average-rate', re: /\b(average|typical|going|median)\s+(?:[\w-]+\s+){0,3}(rate|salary|price|cost|fee|pricing)s?\b/i },
  { id: 'rates-in-year', re: /\b(rate|salary|price|cost|fee|pricing)s?\b.*\b(in\s+)?20\d\d\b/i },
  { id: 'ultimate-guide', re: /\b(the\s+)?(ultimate|complete|definitive|comprehensive|beginner'?s?)\s+guide\b/i },
  { id: 'listicle', re: /^\s*(top|best|worst)\s+\d+\b/i },
  { id: 'listicle-mid', re: /\b\d+\s+(best|top|proven|essential|must-have|powerful|effective)\b/i },
  { id: 'everything-you-need', re: /\beverything you need to know\b/i },
  { id: 'what-is-x', re: /^\s*what is\s+.{3,40}\?\s*$/i },
  { id: 'how-to-start', re: /\bhow to (start|launch|build|make money)\b.*\b(business|agency|consultancy|side hustle)\b/i },
  { id: 'x-vs-y-2024', re: /\bvs\.?\b.*\b20\d\d\b/i },
  { id: 'stats-roundup', re: /\b\d+\+?\s+(?:[\w-]+\s+){0,2}(stats|statistics|facts|trends)\b/i },
];

/** URL shapes typical of programmatic SEO estates. */
export const SEO_URL_PATTERNS = [
  { id: 'blog-money-kw', re: /\/blog\/.*(rate|pricing|cost|salary|how-much|charge)/i },
  { id: 'money-kw-slug', re: /\/(how-much-.*-(cost|charge|make)|average-.*-(rate|salary|cost))\b/i },
  { id: 'guide-slug', re: /\/(ultimate|complete|definitive)-guide-to-/i },
  { id: 'listicle-slug', re: /\/(top|best)-\d+-/i },
  { id: 'year-slug', re: /\/(20\d\d)-(guide|trends|report|rates|salary)/i },
];

export const REASONS = {
  NO_URL: 'no-url-supplied',
  REJECTED_DOMAIN: 'rejected-domain',
  POINTER_ONLY: 'pointer-only-source',
  SEO_FARM: 'seo-content-farm',
  UNKNOWN_DOMAIN: 'unknown-domain-unverifiable',
};

/**
 * Classify one source.
 * @param {{url?:string, title?:string, publisher?:string, date?:string}} source
 * @returns {{tier:1|2|3|'REJECTED', reason:string, matchedRule:string|null, domain:string|null,
 *            pointerOnly:boolean, source:object}}
 */
export function classifySource(source = {}) {
  const url = typeof source.url === 'string' ? source.url.trim() : '';
  const title = typeof source.title === 'string' ? source.title : '';
  const publisher = typeof source.publisher === 'string' ? source.publisher : '';

  if (!url) {
    return verdict(TIER.REJECTED, REASONS.NO_URL, null, null, source, {
      detail: 'Every number gets a source and a date. No URL, no claim.',
    });
  }

  const parsed = safeParse(url);
  if (!parsed) {
    return verdict(TIER.REJECTED, REASONS.NO_URL, null, null, source, { detail: `unparseable URL: ${url}` });
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const domain = registrableDomain(host);
  const path = parsed.pathname + parsed.search;

  // 1. Pointer-only (Wikipedia) — checked before rejects so the reason is precise.
  if (matchesDomain(host, POINTER_ONLY_DOMAINS)) {
    return verdict(TIER.REJECTED, REASONS.POINTER_ONLY, matchesDomain(host, POINTER_ONLY_DOMAINS), domain, source, {
      pointerOnly: true,
      detail: 'Wikipedia-class source: follow its citations to the primary source and cite that instead.',
    });
  }

  // 2. Named rejects.
  const rejectHit = matchesDomain(host, REJECTED_DOMAINS);
  if (rejectHit) {
    return verdict(TIER.REJECTED, REASONS.REJECTED_DOMAIN, rejectHit, domain, source);
  }

  // 3. Tier 1 — primary.
  const t1 = matchesDomain(host, TIER1_DOMAINS) || matchesSuffix(host, TIER1_SUFFIXES);
  if (t1) return verdict(TIER.ONE, 'primary-data-or-filing', t1, domain, source);

  // 4. Tier 2 — institutional research.
  const t2 = matchesDomain(host, TIER2_DOMAINS) || matchesSuffix(host, TIER2_SUFFIXES);
  if (t2) return verdict(TIER.TWO, 'institutional-research', t2, domain, source);

  const irHit = TIER2_PATH_PATTERNS.find((p) => p.test(path));
  if (irHit) return verdict(TIER.TWO, 'corporate-disclosure', String(irHit), domain, source);

  // 5. SEO content-farm heuristics run BEFORE the tier-3 allowlist is trusted
  //    for money-keyword pages, and are the default verdict for unknown domains.
  const seo = detectSeoFarm({ url, path, title, publisher });

  // 6. Tier 3 — newspapers of record / trade press.
  const t3 = matchesDomain(host, TIER3_DOMAINS);
  if (t3) {
    if (seo) {
      return verdict(TIER.REJECTED, REASONS.SEO_FARM, seo.id, domain, source, {
        detail: `known outlet (${t3}) but the page is SEO-shaped (${seo.id}): "${seo.matched}". Recent-events reporting only.`,
      });
    }
    return verdict(TIER.THREE, 'newspaper-of-record-or-trade-press', t3, domain, source, {
      detail: 'Tier 3 is valid for RECENT EVENTS only, not for base rates or market sizing.',
    });
  }

  // 7. Everything else.
  if (seo) {
    return verdict(TIER.REJECTED, REASONS.SEO_FARM, seo.id, domain, source, {
      detail: `matched SEO pattern "${seo.id}" on: ${seo.matched}`,
    });
  }
  return verdict(TIER.REJECTED, REASONS.UNKNOWN_DOMAIN, null, domain, source, {
    detail: `${domain} is not on any tier list. Unverifiable publisher — find the primary source it is paraphrasing.`,
  });
}

/** @returns {{id:string, matched:string}|null} */
export function detectSeoFarm({ url = '', path = '', title = '', publisher = '' }) {
  for (const p of SEO_TITLE_PATTERNS) {
    if (p.re.test(title)) return { id: p.id, matched: title };
    if (publisher && p.re.test(publisher)) return { id: p.id, matched: publisher };
  }
  for (const p of SEO_URL_PATTERNS) {
    if (p.re.test(path) || p.re.test(url)) return { id: p.id, matched: path || url };
  }
  return null;
}

export function classifyAll(sources = []) {
  return sources.map((s) => classifySource(s));
}

/**
 * Evidence gate. Each claim must have a source AND a date, and be corroborated
 * by >= minIndependentSources distinct registrable domains — or carry an
 * explicit single-source flag with a verification path.
 *
 * @param {Array<{claim:string, sources:Array, date?:string, confidence?:number, verificationPath?:string, kind?:string}>} claims
 */
/**
 * Agents are asked for confidence as an integer 1-5, and reliably return a 0-1
 * probability about half the time. Rather than let a scale mismatch silently
 * mark Tier-1 evidence "unusable", detect the scale and normalise to 1-5.
 *
 * An integer 1 is ambiguous ("1 of 5" vs "100%") — it is read as the 1-5 scale,
 * which is the conservative direction: it flags rather than waves through.
 *
 * @returns {{value:number|null, scale:'1-5'|'probability'|'unknown', raw:any}}
 */
export function normaliseConfidence(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { value: null, scale: 'unknown', raw };
  if (Number.isInteger(raw) && raw >= 1 && raw <= 5) return { value: raw, scale: '1-5', raw };
  if (raw > 0 && raw < 1) return { value: Math.round(raw * 5 * 100) / 100, scale: 'probability', raw };
  if (raw === 0) return { value: 0, scale: 'probability', raw };
  // Out of both ranges (6, 10, -1 …): unusable as a confidence signal.
  return { value: null, scale: 'unknown', raw };
}

export function validateEvidence(claims = [], { minIndependentSources = 2, minConfidenceToAssert = 3 } = {}) {
  const results = claims.map((claim) => {
    const classified = classifyAll(claim.sources ?? []);
    const accepted = classified.filter((c) => c.tier !== TIER.REJECTED);
    const dropped = classified.filter((c) => c.tier === TIER.REJECTED);

    const independentDomains = new Set(accepted.map((c) => c.domain).filter(Boolean));
    const problems = [];

    if (!accepted.length) {
      problems.push(
        dropped.length
          ? `all ${dropped.length} source(s) rejected: ${dropped.map((d) => `${d.domain ?? '?'} (${d.reason})`).join('; ')}`
          : 'no sources supplied',
      );
    }
    const missingDates = accepted.filter((c) => !isDated(c.source));
    if (missingDates.length) {
      problems.push(`${missingDates.length} accepted source(s) undated — "every number gets a source AND a date"`);
    }

    const singleSource = independentDomains.size > 0 && independentDomains.size < minIndependentSources;
    if (singleSource && !claim.verificationPath) {
      problems.push(`single-source (${independentDomains.size}/${minIndependentSources} independent domains) with no verificationPath`);
    }

    const conf = normaliseConfidence(claim.confidence);
    if (conf.value !== null && conf.value < minConfidenceToAssert && !claim.whatWouldRaiseConfidence) {
      problems.push(
        `confidence ${conf.value}/5${conf.scale === 'probability' ? ` (from p=${conf.raw})` : ''} < ${minConfidenceToAssert} and no whatWouldRaiseConfidence stated`,
      );
    }
    if (conf.scale === 'unknown' && claim.confidence !== undefined) {
      problems.push(`confidence "${claim.confidence}" is on no recognised scale (want an integer 1-5)`);
    }

    const bestTier = accepted.length ? Math.min(...accepted.map((c) => Number(c.tier))) : null;

    return {
      ...claim,
      confidenceNormalised: conf,
      classified,
      accepted,
      dropped,
      bestTier,
      independentDomains: [...independentDomains],
      singleSource,
      usable: accepted.length > 0 && problems.length === 0,
      problems,
    };
  });

  return {
    claims: results,
    usable: results.filter((r) => r.usable),
    unusable: results.filter((r) => !r.usable),
    droppedSourceCount: results.reduce((a, r) => a + r.dropped.length, 0),
  };
}

// --- helpers ---------------------------------------------------------------

function verdict(tier, reason, matchedRule, domain, source, extra = {}) {
  return { tier, reason, matchedRule: matchedRule ?? null, domain, pointerOnly: false, source, ...extra };
}

function safeParse(url) {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`);
  } catch {
    return null;
  }
}

/** Returns the matched list entry, or null. Matches host and any subdomain. */
export function matchesDomain(host, list) {
  return list.find((d) => host === d || host.endsWith(`.${d}`)) ?? null;
}

function matchesSuffix(host, suffixes) {
  return suffixes.find((s) => host.endsWith(s)) ?? null;
}

const MULTI_PART_TLDS = new Set([
  'co.uk', 'ac.uk', 'gov.uk', 'org.uk', 'com.au', 'net.au', 'org.au',
  'co.jp', 'co.nz', 'co.za', 'com.br', 'com.cn', 'europa.eu',
]);

export function registrableDomain(host) {
  const parts = String(host).toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

function isDated(source) {
  const d = source?.date;
  if (!d) return false;
  return /\b(19|20)\d\d\b/.test(String(d));
}
