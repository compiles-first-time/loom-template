#!/usr/bin/env node
/**
 * scan.mjs — THE ENTRY POINT.
 *
 *   node scripts/scan.mjs --domain "AI automation services"
 *
 * Everything else in this repo exists to make this one command work, and keep
 * working, every week.
 */
import { parseArgs } from 'node:util';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, ROOT } from '../lib/config.mjs';
import { createMemory } from '../lib/memory.mjs';
import { createAgentRunner, BudgetExceededError } from '../lib/agent-runner.mjs';
import { enabledPersonas } from '../lib/personas/index.mjs';
import { runFunnel } from '../lib/funnel.mjs';
import { mockInvoke } from '../lib/mock-transport.mjs';

const USAGE = `
PROSPECTOR — scan a domain for asymmetric opportunities that fit the operator profile.

  node scripts/scan.mjs --domain "<search domain>" [options]

Options
  --domain <s>              REQUIRED. The space to scan this cycle.
  --personas <a,b>          Persona ids to run. Default: all enabled.
  --candidates <n>          Candidates requested per persona. Default 6.
  --transport <s>           claude-cli | mock. Default from config.
  --research-transport <s>  websearch | direct-api. Default websearch
                            (WebFetch/curl are egress-blocked in the sandbox;
                             use direct-api on your own machine).
  --model <s>               Model for agent calls. Default from config.
  --max-spend <n>           Hard USD ceiling for this run. Default from config.
  --shortlist <n>           Max briefs to produce. Default from config.
  --min-score <n>           Score floor for the shortlist. Default from config.
  --out <dir>               Brief output dir. Default ./briefs
  --dry-run                 Use the mock transport + fixtures. No network, no spend.
  --help
`;

const { values } = parseArgs({
  options: {
    domain: { type: 'string' },
    personas: { type: 'string' },
    candidates: { type: 'string' },
    transport: { type: 'string' },
    'research-transport': { type: 'string' },
    model: { type: 'string' },
    'max-spend': { type: 'string' },
    shortlist: { type: 'string' },
    'min-score': { type: 'string' },
    out: { type: 'string' },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean' },
  },
  allowPositionals: false,
});

if (values.help || !values.domain) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

const date = new Date().toISOString().slice(0, 10);
const runId = `${date}-${Math.random().toString(36).slice(2, 8)}`;

const overrides = { scoring: {}, agent: {} };
if (values.shortlist) overrides.scoring.shortlistSize = Number(values.shortlist);
if (values['min-score']) overrides.scoring.shortlistMinScore = Number(values['min-score']);
if (values.model) overrides.agent.model = values.model;
if (values['max-spend']) overrides.agent.maxSpendUsd = Number(values['max-spend']);
if (values.transport) overrides.agent.transport = values.transport;

const config = loadConfig({ overrides });
config._version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;

const dryRun = Boolean(values['dry-run']);
const transport = dryRun ? 'mock' : config.agent.transport;
const researchTransport = values['research-transport'] ?? 'websearch';

const operatorProfile = readFileSync(resolve(ROOT, 'memory/operator-profile.md'), 'utf8');
const memory = createMemory();
const personas = enabledPersonas(values.personas ? values.personas.split(',').map((s) => s.trim()) : null);

const runner = createAgentRunner({
  transport,
  researchTransport,
  model: config.agent.model,
  timeoutMs: config.agent.timeoutMs,
  maxTurns: config.agent.maxTurns,
  maxRetries: config.agent.maxRetries,
  maxSpendUsd: config.agent.maxSpendUsd,
  invoke: transport === 'mock' ? mockInvoke : null,
});

console.log('═'.repeat(72));
console.log(`PROSPECTOR v${config._version}  ·  run ${runId}`);
console.log('═'.repeat(72));
console.log(`domain              "${values.domain}"`);
console.log(`personas            ${personas.map((p) => p.name).join(', ')}`);
console.log(`agent transport     ${transport}${dryRun ? '  (DRY RUN — no network, no spend)' : ` (${config.agent.model})`}`);
console.log(`research transport  ${researchTransport} — ${runner.researchTransport.note}`);
console.log(`budget              $${config.agent.maxSpendUsd.toFixed(2)}`);
console.log(`weights             ${JSON.stringify(config.scoring.weights)}`);

let result;
try {
  result = await runFunnel({
    domain: values.domain,
    personas,
    runner,
    memory,
    config,
    operatorProfile,
    date,
    runId,
    candidatesPerPersona: values.candidates ? Number(values.candidates) : 6,
  });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error(`\n✗ ${err.message}`);
    process.exit(3);
  }
  console.error(`\n✗ run failed: ${err.message}`);
  process.exit(1);
}

// --- write output ----------------------------------------------------------
const outDir = resolve(ROOT, values.out ?? 'briefs');
mkdirSync(outDir, { recursive: true });
const written = [];
for (const b of result.briefs) {
  const p = resolve(outDir, b.filename);
  writeFileSync(p, b.markdown, 'utf8');
  written.push(p);
}

const runDir = resolve(ROOT, 'runs');
mkdirSync(runDir, { recursive: true });
const runPath = resolve(runDir, `${runId}.json`);
writeFileSync(
  runPath,
  `${JSON.stringify(
    {
      runId, date, domain: values.domain, transport, researchTransport,
      model: config.agent.model, weights: config.scoring.weights,
      ok: result.ok, reason: result.reason,
      standingAnswers: result.standingAnswers,
      ranked: result.ranked, shortlist: result.shortlist,
      rejected: result.rejected, unscorable: result.unscorable,
      failedBriefs: result.failedBriefs, stages: result.stages,
      briefs: written.map((p) => p.replace(`${ROOT}/`, '')),
      // Full inputs to the renderer, so a brief can be re-rendered after a
      // report.mjs change without re-paying for the research.
      briefsFull: result.briefs.map((b) => ({ id: b.id, title: b.title, score: b.score, filename: b.filename, candidate: b.candidate, evidence: b.evidence, deepDive: b.deepDive })),
      spendUsd: result.ledger.spentUsd, calls: result.ledger.calls,
      elapsedMs: result.elapsedMs,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

// --- summary ---------------------------------------------------------------
console.log(`\n${'═'.repeat(72)}`);
console.log('RESULT');
console.log('═'.repeat(72));
if (result.ranked.length) {
  console.log('\nRanked candidates that passed the constraint filter:\n');
  console.log('  score  persona                   title');
  console.log('  ─────  ────────────────────────  ─────────────────────────────────────');
  for (const c of result.ranked) {
    console.log(`  ${c.score.toFixed(2).padStart(5)}  ${String(c.persona).padEnd(24)}  ${c.title}`);
  }
}
if (result.rejected.length) {
  console.log(`\nHard-rejected (${result.rejected.length}):\n`);
  for (const r of result.rejected) {
    console.log(`  ✗ ${r.title ?? r.id}`);
    for (const reason of r.reasons) console.log(`      [${reason.rule}] ${reason.detail}`);
  }
}
console.log(`\nBriefs written (${written.length}):\n`);
for (const p of written) console.log(`  ${p.replace(`${ROOT}/`, '')}`);
if (result.failedBriefs.length) {
  console.log(`\nFailed to produce a brief (${result.failedBriefs.length}):`);
  for (const f of result.failedBriefs) console.log(`  ✗ ${f.id} at ${f.stage}: ${f.error}`);
}
console.log(`\nSpend    $${result.ledger.spentUsd.toFixed(4)} of $${config.agent.maxSpendUsd.toFixed(2)} budget`);
console.log(`Elapsed  ${(result.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Run log  ${runPath.replace(`${ROOT}/`, '')}`);
if (!result.ok) console.log(`\n⚠  ${result.reason}`);
console.log('\nRecord your verdict so the next run learns:');
console.log('  node scripts/verdict.mjs --brief <id> --verdict act|watch|kill --why "..."\n');

process.exit(result.ok ? 0 : 2);
