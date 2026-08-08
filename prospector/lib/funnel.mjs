/**
 * funnel.mjs — the pipeline. Orchestration only; every judgment call is
 * delegated to an agent and every arithmetic call to a deterministic module.
 *
 *   personas ──▶ constraint-filter ──▶ dedupe/rank ──▶ scoring ──▶ deep-dive
 *              (code)                 (code)          (code)      (agent)
 *              ──▶ source-tiers ──▶ report ──▶ briefs/YYYY-MM-DD-*.md
 *                  (code)           (code)
 */
import { filterCandidates } from './constraint-filter.mjs';
import { score, rank } from './scoring.mjs';
import { validateEvidence } from './source-tiers.mjs';
import { renderBrief, briefFilename, BriefContractError } from './report.mjs';
import { buildScanPrompt, buildDeepDivePrompt } from './personas/index.mjs';

export async function runFunnel({
  domain,
  personas,
  runner,
  memory,
  config,
  operatorProfile,
  date,
  runId,
  candidatesPerPersona = 6,
  logger = console,
}) {
  const started = Date.now();
  const stages = [];
  // Declared up front: finish() closes over these and may be called from any
  // early-return path, before the later stages have run.
  let ranked = [];
  let shortlist = [];
  let unscorable = [];
  const briefs = [];
  const failedBriefs = [];
  const antipatterns = memory.read('antipatterns').entries;
  const examples = memory.read('examples').entries;
  const priorVerdicts = memory.read('verdicts').entries;

  // --- 1. GENERATE (agents) ------------------------------------------------
  logger.log(`\n[1/5] generate — ${personas.length} persona(s)`);
  const generated = [];
  const standingAnswers = [];
  for (const persona of personas) {
    logger.log(`  → ${persona.name} scanning "${domain}" …`);
    const res = await runner.run({
      label: `scan:${persona.id}`,
      prompt: buildScanPrompt({ persona, domain, operatorProfile, antipatterns, examples, priorVerdicts, count: candidatesPerPersona }),
      expect: 'object',
    });
    if (!res.ok) {
      logger.error(`  ✗ ${persona.name} produced no parseable output: ${res.error}`);
      stages.push({ stage: 'generate', persona: persona.id, ok: false, error: res.error });
      continue;
    }
    const cands = Array.isArray(res.data.candidates) ? res.data.candidates : [];
    cands.forEach((c) => generated.push({ ...c, persona: persona.id }));
    if (res.data.standingAnswers) standingAnswers.push({ persona: persona.id, ...res.data.standingAnswers });
    logger.log(`  ✓ ${persona.name}: ${cands.length} candidates ($${res.costUsd.toFixed(3)})`);
    stages.push({ stage: 'generate', persona: persona.id, ok: true, count: cands.length, costUsd: res.costUsd });
  }
  if (!generated.length) {
    throw new Error('no candidates were generated — every persona failed. Check `claude` CLI auth and network.');
  }

  // --- 2. FILTER (code) ----------------------------------------------------
  logger.log(`\n[2/5] constraint-filter — ${generated.length} candidates in`);
  const { passed, rejected } = filterCandidates(generated, config.constraints);
  for (const r of rejected) {
    logger.log(`  ✗ ${r.candidate?.title ?? r.candidate?.id}: ${r.reasons.map((x) => x.rule).join(', ')}`);
  }
  logger.log(`  ✓ ${passed.length} passed, ${rejected.length} hard-rejected`);
  stages.push({ stage: 'filter', in: generated.length, passed: passed.length, rejected: rejected.length });
  if (!passed.length) {
    return finish({ ok: false, reason: 'all candidates were hard-rejected by the constraint filter' });
  }

  // --- 3. DEDUPE (code; the Synthesizer persona replaces this in Phase 3) ---
  const deduped = dedupe(passed);
  logger.log(`\n[3/5] dedupe — ${passed.length} → ${deduped.length}`);
  stages.push({ stage: 'dedupe', in: passed.length, out: deduped.length });

  // --- 4. SCORE (code — never an agent) ------------------------------------
  logger.log(`\n[4/5] scoring`);
  const scored = [];
  for (const c of deduped) {
    try {
      scored.push({ ...c, scoring: score(c.factors, { weights: config.scoring.weights, min: config.scoring.factorMin, max: config.scoring.factorMax }) });
    } catch (err) {
      unscorable.push({ candidate: c, error: err.message });
      logger.log(`  ✗ ${c.title}: ${err.message}`);
    }
  }
  ranked = rank(scored);
  for (const c of ranked) logger.log(`  ${c.scoring.score.toFixed(2)}  ${c.title}`);
  stages.push({ stage: 'score', scored: scored.length, unscorable: unscorable.length });

  shortlist = ranked
    .filter((c) => c.scoring.score >= config.scoring.shortlistMinScore)
    .slice(0, config.scoring.shortlistSize);
  logger.log(`  → shortlist: ${shortlist.length} (>= ${config.scoring.shortlistMinScore}, cap ${config.scoring.shortlistSize})`);
  if (!shortlist.length) {
    return finish({ ok: false, reason: `nothing scored >= ${config.scoring.shortlistMinScore}; best was ${ranked[0]?.scoring.score.toFixed(2) ?? 'n/a'}` });
  }

  // --- 5. DEEP DIVE (agent) + 6. SOURCE TIERS (code) -----------------------
  logger.log(`\n[5/5] deep-dive + source-tier gate + render — ${shortlist.length} candidate(s)`);
  for (const c of shortlist) {
    logger.log(`  → researching "${c.title}" …`);
    const res = await runner.run({
      label: `deepdive:${c.id}`,
      prompt: buildDeepDivePrompt({ candidate: c, operatorProfile, domain }),
      expect: 'object',
    });
    if (!res.ok) {
      logger.error(`  ✗ deep-dive failed for ${c.id}: ${res.error}`);
      failedBriefs.push({ id: c.id, stage: 'deep-dive', error: res.error });
      continue;
    }
    const deepDive = res.data;
    logger.log(`  ✓ ${c.title} ($${res.costUsd.toFixed(3)}) — ${deepDive.verdictSummary ?? ''}`);

    // Source-tier gate: agent claims are filtered by code, not trusted.
    const claims = [
      ...(Array.isArray(deepDive.claims) ? deepDive.claims : []),
      ...(deepDive.baseRate?.statement && deepDive.baseRate.statement !== 'unknown'
        ? [{ claim: `[base rate] ${deepDive.baseRate.statement}`, kind: 'inference', confidence: deepDive.baseRate.confidence, sources: deepDive.baseRate.sources ?? [] }]
        : []),
      // The scan-stage sources are evidence too, and get the same treatment.
      ...(Array.isArray(c.sources) && c.sources.length
        ? [{ claim: `[catalyst] ${c.catalyst?.whyNow ?? c.thesis}`, kind: 'inference', confidence: 3, sources: c.sources }]
        : []),
    ];
    const evidence = validateEvidence(claims, {
      minIndependentSources: config.evidence.minIndependentSources,
      minConfidenceToAssert: config.evidence.minConfidenceToAssert,
    });
    logger.log(`    source-tiers: ${evidence.usable.length}/${evidence.claims.length} claims usable, ${evidence.droppedSourceCount} source(s) rejected`);

    const meta = { runId, date, domain, persona: c.persona, version: config._version, researchTransport: runner.researchTransport.id, briefId: c.id };
    let markdown;
    try {
      markdown = renderBrief({ candidate: c, scoring: c.scoring, evidence, deepDive, meta });
    } catch (err) {
      if (err instanceof BriefContractError) {
        logger.error(`  ✗ ${c.id} failed the brief contract: ${err.missing.join(', ')} — not written`);
        failedBriefs.push({ id: c.id, stage: 'contract', error: err.message, missing: err.missing });
        continue;
      }
      throw err;
    }
    briefs.push({ id: c.id, title: c.title, score: c.scoring.score, filename: briefFilename(c.id, date), markdown, candidate: c, evidence, deepDive });
  }
  stages.push({ stage: 'deep-dive', briefs: briefs.length, failed: failedBriefs.length });

  return finish({ ok: briefs.length > 0, reason: briefs.length ? null : 'no brief survived the deep-dive and contract gates' });

  function finish({ ok, reason }) {
    return {
      ok,
      reason,
      runId,
      date,
      domain,
      briefs,
      shortlist: shortlist.map((c) => ({ id: c.id, title: c.title, score: c.scoring.score })),
      ranked: ranked.map((c) => ({ id: c.id, title: c.title, score: c.scoring.score, persona: c.persona })),
      rejected: rejected.map((r) => ({ id: r.candidate?.id, title: r.candidate?.title, reasons: r.reasons })),
      unscorable,
      failedBriefs,
      standingAnswers,
      stages,
      ledger: runner.ledger,
      elapsedMs: Date.now() - started,
    };
  }
}

/** Deterministic dedupe. Phase 3 replaces this with the Synthesizer persona
 *  (which additionally records dissent between personas). */
export function dedupe(candidates) {
  const seen = new Map();
  for (const c of candidates) {
    const key = normalise(c.id) || normalise(c.title);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
      continue;
    }
    // Keep the one with the higher edgeFit; record that personas converged.
    const keep = (c.factors?.edgeFit?.value ?? 0) > (existing.factors?.edgeFit?.value ?? 0) ? c : existing;
    const other = keep === c ? existing : c;
    keep.convergedWith = [...(keep.convergedWith ?? []), other.persona].filter(Boolean);
    seen.set(key, keep);
  }
  return [...seen.values()];
}

function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !['the', 'a', 'an', 'for', 'of', 'and', 'to', 'in', 'on', 'with'].includes(w))
    .sort()
    .join('-');
}
