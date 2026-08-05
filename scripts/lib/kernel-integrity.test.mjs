#!/usr/bin/env node
// Tests for scripts/lib/kernel-integrity.mjs — the kernel-immutability guard
// (ADR-0058, Rule 19). Verifies: match passes, ANY change fails, EOL-normalized
// (a CRLF checkout doesn't false-fail), missing pin/kernel fail loudly, and the
// real repo kernel matches its committed pin.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashKernel, parsePin, checkKernelIntegrity, KERNEL_PATH, PIN_PATH } from "./kernel-integrity.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const KERNEL = "# Kernel V6\n\nRule 1 ...\n";
const pinFor = (text) => `# comment\n${hashKernel(text)}\n`;

console.log("\nhashing + pin parsing");
{
  assert(/^[a-f0-9]{64}$/.test(hashKernel(KERNEL)), "sha256 hex digest");
  assert(hashKernel(KERNEL) === hashKernel(KERNEL.replace(/\n/g, "\r\n")), "EOL-normalized — CRLF hashes same as LF (no false-fail on Windows checkout)");
  assert(parsePin(pinFor(KERNEL)) === hashKernel(KERNEL), "parsePin skips comments, returns the digest");
  assert(parsePin("# only comments\n") === null, "no digest → null");
  assert(parsePin("garbage") === null, "non-hex → null");
}

console.log("\ncheck outcomes");
{
  assert(checkKernelIntegrity(KERNEL, pinFor(KERNEL)).ok === true, "match → ok");
  const changed = checkKernelIntegrity(KERNEL + " tampered", pinFor(KERNEL));
  assert(changed.ok === false && changed.status === "mismatch", "ANY change → mismatch (not ok)");
  assert(/never be overwritten by code/i.test(changed.reason), "mismatch reason states the Rule-19 manual-amendment requirement");
  assert(changed.current && changed.pinned && changed.current !== changed.pinned, "reports both current and pinned digests");
  assert(checkKernelIntegrity(KERNEL, null).status === "no-pin", "missing pin → no-pin (fails)");
  assert(checkKernelIntegrity(null, pinFor(KERNEL)).status === "no-kernel", "missing kernel → no-kernel (fails)");
  assert(checkKernelIntegrity(KERNEL, null).ok === false && checkKernelIntegrity(null, "x").ok === false, "no-pin and no-kernel both fail closed");
}

console.log("\nsingle-char tamper is caught (no silent drift)");
{
  const tampered = KERNEL.replace("Rule 1", "Rule 0");
  assert(checkKernelIntegrity(tampered, pinFor(KERNEL)).ok === false, "one-word kernel edit is detected");
}

console.log("\nthe REAL repo kernel matches its committed pin");
{
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const kp = path.join(ROOT, KERNEL_PATH), pp = path.join(ROOT, PIN_PATH);
  assert(existsSync(kp) && existsSync(pp), "kernel + pin files exist in the repo");
  const r = checkKernelIntegrity(readFileSync(kp, "utf8"), readFileSync(pp, "utf8"));
  assert(r.ok === true, `committed kernel matches its pin (else re-pin was skipped) — ${r.status}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
