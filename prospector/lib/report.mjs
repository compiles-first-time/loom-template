/**
 * report.mjs — the brief template renderer. DETERMINISTIC.
 *
 * Output contract is §4 of the kickoff. Two rules the renderer ENFORCES rather
 * than hopes for:
 *   1. Blind spots are mandatory. A brief without them does not render.
 *   2. The score shows its arithmetic. Always.
 *
 * Formatting follows the operator's contract: tables over paragraphs, bold on
 * load-bearing terms, numbers instead of hedge-fog.
 */
import { TIER } from './source-tiers.mjs';

export const REQUIRED_SECTIONS = [
  'thesis', 'category', 'catalyst', 'whyNick', 'evidence', 'baseRate',
  'capitalAndEffort', 'risks', 'killCriteria', 'blindSpots', 'nextActions', 'score',
];

export class BriefContractError extends Error {
  constructor(missing) {
    super(`brief is missing required section(s): ${missing.join(', ')}`);
    this.name = 'BriefContractError';
    this.missing = missing;
  }
}

/**
 * @param {object} brief  { candidate, scoring, evidence, deepDive, meta }
 * @returns {string} markdown
 */
export function renderBrief(brief) {
  const missing = checkContract(brief);
  if (missing.length) throw new BriefContractError(missing);

  const { candidate: c, scoring, evidence, deepDive: d, meta = {} } = brief;
  const L = [];

  L.push(`# ${c.title}`);
  L.push('');
  L.push(`> **Thesis** — ${c.thesis}`);
  L.push('');
  L.push(`\`${meta.runId ?? 'run'}\` · generated **${meta.date ?? ''}** · domain **"${meta.domain ?? ''}"** · persona **${c.persona ?? meta.persona ?? '?'}** · research transport **${meta.researchTransport ?? '?'}**`);
  L.push('');

  // --- score first: it is the reason this brief exists ---------------------
  L.push('## Score');
  L.push('');
  L.push(`### **${scoring.score.toFixed(2)} / ${scoring.max.toFixed(2)}**`);
  L.push('');
  L.push('| Factor | Weight | Rating (0–10) | Contribution | Why |');
  L.push('|---|---:|---:|---:|---|');
  for (const b of scoring.breakdown) {
    L.push(`| **${b.label}** | ${b.weight} | ${b.raw} | ${b.contribution.toFixed(2)} | ${clean(b.why) || '—'} |`);
  }
  L.push(`| | | | **${scoring.score.toFixed(2)}** | |`);
  L.push('');
  L.push('**Arithmetic shown:**');
  L.push('');
  L.push('```');
  L.push(scoring.arithmetic);
  L.push('```');
  L.push('');

  // --- the frame -----------------------------------------------------------
  L.push('## At a glance');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| **Category / horizon** | ${clean(c.category)} / ${fmtMonths(c.monthsToFirstRevenue)} to first revenue |`);
  L.push(`| **Capital** | ${fmtUsd(c.capitalRequiredUsd)}${d?.capitalAndEffort?.capitalBandUsd ? ` (deep-dive band: ${clean(d.capitalAndEffort.capitalBandUsd)})` : ''} |`);
  L.push(`| **Effort** | ~${clean(c.hoursPerWeek)} hrs/week |`);
  L.push(`| **Buyer** | ${clean(c.distribution?.buyer)} |`);
  L.push(`| **Channel** | ${clean(c.distribution?.channel)} |`);
  if (c.distribution?.firstFiveTargets?.length) {
    L.push(`| **First targets** | ${c.distribution.firstFiveTargets.map(clean).join(' · ')} |`);
  }
  if (d?.verdictSummary) L.push(`| **Researcher's read** | ${clean(d.verdictSummary)} |`);
  L.push('');

  // --- operator-facing flags ----------------------------------------------
  if (c.constraintWarnings?.length) {
    L.push('## ⚠️ Flags for the operator');
    L.push('');
    for (const w of c.constraintWarnings) {
      L.push(`- **${w.rule}** — ${clean(w.detail)}`);
    }
    L.push('');
  }

  // --- catalyst ------------------------------------------------------------
  L.push('## Catalyst — why now');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| **What opens the window** | ${clean(c.catalyst?.whyNow)} |`);
  L.push(`| **What closes it** | ${clean(c.catalyst?.whatClosesTheWindow)} |`);
  L.push('');

  L.push('## Why Nick — edge match');
  L.push('');
  L.push(clean(c.whyNick));
  L.push('');

  // --- evidence ------------------------------------------------------------
  L.push('## Evidence');
  L.push('');
  L.push(renderEvidenceTable(evidence));
  L.push('');
  if (evidence.droppedSourceCount > 0) {
    L.push(`> **${evidence.droppedSourceCount} source(s) were auto-rejected** by \`lib/source-tiers.mjs\` before this table was built — see *Rejected sources* at the bottom. This is the filter working, not a gap in research.`);
    L.push('');
  }

  // --- base rate -----------------------------------------------------------
  L.push('## Base-rate honesty');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| **How often does this class of bet pay?** | ${clean(d.baseRate?.statement) || 'unknown'} |`);
  L.push(`| **Survivorship check** | ${clean(d.baseRate?.survivorshipCheck) || 'unknown'} |`);
  L.push(`| **Confidence (1–5)** | ${d.baseRate?.confidence ?? 'unknown'} |`);
  L.push('');

  // --- risks ---------------------------------------------------------------
  L.push('## Risks & failure modes');
  L.push('');
  L.push('*Ranked most-likely first.*');
  L.push('');
  L.push('| # | Likelihood | Risk | Mitigation |');
  L.push('|---:|---|---|---|');
  rankRisks(d.risks).forEach((r, i) => {
    L.push(`| ${i + 1} | **${clean(r.likelihood) || '?'}** | ${clean(r.risk)} | ${clean(r.mitigation) || '—'} |`);
  });
  L.push('');

  // --- kill criteria -------------------------------------------------------
  L.push('## Kill criteria');
  L.push('');
  L.push('*The specific evidence that would falsify the thesis. If any of these is observed, stop.*');
  L.push('');
  d.killCriteria.forEach((k) => L.push(`- ${clean(k)}`));
  L.push('');

  // --- blind spots (mandatory) --------------------------------------------
  L.push('## Blind spots');
  L.push('');
  L.push('*What we cannot see from here. Mandatory section — never skipped.*');
  L.push('');
  d.blindSpots.forEach((b) => L.push(`- ${clean(b)}`));
  if (d.unknowns?.length) {
    L.push('');
    L.push('**Looked for and could not find:**');
    L.push('');
    d.unknowns.forEach((u) => L.push(`- ${clean(u)}`));
  }
  L.push('');

  // --- next actions --------------------------------------------------------
  L.push('## Next 3 actions');
  L.push('');
  d.nextActions.slice(0, 3).forEach((a, i) => L.push(`${i + 1}. ${clean(a)}`));
  L.push('');

  // --- appendix: what got thrown away -------------------------------------
  const dropped = evidence.claims.flatMap((cl) => cl.dropped.map((dr) => ({ claim: cl.claim, ...dr })));
  if (dropped.length) {
    L.push('---');
    L.push('');
    L.push('## Appendix — rejected sources');
    L.push('');
    L.push('| Domain | Reason | Rule | On claim |');
    L.push('|---|---|---|---|');
    for (const dr of dropped) {
      L.push(`| \`${dr.domain ?? '?'}\` | ${dr.reason} | ${clean(dr.matchedRule) || '—'} | ${truncate(clean(dr.claim), 60)} |`);
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## Verdict');
  L.push('');
  L.push('*Operator decision. Record it so the next run learns from it:*');
  L.push('');
  L.push('```bash');
  L.push(`node scripts/verdict.mjs --brief ${meta.briefId ?? c.id} --verdict act|watch|kill --why "..."`);
  L.push('```');
  L.push('');
  L.push(`<sub>PROSPECTOR ${meta.version ?? ''} · scoring weights ${JSON.stringify(scoring.weights)} · not financial advice; every decision is the operator's.</sub>`);
  L.push('');

  return L.join('\n');
}

export function checkContract(brief) {
  const missing = [];
  const c = brief?.candidate ?? {};
  const d = brief?.deepDive ?? {};

  if (!c.thesis) missing.push('thesis');
  if (!c.category) missing.push('category');
  if (!c.catalyst?.whyNow) missing.push('catalyst');
  if (!c.whyNick) missing.push('whyNick');
  if (!brief?.evidence?.claims) missing.push('evidence');
  if (!d.baseRate) missing.push('baseRate');
  if (c.capitalRequiredUsd === undefined || c.hoursPerWeek === undefined) missing.push('capitalAndEffort');
  if (!Array.isArray(d.risks) || !d.risks.length) missing.push('risks');
  if (!Array.isArray(d.killCriteria) || !d.killCriteria.length) missing.push('killCriteria');
  // Mandatory. Never skipped.
  if (!Array.isArray(d.blindSpots) || !d.blindSpots.length) missing.push('blindSpots');
  if (!Array.isArray(d.nextActions) || !d.nextActions.length) missing.push('nextActions');
  if (!brief?.scoring?.arithmetic) missing.push('score');
  return missing;
}

function renderEvidenceTable(evidence) {
  const rows = ['| Claim | Kind | Best tier | Sources | Date | Conf. /5 | Flags |', '|---|---|---:|---|---|---:|---|'];
  if (!evidence.claims.length) return '*No evidence survived the source filter. Treat every number in this brief as `unknown`.*';

  for (const cl of evidence.claims) {
    const flags = [];
    if (cl.singleSource) flags.push('`single-source`');
    if (!cl.usable) flags.push('`unusable`');
    if (cl.dropped.length) flags.push(`\`${cl.dropped.length} rejected\``);
    const srcs = cl.accepted.length
      ? cl.accepted.map((a) => `[${a.domain}](${a.source.url})`).join('<br>')
      : '**none survived**';
    const dates = cl.accepted.length ? cl.accepted.map((a) => a.source.date ?? '**undated**').join('<br>') : '—';
    const tier = cl.bestTier === null ? '—' : cl.bestTier === TIER.REJECTED ? 'REJ' : cl.bestTier;
    const conf = cl.confidenceNormalised;
    const confCell = conf?.value === null || conf?.value === undefined
      ? '?'
      : `${conf.value}${conf.scale === 'probability' ? `<br><sub>p=${conf.raw}</sub>` : ''}`;
    rows.push(`| ${clean(cl.claim)} | ${cl.kind ?? '?'} | **${tier}** | ${srcs} | ${dates} | ${confCell} | ${flags.join(' ') || '—'} |`);
  }

  const problems = evidence.claims.flatMap((cl) => cl.problems.map((p) => `- **${truncate(clean(cl.claim), 50)}** — ${p}`));
  if (problems.length) {
    rows.push('');
    rows.push('**Evidence-gate problems:**');
    rows.push('');
    rows.push(...problems);
  }
  return rows.join('\n');
}

const LIKELIHOOD_ORDER = { high: 0, medium: 1, med: 1, low: 2 };
function rankRisks(risks = []) {
  return [...risks].sort(
    (a, b) => (LIKELIHOOD_ORDER[String(a.likelihood).toLowerCase()] ?? 1) - (LIKELIHOOD_ORDER[String(b.likelihood).toLowerCase()] ?? 1),
  );
}

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|').trim();
}
function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function fmtUsd(n) {
  return typeof n === 'number' ? `$${n.toLocaleString('en-US')}` : 'unknown';
}
function fmtMonths(n) {
  return typeof n === 'number' ? `${n} months` : 'unknown';
}

/** `briefs/2026-08-08-slug.md` */
export function briefFilename(candidateId, date) {
  const slug = String(candidateId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${date}-${slug}.md`;
}
