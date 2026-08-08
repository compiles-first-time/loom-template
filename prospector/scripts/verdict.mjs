#!/usr/bin/env node
/**
 * verdict.mjs — record the operator's Act / Watch / Kill call on a brief.
 * This is the signal that makes next week's run different from this week's.
 */
import { parseArgs } from 'node:util';
import { createMemory } from '../lib/memory.mjs';

const { values } = parseArgs({
  options: {
    brief: { type: 'string' },
    verdict: { type: 'string' },
    why: { type: 'string' },
    endorsed: { type: 'string' }, // 6-month checkpoint: true|false
    list: { type: 'boolean' },
    help: { type: 'boolean' },
  },
});

const memory = createMemory();

if (values.help) {
  console.log(`
  node scripts/verdict.mjs --brief <id> --verdict act|watch|kill --why "..."
  node scripts/verdict.mjs --brief <id> --endorsed true|false   # 6-month checkpoint
  node scripts/verdict.mjs --list
`);
  process.exit(0);
}

if (values.list) {
  const entries = memory.read('verdicts').entries;
  if (!entries.length) console.log('No verdicts recorded yet.');
  for (const e of entries) {
    console.log(`  [${e.verdict.toUpperCase().padEnd(5)}] ${e.date}  ${e.briefId}  ${e.rationale}${e.endorsedAt6Months !== null ? `  (6mo: ${e.endorsedAt6Months ? 'still endorsed' : 'not endorsed'})` : ''}`);
  }
  const ns = memory.northStar();
  console.log(`\nNorth star — Acted briefs still endorsed at 6 months: ${ns.rate === null ? ns.note : `${(ns.rate * 100).toFixed(0)}% (${ns.stillEndorsed}/${ns.judgedCount})`}`);
  process.exit(0);
}

if (!values.brief) {
  console.error('--brief <id> is required');
  process.exit(1);
}

if (values.endorsed !== undefined) {
  const data = memory.read('verdicts');
  const entry = data.entries.find((e) => e.briefId === values.brief && e.verdict === 'act');
  if (!entry) {
    console.error(`no ACT verdict recorded for brief "${values.brief}" — nothing to check in on`);
    process.exit(1);
  }
  entry.endorsedAt6Months = values.endorsed === 'true';
  memory.write('verdicts', data);
  console.log(`✓ 6-month checkpoint recorded for ${values.brief}: ${entry.endorsedAt6Months ? 'still endorsed' : 'not endorsed'}`);
  process.exit(0);
}

try {
  const { entry } = memory.recordVerdict({
    briefId: values.brief,
    verdict: values.verdict,
    rationale: values.why ?? '',
  });
  console.log(`✓ recorded ${entry.verdict.toUpperCase()} on ${entry.briefId}`);
  console.log('  It will be injected into the next scan prompt as prior-verdict context.');
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
