#!/usr/bin/env node
// Kernel-integrity guard — "the kernel is never overwritten by a program; a
// change must be a deliberate, human, consent-based act" (architect direction
// 2026-08-04; ADR-0058, enforcing Kernel Rule 19: foundational rules 1–8 are
// effectively immutable and amendable only via transparent, consented process).
//
// This is DETECTION, complementing the PREVENTION in ADR-0047 (the destructive-
// guard hook denies edits to constitution/kernel-v6.md). Together: an agent
// literally cannot edit the kernel through the hooked path, and if a change ever
// slips through (a raw write, a bypassed hook), doctor's hard check catches it
// commit-to-commit and blocks — forcing a human to consciously re-pin.
//
// EOL-normalized hash (\r\n → \n) so a Windows CRLF checkout under
// core.autocrlf never trips a false mismatch (lesson 2026-08-03).
//
// Pure functions + a CLI (guarded — importing never runs it).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const KERNEL_PATH = "constitution/kernel-v6.md";
export const PIN_PATH = "constitution/kernel-v6.sha256";

export function hashKernel(text) {
  return crypto.createHash("sha256").update(String(text).replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

// Parse the pin file: first non-comment, non-blank line is the hex digest.
export function parsePin(pinText) {
  for (const raw of String(pinText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([a-f0-9]{64})\b/i.exec(line);
    return m ? m[1].toLowerCase() : null;
  }
  return null;
}

/**
 * @returns {{ok:boolean, status:"match"|"mismatch"|"no-pin"|"no-kernel", current:(string|null), pinned:(string|null), reason:string}}
 */
export function checkKernelIntegrity(kernelText, pinText) {
  if (kernelText == null) return { ok: false, status: "no-kernel", current: null, pinned: null, reason: `${KERNEL_PATH} is missing` };
  const current = hashKernel(kernelText);
  const pinned = parsePin(pinText);
  if (!pinned) return { ok: false, status: "no-pin", current, pinned: null, reason: `${PIN_PATH} missing or unparseable — run kernel-integrity --repin (a deliberate human act)` };
  if (current === pinned) return { ok: true, status: "match", current, pinned, reason: "kernel matches its pinned hash" };
  return {
    ok: false,
    status: "mismatch",
    current,
    pinned,
    reason:
      `KERNEL CHANGED — constitution/kernel-v6.md no longer matches its pin.\n` +
      `      pinned:  ${pinned}\n      current: ${current}\n` +
      `      The kernel must never be overwritten by code (Rule 19). If this change is a\n` +
      `      DELIBERATE, human, consent-based amendment: record an ADR + override-authority\n` +
      `      sign-off, then re-pin with 'node scripts/lib/kernel-integrity.mjs --repin'.\n` +
      `      If you did NOT intend to change the kernel: revert it. Do not re-pin to silence this.`,
  };
}

function readOrNull(p) { return existsSync(p) ? readFileSync(p, "utf8") : null; }

async function main() {
  const ROOT = process.cwd();
  const kernel = readOrNull(path.join(ROOT, KERNEL_PATH));
  const pin = readOrNull(path.join(ROOT, PIN_PATH));
  const repin = process.argv.includes("--repin");

  if (repin) {
    if (kernel == null) { console.error(`error: ${KERNEL_PATH} missing — nothing to pin`); process.exit(1); }
    const h = hashKernel(kernel);
    const body =
      `# Kernel integrity pin (ADR-0058). SHA-256 of ${KERNEL_PATH}, EOL-normalized (\\r\\n -> \\n).\n` +
      `# RE-PINNING IS A DELIBERATE CONSTITUTIONAL ACT: only after a human, consent-based kernel\n` +
      `# amendment recorded in an ADR with override-authority sign-off (Rule 19). Never re-pin to\n` +
      `# silence a mismatch you did not intend. Regenerate: node scripts/lib/kernel-integrity.mjs --repin\n` +
      `${h}\n`;
    writeFileSync(path.join(ROOT, PIN_PATH), body, "utf8");
    console.log(`re-pinned ${PIN_PATH} → ${h}`);
    console.log("Reminder: this only records the new hash. The amendment itself still requires an ADR + override-authority sign-off (Rule 19).");
    process.exit(0);
  }

  const r = checkKernelIntegrity(kernel, pin);
  console.log(`kernel-integrity: ${r.status}`);
  console.log("  " + r.reason);
  process.exit(r.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
}
