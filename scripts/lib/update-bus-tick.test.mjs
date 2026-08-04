#!/usr/bin/env node
// Unit tests for the update-bus tick's pure helpers (ADR-0057 v0.3 receiver):
// frontmatter parsing + schema-driven inbox-item validation. The tick itself
// stays validate-and-surface only — nothing here exercises an apply path,
// because none exists (Kernel Rule 19).

import { readFileSync } from "node:fs";
import { parseFrontmatter, validateInboxItem } from "./update-bus-tick.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const schema = JSON.parse(readFileSync(new URL("../../update-bus/schema.json", import.meta.url), "utf8"));

const GOOD = `---
id: harness-eval-loop-2026-08-03-a1b
source: research-feed
proposed_by: research-scout
date: 2026-08-03
affects: [adr/0021-subagent-evals.md, layers/L2-agents.md]
risk: low
collapse_risk: false
source_tier: "1"
---

# Title

## Proposed change
...`;

console.log("\nparseFrontmatter");
{
  const fm = parseFrontmatter(GOOD);
  assert(fm !== null, "parses a frontmatter block");
  assert(fm.id === "harness-eval-loop-2026-08-03-a1b", "string value parsed");
  assert(fm.collapse_risk === false, "boolean parsed as boolean");
  assert(Array.isArray(fm.affects) && fm.affects.length === 2, "inline array parsed");
  assert(fm.affects[1] === "layers/L2-agents.md", "array items trimmed");
  assert(fm.source_tier === "1", "quoted scalar unquoted");
  assert(parseFrontmatter("# no frontmatter here") === null, "no block → null");

  const crlf = parseFrontmatter("---\r\nid: crlf-item-1a2\r\nrisk: low\r\n---\r\nbody");
  assert(crlf !== null && crlf.id === "crlf-item-1a2" && crlf.risk === "low", "CRLF-delimited frontmatter parsed");

  const commented = parseFrontmatter("---\nrisk: medium   # critic may revise\n---\n");
  assert(commented.risk === "medium", "trailing comment stripped from value");

  const bom = parseFrontmatter("﻿---\nid: bom-item-3c4\n---\nbody");
  assert(bom !== null && bom.id === "bom-item-3c4", "UTF-8 BOM stripped (PowerShell Out-File writers)");

  // Block-style YAML lists — what LLM writers naturally produce (caught live
  // by the scout's first verification run: `affects:` as `- item` lines).
  const block = parseFrontmatter("---\nid: block-item-9e1\naffects:\n  - adapters/langgraph/package.json\n  - adr/0050-second-adapter-langgraph.md\nrisk: medium\n---\n");
  assert(Array.isArray(block.affects) && block.affects.length === 2, "block-style list parsed as array");
  assert(block.affects[0] === "adapters/langgraph/package.json", "block-list items trimmed");
  assert(block.risk === "medium", "key after a block list parsed normally");

  const emptyVal = parseFrontmatter("---\nnote:\nrisk: low\n---\n");
  assert(emptyVal.note === "" && emptyVal.risk === "low", "empty scalar stays a string when no list items follow");
}

console.log("\nvalidateInboxItem");
{
  assert(validateInboxItem(parseFrontmatter(GOOD), schema).length === 0, "well-formed item validates clean");

  const missing = parseFrontmatter(GOOD);
  delete missing.risk;
  assert(validateInboxItem(missing, schema).some(e => /missing required field: risk/.test(e)), "missing required field caught");

  const badId = { ...parseFrontmatter(GOOD), id: "Bad_ID!" };
  assert(validateInboxItem(badId, schema).some(e => /does not match/.test(e)), "id pattern violation caught");

  const badEnum = { ...parseFrontmatter(GOOD), source: "twitter-thread" };
  assert(validateInboxItem(badEnum, schema).some(e => /not in \[/.test(e)), "source enum violation caught");

  const badTier = { ...parseFrontmatter(GOOD), source_tier: "4" };
  assert(validateInboxItem(badTier, schema).some(e => /source_tier/.test(e)), "tier-4 is not a legal source_tier value");

  const badBool = { ...parseFrontmatter(GOOD), collapse_risk: "false" };
  assert(validateInboxItem(badBool, schema).some(e => /expected boolean/.test(e)), "stringly-typed collapse_risk caught");

  const badDate = { ...parseFrontmatter(GOOD), date: "Aug 3 2026" };
  assert(validateInboxItem(badDate, schema).some(e => /not YYYY-MM-DD/.test(e)), "date format violation caught");

  assert(validateInboxItem(null, schema).length === 1, "null frontmatter → single clear error");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
