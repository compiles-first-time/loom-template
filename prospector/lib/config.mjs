/**
 * Config loader. Every tunable number in PROSPECTOR lives in
 * config/prospector.config.json, never as a magic number inside a function.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = resolve(ROOT, 'config/prospector.config.json');

let cached = null;

export function loadConfig({ path = CONFIG_PATH, force = false, overrides = {} } = {}) {
  if (!cached || force || path !== CONFIG_PATH) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (path === CONFIG_PATH) cached = raw;
    else return deepMerge(raw, overrides);
  }
  return deepMerge(cached, overrides);
}

/** Shallow-per-section merge: overrides.scoring.weights replaces wholesale. */
export function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
