/**
 * memory.mjs — read/write the three memory banks. DETERMINISTIC.
 *
 *   references/examples.json      worked examples of good output (additive, safe)
 *   references/antipatterns.json  observed failures + the rule each produces
 *   references/verdicts.json      operator's Act / Watch / Kill calls per brief
 *
 * Learning rates (Phase D of the build order) are enforced here as CODE so the
 * loop cannot overfit to one bad brief:
 *   - examples      update immediately (additive)
 *   - process rules change only after >= 2 similar signals
 *   - structural    changes only after >= 3 signals AND explicit approval
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT } from './config.mjs';

export const LEARNING_RATES = Object.freeze({
  example: { minSignals: 1, requiresApproval: false },
  process: { minSignals: 2, requiresApproval: false },
  structural: { minSignals: 3, requiresApproval: true },
});

export const VERDICTS = Object.freeze(['act', 'watch', 'kill']);

const FILES = {
  examples: 'references/examples.json',
  antipatterns: 'references/antipatterns.json',
  verdicts: 'references/verdicts.json',
};

const EMPTY = {
  examples: { version: 1, entries: [] },
  antipatterns: { version: 1, entries: [] },
  verdicts: { version: 1, entries: [] },
};

export function createMemory({ root = ROOT } = {}) {
  const pathFor = (bank) => resolve(root, FILES[bank]);

  function read(bank) {
    assertBank(bank);
    const p = pathFor(bank);
    if (!existsSync(p)) return structuredClone(EMPTY[bank]);
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8'));
      if (!Array.isArray(parsed.entries)) throw new Error('missing entries[]');
      return parsed;
    } catch (err) {
      throw new Error(`memory bank "${bank}" at ${p} is corrupt: ${err.message}`);
    }
  }

  function write(bank, data) {
    assertBank(bank);
    const p = pathFor(bank);
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    renameSync(tmp, p); // atomic-enough: no half-written bank on crash
    return p;
  }

  /** Additive and idempotent on `id`. Returns {added:boolean, entry}. */
  function append(bank, entry) {
    const data = read(bank);
    if (!entry?.id) throw new Error(`entry for "${bank}" needs an id`);
    const existing = data.entries.findIndex((e) => e.id === entry.id);
    if (existing >= 0) {
      data.entries[existing] = { ...data.entries[existing], ...entry };
      write(bank, data);
      return { added: false, updated: true, entry: data.entries[existing] };
    }
    data.entries.push(entry);
    write(bank, data);
    return { added: true, updated: false, entry };
  }

  /**
   * Record an operator verdict on a brief. This is the signal that makes the
   * next run different from this one.
   */
  function recordVerdict({ briefId, verdict, rationale = '', date, signals = [] }) {
    const v = String(verdict).toLowerCase();
    if (!VERDICTS.includes(v)) {
      throw new Error(`verdict must be one of ${VERDICTS.join('|')}, got "${verdict}"`);
    }
    if (!briefId) throw new Error('recordVerdict needs a briefId');
    return append('verdicts', {
      id: `${briefId}::${v}`,
      briefId,
      verdict: v,
      rationale,
      date: date ?? isoDate(),
      signals,
      endorsedAt6Months: null, // north-star metric, filled in later
    });
  }

  /**
   * Gate a proposed change to the loop against the learning rates.
   * @returns {{allowed:boolean, reason:string, required:number, have:number}}
   */
  function canLearn({ kind, signals = [], approved = false }) {
    const rate = LEARNING_RATES[kind];
    if (!rate) throw new Error(`unknown learning kind "${kind}" (expected: ${Object.keys(LEARNING_RATES).join('|')})`);
    const have = Array.isArray(signals) ? signals.length : Number(signals) || 0;
    if (have < rate.minSignals) {
      return { allowed: false, reason: `"${kind}" change needs >= ${rate.minSignals} similar signals, have ${have}. Never overfit to one bad brief.`, required: rate.minSignals, have };
    }
    if (rate.requiresApproval && !approved) {
      return { allowed: false, reason: `"${kind}" change requires explicit operator approval`, required: rate.minSignals, have };
    }
    return { allowed: true, reason: 'ok', required: rate.minSignals, have };
  }

  /** North-star metric: % of Acted briefs the operator still endorses at 6 months. */
  function northStar() {
    const acted = read('verdicts').entries.filter((e) => e.verdict === 'act');
    const judged = acted.filter((e) => e.endorsedAt6Months !== null && e.endorsedAt6Months !== undefined);
    return {
      actedCount: acted.length,
      judgedCount: judged.length,
      stillEndorsed: judged.filter((e) => e.endorsedAt6Months === true).length,
      rate: judged.length ? judged.filter((e) => e.endorsedAt6Months === true).length / judged.length : null,
      note: judged.length ? null : 'No Acted brief has reached its 6-month checkpoint yet.',
    };
  }

  return { read, write, append, recordVerdict, canLearn, northStar, pathFor, LEARNING_RATES };
}

function assertBank(bank) {
  if (!(bank in FILES)) throw new Error(`unknown memory bank "${bank}" (expected: ${Object.keys(FILES).join('|')})`);
}

export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
