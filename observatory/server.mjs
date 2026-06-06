#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { exec } from "node:child_process";

import { Aggregator } from "./lib/aggregator.mjs";
import { FileWatcher } from "./lib/file-watcher.mjs";
import { createRouter } from "./lib/router.mjs";

const PROJECT_ROOT = process.env.LOOM_PROJECT_ROOT || process.cwd();
const CONFIG_PATH = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "config.yaml");

function loadConfig() {
  const defaults = { server: { port: 4040, open_browser: true }, replay: { days: 7 }, theme: "dark" };
  if (!existsSync(CONFIG_PATH)) return defaults;
  try {
    const text = readFileSync(CONFIG_PATH, "utf8");
    const port = text.match(/port:\s*(\d+)/);
    const open = text.match(/open_browser:\s*(true|false)/);
    const days = text.match(/days:\s*(\d+)/);
    const theme = text.match(/theme:\s*(\w+)/);
    return {
      server: {
        port: port ? parseInt(port[1], 10) : defaults.server.port,
        open_browser: open ? open[1] === "true" : defaults.server.open_browser,
      },
      replay: { days: days ? parseInt(days[1], 10) : defaults.replay.days },
      theme: theme ? theme[1] : defaults.theme,
    };
  } catch {
    return defaults;
  }
}

const config = loadConfig();
const aggregator = new Aggregator();
const watcher = new FileWatcher();
const router = createRouter(aggregator);

const EVENT_LOG_DIR = path.join(PROJECT_ROOT, "memory", "event-log");
const ORCHESTRATION_DIR = path.join(PROJECT_ROOT, "orchestration");
const UPDATE_BUS_INBOX = path.join(PROJECT_ROOT, "update-bus", "inbox");

watcher.onJsonlAppend((record) => aggregator.ingestEvent(record));
watcher.onFileChange((filePath) => aggregator.ingestFileChange(filePath));

const server = http.createServer(router);

async function start() {
  console.log(`[observatory] project root: ${PROJECT_ROOT}`);
  console.log(`[observatory] replaying ${config.replay.days} days of event log...`);

  await watcher.replayJsonlFiles(EVENT_LOG_DIR, config.replay.days);

  const s = aggregator.state;
  const eventCount =
    s.sessions.history.length +
    s.sessions.active.length +
    s.failures.errors.length +
    s.deploys.history.length +
    s.compliance.destructive_ops.length;
  console.log(`[observatory] replayed state: ${eventCount} events ingested`);

  watcher.watchJsonlDir(EVENT_LOG_DIR);
  watcher.watchDir(ORCHESTRATION_DIR, (f) => f.endsWith(".json") || f.endsWith(".md"));
  watcher.watchDir(UPDATE_BUS_INBOX, (f) => f.endsWith(".md"));

  const port = config.server.port;
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`[observatory] listening at ${url}`);

    if (config.server.open_browser) {
      const cmd =
        process.platform === "win32" ? `start "" "${url}"`
        : process.platform === "darwin" ? `open "${url}"`
        : `xdg-open "${url}"`;
      exec(cmd, () => {});
    }
  });
}

process.on("SIGINT", () => {
  console.log("\n[observatory] shutting down");
  watcher.close();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  watcher.close();
  server.close();
  process.exit(0);
});

start().catch((err) => {
  console.error("[observatory] startup error:", err);
  process.exit(1);
});
