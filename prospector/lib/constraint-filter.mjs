/**
 * constraint-filter.mjs — hard rejects. DETERMINISTIC.
 *
 * Encodes the operator's hard constraints (see memory/operator-profile.md §Hard
 * constraints). A candidate that violates ANY of these is rejected before it
 * ever costs a deep-dive research call. Rejection reasons are data, not vibes.
 */

/** Constraint 6: edges the operator explicitly DISCONFIRMED. Do not resurrect. */
export const DISCONFIRMED_DOMAINS = [
  {
    id: 'gaming-markets',
    label: 'Gaming markets',
    note: 'v1 doc claimed a "strong edge" here. Operator confirmed that is false.',
    patterns: [
      /\bgaming market/i,
      /\bgame (item|skin|key|asset)s?\b/i,
      /\bsteam (market|community market|inventory)/i,
      /\bskin (trading|flipping|market)/i,
      /\bin-game (econom|currenc|asset)/i,
    ],
  },
  {
    id: 'capital-deployment',
    label: 'Capital deployment / investing plays',
    note: 'No investable capital. $500 at 50%/yr for 10yr is ~$28.8K — arithmetically closed.',
    patterns: [
      // Deliberately does NOT match "real estate investment trusts" — serving a
      // sector is not investing in it. See `unless` below.
      /\breal[- ]estate\s+(investing|flipping|syndication|wholesaling|rentals?)\b/i,
      /\binvest(ing)?\s+in\s+real[- ]estate\b/i,
      /\bhouse (flipping|hacking)/i,
      /\bcrypto(currency)?\s+(trad|invest|arbitrage|yield|staking|mining)/i,
      /\byield farming\b/i,
      /\b(equit(y|ies)|stock|share)s?\s+(trad|invest|picking)/i,
      /\b(day|swing|algo(rithmic)?|options|futures|forex|fx)[- ]trading\b/i,
      /\bmacro (trade|bet|position)/i,
      /\bdividend (investing|portfolio)/i,
      /\bbuy(ing)? (and )?hold/i,
    ],
    /**
     * The operator's edge IS regulated finance (MassMutual). Selling compliance
     * automation TO a hedge fund, REIT, or crypto exchange is his core business
     * and must not be swept up here. This constraint is about DEPLOYING CAPITAL,
     * and capital deployment is already caught by constraint 1 regardless.
     */
    unless: [
      /\b(automat|complianc|audit|regulat|reporting|workflow|software|saas|tooling|consult|advisor|advisory|service|onboarding|kyc|aml|surveillance|recordkeeping)/i,
    ],
  },
];

/** Distribution answers that are not answers. "Build it and they will come" = auto-reject. */
export const VAGUE_DISTRIBUTION_PHRASES = [
  'build it and they will come',
  'word of mouth',
  'organic growth',
  'organic',
  'viral',
  'virality',
  'go viral',
  'social media',
  'marketing',
  'advertising',
  'seo',
  'content marketing',
  'tbd',
  'to be determined',
  'unknown',
  'n/a',
  'na',
  'none',
  'various',
  'anyone',
  'everyone',
  'businesses',
  'companies',
  'the market',
  'consumers',
  'users',
];

/** Constraint 4: the ethical filter. */
export const ETHICAL_DENYLIST = [
  'predatory',
  'deceptive',
  'fraudulent',
  'privacy-violating',
  'surveillance',
  'discriminatory',
  'regulatory-evasion',
  'exploitative',
  'addictive-by-design',
  'misleading-claims',
];

const MIN_DISTRIBUTION_CHARS = 8;

/**
 * @param {object} candidate
 * @param {object} constraints  from config.constraints
 * @returns {{rejected:boolean, reasons:Array<{rule:string,detail:string}>, warnings:Array<{rule:string,detail:string}>}}
 */
export function checkCandidate(candidate, constraints) {
  const reasons = [];
  const warnings = [];
  const c = candidate ?? {};

  // --- Constraint 1: capital ---------------------------------------------
  const capital = c.capitalRequiredUsd;
  if (capital === undefined || capital === null) {
    reasons.push({ rule: 'capital', detail: 'capitalRequiredUsd not stated — cannot verify constraint 1 (<= $' + constraints.maxCapitalUsd + ')' });
  } else if (typeof capital !== 'number' || !Number.isFinite(capital) || capital < 0) {
    reasons.push({ rule: 'capital', detail: `capitalRequiredUsd must be a non-negative number, got ${JSON.stringify(capital)}` });
  } else if (capital > constraints.maxCapitalUsd) {
    reasons.push({ rule: 'capital', detail: `requires ~$${capital} up-front; operator ceiling is $${constraints.maxCapitalUsd}` });
  }

  // --- Constraint 2: time / must not require quitting ---------------------
  const hours = c.hoursPerWeek;
  if (hours === undefined || hours === null) {
    reasons.push({ rule: 'time', detail: `hoursPerWeek not stated — cannot verify constraint 2 (<= ${constraints.maxHoursPerWeek} hrs/wk)` });
  } else if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
    reasons.push({ rule: 'time', detail: `hoursPerWeek must be a non-negative number, got ${JSON.stringify(hours)}` });
  } else if (hours > constraints.maxHoursPerWeek) {
    reasons.push({ rule: 'time', detail: `needs ~${hours} hrs/wk; operator ceiling is ${constraints.maxHoursPerWeek} alongside a full-time job` });
  }
  if (c.requiresQuittingJob === true && !constraints.allowQuittingJob) {
    reasons.push({ rule: 'time', detail: 'requires leaving full-time employment — operator constraint forbids it' });
  }

  // --- Constraint 3: time-to-revenue (soft; ceiling is hard) --------------
  const months = c.monthsToFirstRevenue;
  if (months === undefined || months === null) {
    warnings.push({ rule: 'horizon', detail: 'monthsToFirstRevenue not stated' });
  } else if (typeof months !== 'number' || !Number.isFinite(months) || months < 0) {
    reasons.push({ rule: 'horizon', detail: `monthsToFirstRevenue must be a non-negative number, got ${JSON.stringify(months)}` });
  } else if (months > constraints.hardMonthsToRevenueCeiling) {
    reasons.push({ rule: 'horizon', detail: `first revenue ~${months} months out; hard ceiling is ${constraints.hardMonthsToRevenueCeiling}` });
  } else if (months > constraints.preferredMonthsToRevenueMax) {
    warnings.push({ rule: 'horizon', detail: `first revenue ~${months} months out; operator prefers <= ${constraints.preferredMonthsToRevenueMax}. Tolerated, penalise on Timing.` });
  }

  // --- Constraint 4: ethical filter ---------------------------------------
  const flags = normaliseFlags(c.ethicalFlags);
  const hits = flags.filter((f) => ETHICAL_DENYLIST.includes(f));
  if (hits.length) {
    reasons.push({ rule: 'ethics', detail: `ethical flag(s): ${hits.join(', ')} — reduces others' ability to succeed` });
  }
  if (c.harmsOthers === true) {
    reasons.push({ rule: 'ethics', detail: `self-declared harm to others${c.ethicalNote ? `: ${c.ethicalNote}` : ''}` });
  }
  if (constraints.requireEthicalAssessment && c.harmsOthers === undefined && !c.ethicalFlags) {
    reasons.push({ rule: 'ethics', detail: 'no ethical assessment supplied (need harmsOthers:boolean and/or ethicalFlags:[])' });
  }

  // The open question from the operator profile. NOT a reject — a surfaced flag.
  if (c.displacesHeadcount === true) {
    warnings.push({
      rule: 'open-question',
      detail: 'This engagement class displaces paid work. Operator has NOT decided whether to accept headcount-reduction mandates. Surface BEFORE negotiation.',
    });
  }

  // --- Constraint 5: distribution must be named ---------------------------
  if (constraints.requireNamedDistribution) {
    const buyer = str(c.distribution?.buyer);
    const channel = str(c.distribution?.channel);
    if (!buyer) reasons.push({ rule: 'distribution', detail: 'no buyer named — who actually writes the check?' });
    else if (isVague(buyer)) reasons.push({ rule: 'distribution', detail: `buyer "${buyer}" is not a named buyer` });

    if (!channel) reasons.push({ rule: 'distribution', detail: 'no channel named — how do they hear about it?' });
    else if (isVague(channel)) reasons.push({ rule: 'distribution', detail: `channel "${channel}" is "build it and they will come" in disguise` });
  }

  // --- Constraint 6: disconfirmed domains ---------------------------------
  // Each field is tested INDEPENDENTLY. The `unless` exemption must appear in
  // the same field as the match, so a candidate cannot smuggle a real-estate
  // investing thesis past the filter by adding a "compliance" tag.
  const fields = [
    ['title', c.title],
    ['thesis', c.thesis],
    ['category', c.category],
    ...(Array.isArray(c.tags) ? c.tags.map((t, i) => [`tags[${i}]`, t]) : []),
  ].filter(([, v]) => typeof v === 'string' && v.trim());

  for (const d of DISCONFIRMED_DOMAINS) {
    let rejectedHere = false;
    for (const [field, text] of fields) {
      const pat = d.patterns.find((p) => p.test(text));
      if (!pat) continue;
      const exempt = d.unless?.find((p) => p.test(text));
      if (exempt) {
        warnings.push({
          rule: 'disconfirmed-domain',
          detail: `${field} mentions "${d.label}" but reads as SERVING that sector rather than entering it (${exempt}). Passed — verify the framing.`,
        });
        continue;
      }
      if (!rejectedHere) {
        reasons.push({ rule: 'disconfirmed-domain', detail: `${field} matches disconfirmed domain "${d.label}" (${pat}) — ${d.note}` });
        rejectedHere = true;
      }
    }
  }

  return { rejected: reasons.length > 0, reasons, warnings };
}

/**
 * @returns {{passed:Array, rejected:Array<{candidate:object,reasons:Array}>, warnings:Array}}
 */
export function filterCandidates(candidates, constraints) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  const passed = [];
  const rejected = [];
  const warnings = [];

  for (const candidate of candidates) {
    const r = checkCandidate(candidate, constraints);
    if (r.warnings.length) {
      warnings.push({ id: candidate?.id, title: candidate?.title, warnings: r.warnings });
    }
    if (r.rejected) {
      rejected.push({ candidate, reasons: r.reasons });
    } else {
      passed.push({ ...candidate, constraintWarnings: r.warnings });
    }
  }
  return { passed, rejected, warnings };
}

// --- helpers ---------------------------------------------------------------

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function normaliseFlags(v) {
  if (!Array.isArray(v)) return [];
  return v.map((f) => String(f).trim().toLowerCase());
}

export function isVague(text) {
  const t = String(text).trim().toLowerCase().replace(/[.!]+$/, '');
  if (t.length < MIN_DISTRIBUTION_CHARS) return true;
  if (VAGUE_DISTRIBUTION_PHRASES.includes(t)) return true;
  // A phrase made up ENTIRELY of vague tokens is still vague
  // ("organic word of mouth", "social media marketing").
  const stripped = VAGUE_DISTRIBUTION_PHRASES.reduce(
    (acc, p) => acc.replaceAll(p, ' '),
    ` ${t} `,
  );
  return stripped.replace(/[^a-z0-9]/g, '').length === 0;
}
