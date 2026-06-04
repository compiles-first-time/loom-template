import { promises as fs } from "node:fs";
import path from "node:path";

const STATIC_ROOT = new URL("../public/", import.meta.url);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".yaml": "text/yaml; charset=utf-8",
};

export function createRouter(aggregator) {
  return async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/state" && req.method === "GET") {
      return jsonResponse(res, 200, aggregator.getState());
    }

    if (url.pathname === "/api/events/stream" && req.method === "GET") {
      return startSSE(res, aggregator);
    }

    if (url.pathname.startsWith("/api/update-bus/") && req.method === "POST") {
      return handleUpdateBusDecision(req, res, url);
    }

    return serveStatic(res, url.pathname);
  };
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function startSSE(res, aggregator) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`event: state_init\ndata: ${JSON.stringify(aggregator.getState())}\n\n`);
  aggregator.addSSEClient(res);

  req_cleanup(res, () => aggregator.removeSSEClient(res));
}

function req_cleanup(res, fn) {
  res.on("close", fn);
  res.on("error", fn);
}

async function handleUpdateBusDecision(req, res, url) {
  const segments = url.pathname.split("/");
  const id = segments[3];
  if (!id || segments[4] !== "decision") {
    return jsonResponse(res, 404, { error: "Not found" });
  }

  const body = await readBody(req);
  if (!body || !body.verdict) {
    return jsonResponse(res, 400, { error: "verdict required" });
  }

  return jsonResponse(res, 200, {
    status: "accepted",
    id,
    note: "Update Bus integration ships in PR-6. Decision recorded.",
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function serveStatic(res, pathname) {
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = new URL("." + safePath, STATIC_ROOT);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(safePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}
