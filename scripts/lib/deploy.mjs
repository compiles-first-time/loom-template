#!/usr/bin/env node
// `loom deploy` — Loom's deploy primitive.
//
// Per ADR-0019. Wraps a runtime-specific deploy command with:
//   1. loom doctor must pass (override with --force)
//   2. session_start event must exist for this session (sanity that hooks ran)
//   3. Constitution-service consultation prompt (Y/n) (skip with --yes)
//   4. Run the deploy command
//   5. Extract deployment URL via configured regex
//   6. Emit deployment_started + deployment_completed events to the log
//
// Configured by tools/runtime.yaml.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { checkDiscoveryGate } from "./discovery-gate.mjs";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const YES = args.has("--yes") || args.has("-y");

const RUNTIME_YAML = path.join(ROOT, "tools", "runtime.yaml");
const EVENT_LOG_DIR = path.join(ROOT, "memory", "event-log");

await main();

async function main() {
  const config = await loadRuntimeConfig();
  const sessionId = process.env.CLAUDE_SESSION_ID || `local-${Date.now()}`;

  // ── Step 0: discovery gate (v0.5, ADR-0026) ────────────────────────────
  process.stdout.write("Step 0/5: discovery gate\n");
  const gate = await checkDiscoveryGate(ROOT);
  if (gate.warnings.length > 0) {
    for (const w of gate.warnings) process.stdout.write(`  ! ${w}\n`);
  }
  if (!gate.ok) {
    process.stderr.write("\n  ✗ discovery is not 'good enough' to deploy:\n");
    for (const m of gate.missing) process.stderr.write(`    - ${m}\n`);
    if (!FORCE) {
      process.stderr.write(
        "\n  Fill in the missing discovery artifacts (see discovery/README.md \"When is discovery done?\"),\n" +
          "  or rerun with --force to deploy anyway. Deploying without a complete risk register\n" +
          "  is the v0.3 finding (B) — surfacing NFR gaps post-deploy is expensive.\n"
      );
      process.exit(1);
    }
    process.stderr.write("  (proceeding because --force was passed.)\n\n");
  } else {
    process.stdout.write("  ✓ discovery artifacts present and good-enough\n\n");
  }

  // ── Step 1: loom doctor ────────────────────────────────────────────────
  if (!FORCE) {
    process.stdout.write("Step 1/5: loom doctor\n");
    const doctor = spawnSync("node", ["scripts/lib/doctor.mjs"], {
      cwd: ROOT,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (doctor.status !== 0) {
      process.stderr.write("\nloom doctor failed. Fix the hard failures or rerun with --force.\n");
      process.exit(1);
    }
    process.stdout.write("\n");
  } else {
    process.stdout.write("Step 1/5: SKIPPED (--force)\n\n");
  }

  // ── Step 2: session_start sanity ───────────────────────────────────────
  process.stdout.write("Step 2/5: hook coverage check\n");
  if (!(await hasSessionStartToday(sessionId))) {
    process.stderr.write(
      `  warning: no session_start event for session ${sessionId} in today's log. Hooks may be disabled.\n`
    );
    if (!FORCE) {
      process.stderr.write("  rerun with --force to deploy anyway.\n");
      process.exit(1);
    }
  } else {
    process.stdout.write("  ✓ session_start present\n");
  }
  process.stdout.write("\n");

  // ── Step 3: constitution-service prompt ────────────────────────────────
  if (!YES) {
    process.stdout.write("Step 3/5: constitution-service consultation\n");
    process.stdout.write(
      "  Before deploying, invoke the constitution-service subagent\n" +
        "    Agent(subagent_type=\"constitution-service\", ...)\n" +
        "  and emit a `claim` event confirming the deploy is permitted (LR-02).\n\n"
    );
    const ok = await prompt("  Has constitution-service been consulted? [y/N] ");
    if (!/^y(es)?$/i.test(ok.trim())) {
      process.stdout.write("\nDeploy aborted — consult constitution-service first.\n");
      process.exit(2);
    }
    process.stdout.write("\n");
  } else {
    process.stdout.write("Step 3/5: SKIPPED (--yes)\n\n");
  }

  // ── Step 4: deploy ─────────────────────────────────────────────────────
  process.stdout.write("Step 4/5: deploy\n");
  await checkEnvRequired(config);
  const command = String(config?.deploy?.command || "").trim();
  const argv = Array.isArray(config?.deploy?.args) ? config.deploy.args : [];
  if (!command || command === "<DEPLOY_COMMAND>") {
    process.stderr.write(
      "  tools/runtime.yaml deploy.command is not set. Fill it in (e.g., 'vercel', 'netlify', 'fly').\n"
    );
    process.exit(1);
  }

  await appendEvent({
    event_type: "deployment_started",
    session_id: sessionId,
    deploy_command: `${command} ${argv.join(" ")}`.trim(),
  });

  process.stdout.write(`  $ ${command} ${argv.join(" ")}\n\n`);
  const startTs = Date.now();
  const out = await runCapturing(command, argv);
  const durationMs = Date.now() - startTs;

  // ── Step 5: URL extraction + completed event ───────────────────────────
  process.stdout.write("\nStep 5/5: record deployment\n");
  const urlPattern = config?.deploy?.post_deploy_url_pattern;
  let url = null;
  if (urlPattern) {
    try {
      const re = new RegExp(urlPattern);
      const m = (out.stdout + "\n" + out.stderr).match(re);
      if (m) url = m[1] || m[0];
    } catch (err) {
      process.stderr.write(
        `  warn: post_deploy_url_pattern is not valid regex: ${err.message}\n`
      );
    }
  }

  await appendEvent({
    event_type: "deployment_completed",
    session_id: sessionId,
    exit_code: out.exitCode,
    duration_ms: durationMs,
    deployment_url: url,
  });

  if (out.exitCode === 0) {
    process.stdout.write(`  ✓ deploy completed in ${(durationMs / 1000).toFixed(1)}s\n`);
    if (url) process.stdout.write(`  ✓ deployment URL: ${url}\n`);
    process.exit(0);
  } else {
    process.stderr.write(`  ✗ deploy failed (exit ${out.exitCode})\n`);
    process.exit(out.exitCode);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function loadRuntimeConfig() {
  if (!existsSync(RUNTIME_YAML)) {
    process.stderr.write(
      "tools/runtime.yaml is missing. Run scripts/bootstrap.{sh,ps1} first.\n"
    );
    process.exit(1);
  }
  // Minimal YAML parser for our known schema.
  const text = await fs.readFile(RUNTIME_YAML, "utf8");
  return parseRuntimeYaml(text);
}

export function parseRuntimeYaml(text) {
  const result = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  let inDeploy = false;
  const deploy = {};
  while (i < lines.length) {
    const raw = lines[i++];
    const stripped = raw.replace(/\s+$/, "");
    if (!stripped.trim() || stripped.trim().startsWith("#")) continue;
    const indent = stripped.length - stripped.trimStart().length;
    const line = stripStripInlineComment(stripped.trim());

    if (indent === 0) {
      if (line === "deploy:") {
        inDeploy = true;
        continue;
      }
      inDeploy = false;
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) result[m[1]] = parseScalar(m[2]);
      continue;
    }

    if (inDeploy && indent === 2) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) deploy[m[1]] = parseScalar(m[2]);
    }
  }
  result.deploy = deploy;
  return result;
}

function stripStripInlineComment(s) {
  let inQuote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === inQuote && s[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (c === '"' || c === "'") inQuote = c;
    else if (c === "#") return s.slice(0, i).trimEnd();
  }
  return s;
}

function parseScalar(raw) {
  const t = stripStripInlineComment(raw).trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "[]") return [];
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => unquote(s.trim()));
  }
  return unquote(t);
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

async function checkEnvRequired(config) {
  const required = Array.isArray(config?.deploy?.env_required)
    ? config.deploy.env_required
    : [];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    process.stderr.write(`  ✗ required env var(s) missing: ${missing.join(", ")}\n`);
    process.exit(1);
  }
  if (required.length) {
    process.stdout.write(`  ✓ env required: ${required.join(", ")}\n`);
  }
}

async function hasSessionStartToday(sessionId) {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const p = path.join(EVENT_LOG_DIR, `${y}-${m}-${d}.jsonl`);
  if (!existsSync(p)) return false;
  try {
    const text = await fs.readFile(p, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (rec.event_type === "session_start" && rec.session_id === sessionId) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function appendEvent(rec) {
  if (!existsSync(EVENT_LOG_DIR)) {
    await fs.mkdir(EVENT_LOG_DIR, { recursive: true });
  }
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const p = path.join(EVENT_LOG_DIR, `${y}-${m}-${d}.jsonl`);
  const enriched = {
    timestamp: new Date().toISOString(),
    cwd: ROOT,
    kernel_version: "v6",
    loom_version: "0.3.0",
    ...rec,
  };
  await fs.appendFile(p, JSON.stringify(enriched) + "\n", "utf8");
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

function runCapturing(command, argv) {
  return new Promise((resolve) => {
    const proc = spawn(command, argv, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });
    proc.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderr += s;
      process.stderr.write(s);
    });
    proc.on("error", (err) => {
      resolve({ stdout, stderr: stderr + String(err), exitCode: 1 });
    });
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
  });
}
