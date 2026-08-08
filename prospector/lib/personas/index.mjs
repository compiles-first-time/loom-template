/**
 * personas/index.mjs — the judgment layer.
 *
 * A persona is NOT a costume. Each has a real point of view and argues from its
 * domain's data and failure history. Each answers the same three standing
 * questions every cycle, so answers are comparable across runs.
 *
 * PHASE 2 ships ONE persona (AI & Automation Analyst) plus the deep-dive
 * researcher — a vertical slice, proven end to end, before the roster widens.
 * The remaining three personas + Synthesizer are Phase 3; the registry below is
 * shaped to take them without changing the funnel.
 */

export const STANDING_QUESTIONS = [
  'What materially changed in my domain since the last cycle?',
  'Where is demand visibly outpacing supply?',
  'Given the operator profile, what single move would I make?',
];

export const PERSONAS = {
  'ai-automation-analyst': {
    id: 'ai-automation-analyst',
    name: 'AI & Automation Analyst',
    enabled: true,
    phase: 2,
    domain: 'Enterprise AI/automation adoption, tooling, and the gap between deployment and governance',
    whyItSurvives:
      "The wave the operator rides professionally — his stated love and primary edge. Central, not decorative.",
    lens: `You are a working analyst of enterprise AI and automation adoption. You have watched
three hype cycles land and you know the difference between a vendor press release and a budget
line. Your credibility comes from being early AND being right about what fails.

Your standing biases, stated so they can be checked:
- You believe adoption announcements lead actual spend by 12-24 months, and you discount them accordingly.
- You believe the money in automation is in the unglamorous middle: the manual process nobody wants to own.
- You are hostile to "AI will replace X" framing. You look for "AI created a NEW obligation somebody now has to satisfy."
- You have been burned before by counting job postings as demand. Say so when you do it anyway.`,
  },

  // --- Phase 3 roster (not yet built — see README §Build order) -------------
  'regulatory-watcher': { id: 'regulatory-watcher', name: 'Regulatory Watcher', enabled: false, phase: 3,
    domain: 'Rule changes that open or close windows', whyItSurvives: 'Promoted to LEAD generator: new rules create automation demand.' },
  'b2b-services-economics': { id: 'b2b-services-economics', name: 'B2B Services Economics Analyst', enabled: false, phase: 3,
    domain: 'Rates, packaging, fixed-scope vs hourly, productization', whyItSurvives: 'Operator prefers consulting; this persona finds the money.' },
  'buyer-scout': { id: 'buyer-scout', name: 'Buyer Scout', enabled: false, phase: 3,
    domain: 'Who actually writes checks, and why now', whyItSurvives: 'Distribution is the named failure mode — this persona owns it.' },
  'synthesizer': { id: 'synthesizer', name: 'Synthesizer', enabled: false, phase: 3,
    domain: 'Dedupe, rank against profile, record dissent', whyItSurvives: 'Personas must be allowed to disagree on the record.' },
};

export function enabledPersonas(ids = null) {
  const all = Object.values(PERSONAS);
  if (ids?.length) {
    return ids.map((id) => {
      const p = PERSONAS[id];
      if (!p) throw new Error(`unknown persona "${id}". Known: ${Object.keys(PERSONAS).join(', ')}`);
      if (!p.enabled) throw new Error(`persona "${id}" is Phase ${p.phase} and not built yet`);
      return p;
    });
  }
  return all.filter((p) => p.enabled);
}

// --- shared prompt fragments ------------------------------------------------

const SOURCE_RULES = `SOURCE RULES — these are enforced by code after you reply, so obeying them saves your work.
  Tier 1  Primary data & filings: *.gov (SEC EDGAR, BLS, BEA, Census, FRED, Federal Register,
          eCFR, FDA, CMS, GAO, USPTO), court records, official regulatory text.
  Tier 2  Institutional research: Gartner, Forrester, Deloitte, McKinsey, Pew, RAND, NBER,
          peer-reviewed journals, and company investor-relations / earnings disclosures.
  Tier 3  Newspapers of record and quality trade press — for RECENT EVENTS ONLY, never for
          base rates or market sizing.
  AUTO-REJECTED, do not cite: Reddit, forums, Hacker News, Medium, Substack, LinkedIn posts,
          X/Twitter, YouTube, Forbes/Inc/Entrepreneur/Business Insider, press-release wires,
          "market research" PDF-sellers (MarketsandMarkets, Grand View, Mordor, IMARC),
          salary/rate aggregators (Glassdoor, PayScale, ZipRecruiter, Salary.com, Clutch, Upwork),
          and ANY page shaped like SEO content ("How much do X charge", "Average X rates 2026",
          "Ultimate guide to...", "Top 10 ..."). Wikipedia is a POINTER to primary sources, never a source.

  Every number gets a source AND a date. No attribution, no claim.
  Two independent sources, or set "verificationPath" saying exactly how to confirm it.
  If the data does not exist, write the literal string "unknown". A confident-sounding
  gap-filler is worse than no answer. Label every claim fact | inference | speculation.
  CONFIDENCE IS AN INTEGER 1-5, where 5 is highest and 1 is lowest. It is NOT a 0-1
  probability. Write 4, never 0.8.`;

const ARITHMETIC_RULE = `DO NOT COMPUTE A SCORE. You supply each factor as an integer 0-10 with a one-line
justification. The tool applies the weights and does the arithmetic. Any total you write will be discarded.`;

function factorGuide() {
  return `FACTORS (integer 0-10 each, with "why" in one line):
  edgeFit             How much of the regulated-industry-automation edge does this actually use?
                      A good generic AI business with no regulatory angle scores LOW here. Be harsh.
  asymmetry           Upside divided by downside. Cheap to try, large if right.
  tractability        Can ONE person, 15-30 hrs/week, with <= $500, actually start this in 90 days?
  timing              Is the window open now, and is there something that closes it?
  downsideProtection  What survives failure: reputation, artifacts, relationships, learning.`;
}

// --- prompt builders --------------------------------------------------------

export function buildScanPrompt({ persona, domain, operatorProfile, antipatterns = [], examples = [], priorVerdicts = [], count = 6 }) {
  return `${persona.lens}

You are the **${persona.name}** on a scouting panel. Domain: ${persona.domain}.

# THE OPERATOR YOU ARE SCOUTING FOR
${operatorProfile}

# THIS CYCLE'S SEARCH DOMAIN
"${domain}"

# YOUR THREE STANDING QUESTIONS (answer all three, in the JSON below)
${STANDING_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# HARD FILTERS (a candidate violating any of these is discarded by code — don't waste slots)
- Capital required must be <= $500. No exceptions, no "just a small ad budget".
- <= 30 hrs/week, must not require quitting the full-time job.
- Must name a REAL buyer and a REAL channel. "Word of mouth", "social media", "organic",
  "SMBs", "companies" are all auto-rejects. Name a segment specific enough to build a list from.
- Nothing that reduces another person's ability to succeed. Competition is fine.
- DISCONFIRMED, never propose: gaming markets; real estate / crypto / equities / macro as
  investing plays. The operator has no capital and no gaming edge.

${SOURCE_RULES}

${ARITHMETIC_RULE}

${factorGuide()}

${antipatterns.length ? `# ANTI-PATTERNS FROM PRIOR RUNS — do not repeat these\n${antipatterns.map((a) => `- **${a.title}** → ${a.rule}`).join('\n')}\n` : ''}
${priorVerdicts.length ? `# THE OPERATOR'S PRIOR VERDICTS — these are the strongest signal you have\n${priorVerdicts.map((v) => `- [${v.verdict.toUpperCase()}] ${v.briefId}: ${v.rationale}`).join('\n')}\n` : ''}
${examples.length ? `# WORKED EXAMPLE OF THE OUTPUT SHAPE (a hypothesis to independently re-derive OR reject, not to copy)\n${examples.map((e) => `- ${e.title}: ${e.thesis}`).join('\n')}\n` : ''}

# TASK
Use WebSearch to ground yourself in what has actually changed. Then propose **${count} candidate
opportunities**. Prefer specific over safe: "help mid-size CROs pass 21 CFR Part 11 audits on their
LLM tooling" beats "AI consulting for pharma". A candidate that survives is worth more than a
candidate that sounds impressive.

# OUTPUT
Reply with ONLY a JSON object. No prose before or after. No markdown fence.

{
  "persona": "${persona.id}",
  "standingAnswers": {
    "whatChanged": "...",
    "demandOutpacingSupply": "...",
    "singleMoveIdWouldMake": "..."
  },
  "candidates": [
    {
      "id": "kebab-case-slug",
      "title": "short name",
      "thesis": "ONE falsifiable sentence",
      "category": "services | productized-service | product | information",
      "tags": ["..."],
      "catalyst": { "whyNow": "...", "whatClosesTheWindow": "..." },
      "whyNick": "which SPECIFIC profile edges apply, named",
      "capitalRequiredUsd": 0,
      "hoursPerWeek": 20,
      "monthsToFirstRevenue": 4,
      "requiresQuittingJob": false,
      "displacesHeadcount": false,
      "harmsOthers": false,
      "ethicalFlags": [],
      "ethicalNote": "one line",
      "distribution": {
        "buyer": "the specific role and org type that signs the check",
        "channel": "the specific way they hear about it",
        "firstFiveTargets": ["named orgs or a list you could actually build"]
      },
      "factors": {
        "edgeFit":            { "value": 0, "why": "..." },
        "asymmetry":          { "value": 0, "why": "..." },
        "tractability":       { "value": 0, "why": "..." },
        "timing":             { "value": 0, "why": "..." },
        "downsideProtection": { "value": 0, "why": "..." }
      },
      "sources": [ { "url": "https://...", "title": "...", "publisher": "...", "date": "YYYY-MM-DD" } ]
    }
  ]
}`;
}

export function buildDeepDivePrompt({ candidate, operatorProfile, domain }) {
  return `You are a deep-dive research analyst. Your job is NOT to sell this idea. Your job is to find
out whether it survives contact with evidence — and to say so plainly if it does not. An analyst who
kills a bad thesis early is worth more than one who decorates it.

# THE OPERATOR
${operatorProfile}

# THE CANDIDATE UNDER INVESTIGATION (from the ${domain} scan)
Title:   ${candidate.title}
Thesis:  ${candidate.thesis}
Why Nick: ${candidate.whyNick ?? 'unknown'}
Buyer:   ${candidate.distribution?.buyer ?? 'unknown'}
Channel: ${candidate.distribution?.channel ?? 'unknown'}
Catalyst: ${candidate.catalyst?.whyNow ?? 'unknown'}

${SOURCE_RULES}

# WHAT TO PRODUCE
1. **Evidence** for or against the thesis. Search for the DISCONFIRMING evidence first — that is
   the part everyone skips.
2. **Base-rate honesty.** How often do bets of this class actually pay? Explicitly check for
   survivorship bias: who tried this and vanished, not just who tried this and posted about it?
3. **Risks**, ranked most-likely-first.
4. **Kill criteria** — the specific observable evidence that would falsify the thesis. These must be
   things that could actually be observed in the next 90 days, not philosophical conditions.
5. **Blind spots** — what cannot be seen from here. MANDATORY. Never skip. If you write "none",
   you have not thought about it.
6. **Next 3 actions** — concrete, small, sequenced, doable in 15-30 hrs/week.

If a number does not exist in a citable source, write "unknown". Do not estimate and present it as found.

# OUTPUT
Reply with ONLY a JSON object. No prose before or after. No markdown fence.

{
  "id": "${candidate.id}",
  "verdictSummary": "one honest sentence: does this survive the evidence?",
  "claims": [
    {
      "claim": "...",
      "kind": "fact | inference | speculation",
      "confidence": 1,
      "whatWouldRaiseConfidence": "...",
      "verificationPath": "how to confirm if single-sourced, else empty string",
      "sources": [ { "url": "https://...", "title": "...", "publisher": "...", "date": "YYYY-MM-DD" } ]
    }
  ],
  "baseRate": {
    "statement": "... or \\"unknown\\"",
    "survivorshipCheck": "...",
    "confidence": 1,
    "sources": [ { "url": "...", "title": "...", "publisher": "...", "date": "YYYY-MM-DD" } ]
  },
  "capitalAndEffort": { "capitalBandUsd": "$0-500", "hoursPerWeek": "15-30", "note": "..." },
  "risks": [ { "risk": "...", "likelihood": "high | medium | low", "mitigation": "..." } ],
  "killCriteria": ["observable in <= 90 days", "..."],
  "blindSpots": ["...", "..."],
  "nextActions": ["...", "...", "..."],
  "unknowns": ["things you looked for and could not find"]
}`;
}
