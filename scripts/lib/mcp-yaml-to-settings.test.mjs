#!/usr/bin/env node
// Unit tests for scripts/lib/mcp-yaml-to-settings.mjs — the YAML→settings.json
// generator behind doctor's hard `mcp-yaml-json-alignment` check. Focus: the
// EOL-normalized comparison (phantom-drift fix, 2026-08-03) and parser basics.

import { parseMcpYaml, toClaudeMcpServers, mergeSettings, normalizeEol } from "./mcp-yaml-to-settings.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nnormalizeEol (the fresh-Windows-clone phantom-drift fix)");
{
  const lf = '{\n  "a": 1\n}\n';
  const crlf = '{\r\n  "a": 1\r\n}\r\n';
  assert(normalizeEol(crlf) === lf, "CRLF checkout compares equal to LF generation");
  assert(normalizeEol(lf) === lf, "LF input unchanged");
  assert(normalizeEol(crlf) !== crlf, "normalization actually rewrites CRLF");
  const drifted = '{\r\n  "a": 2\r\n}\r\n';
  assert(normalizeEol(drifted) !== lf, "real content drift still detected through CRLF");
}

console.log("\nparseMcpYaml");
{
  const yaml = [
    'version: "1.0"',
    "servers:",
    "  filesystem:",
    "    enabled: true",
    "    transport: stdio",
    '    command: "npx"',
    '    args: ["-y", "@modelcontextprotocol/server-filesystem"]',
    "    env:",
    '      FS_ROOT: "./"',
    "  disabled-one:",
    "    enabled: false   # set true to enable",
    '    command: "noop"',
  ].join("\n");
  const parsed = parseMcpYaml(yaml);
  assert(parsed.servers.filesystem.command === "npx", "command parsed");
  assert(parsed.servers.filesystem.args.length === 2, "args array parsed");
  assert(parsed.servers.filesystem.env.FS_ROOT === "./", "env entry parsed");
  assert(parsed.servers["disabled-one"].enabled === false, "inline-comment boolean parsed as false");

  const out = toClaudeMcpServers(parsed.servers);
  assert("filesystem" in out, "enabled server emitted");
  assert(!("disabled-one" in out), "disabled server skipped");
}

console.log("\nmergeSettings");
{
  const merged = mergeSettings({ hooks: { keep: true } }, { s1: { command: "x" } });
  assert(merged.hooks && merged.hooks.keep === true, "existing hooks block preserved");
  assert(merged.mcpServers.s1.command === "x", "mcpServers replaced");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
