// Loom v0.6 permissions classifier — reads .claude/loom-permissions.yaml
// and classifies a tool call against the LR-04 meta-rule policy categories.
//
// Per ADR-0027. Categories: external_service_setup / destructive_actions /
// credentials. Each has triggers + required_protocol + enforcement.
//
// Used by pre-tool-use.mjs to emit per-category events:
//   - external_service_setup_attempted (soft)
//   - destructive_action_attempted     (hard — checks for constitution-service claim)
//   - credential_action_attempted      (soft)
//
// LR-04 subsumes LR-02 (production-mutation) and LR-03 (secrets) as
// specializations of the unified permissions framework.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";

const ROOT_DEFAULT = process.cwd();

export async function loadPermissions(root = ROOT_DEFAULT) {
  const main = path.join(root, ".claude", "loom-permissions.yaml");
  const localOverride = path.join(root, ".claude", "loom-permissions.local.yaml");
  if (!existsSync(main)) return { categories: {} };
  const mainText = await fs.readFile(main, "utf8");
  const merged = parsePermissionsYaml(mainText);
  if (existsSync(localOverride)) {
    const localText = await fs.readFile(localOverride, "utf8");
    const local = parsePermissionsYaml(localText);
    // Shallow merge: project-local categories override main categories field-wise.
    for (const [k, v] of Object.entries(local.categories || {})) {
      merged.categories[k] = { ...(merged.categories[k] || {}), ...v };
    }
  }
  return merged;
}

// Narrow YAML parser for the known permissions schema.
//
// Schema:
//   version: "1.0"
//   categories:
//     <name>:
//       triggers:
//         command_patterns:
//           - "..."
//         mcp_patterns: [ "..." ]
//         keywords: [ "..." ]
//       required_protocol:
//         - key: "value"
//       enforcement: soft | hard
export function parsePermissionsYaml(text) {
  const out = { categories: {} };
  const lines = text.split(/\r?\n/);
  let i = 0;

  // Skip until `categories:`
  while (i < lines.length && !/^categories\s*:/.test(lines[i])) i++;
  i++; // past `categories:`

  let currentCategory = null;
  let currentTriggerKey = null;

  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.replace(/\s+$/, "");
    i++;
    if (!stripped.trim() || stripped.trim().startsWith("#")) continue;

    // Category name (indent 2, ends with `:`)
    const catMatch = stripped.match(/^\s{2}(\w+)\s*:\s*$/);
    if (catMatch) {
      currentCategory = catMatch[1];
      out.categories[currentCategory] = {
        triggers: { command_patterns: [], mcp_patterns: [], keywords: [] },
        required_protocol: [],
        enforcement: "soft",
      };
      currentTriggerKey = null;
      continue;
    }

    if (!currentCategory) continue;

    // Top-level field within a category (indent 4)
    const fieldMatch = stripped.match(/^\s{4}(\w+)\s*:\s*(.*)$/);
    if (fieldMatch) {
      const [, key, val] = fieldMatch;
      if (key === "enforcement") {
        out.categories[currentCategory].enforcement = unquote(val.trim());
      } else if (key === "triggers" || key === "required_protocol") {
        // Block follows on indented lines
        currentTriggerKey = key;
      }
      continue;
    }

    // Trigger sub-key (indent 6): command_patterns / mcp_patterns / keywords
    const subKey = stripped.match(/^\s{6}(\w+)\s*:\s*(.*)$/);
    if (subKey && currentTriggerKey === "triggers") {
      const k = subKey[1];
      out.categories[currentCategory].triggers[k] =
        out.categories[currentCategory].triggers[k] || [];
      continue;
    }

    // List item under a trigger sub-key (indent 8)
    const listItem = stripped.match(/^\s{8}-\s+(.+)$/);
    if (listItem && currentTriggerKey === "triggers") {
      const lastSub = lastNonEmpty(stripped, lines, i);
      // Find which sub-key we're under by re-scanning backwards
      let subName = null;
      for (let j = i - 2; j >= 0; j--) {
        const m = lines[j].match(/^\s{6}(\w+)\s*:\s*$/);
        if (m) { subName = m[1]; break; }
        if (/^\s{4}\w+/.test(lines[j])) break; // exited triggers
      }
      if (subName) {
        out.categories[currentCategory].triggers[subName] =
          out.categories[currentCategory].triggers[subName] || [];
        out.categories[currentCategory].triggers[subName].push(yamlUnescape(unquote(listItem[1].trim())));
      }
      continue;
    }

    // Required-protocol entry (indent 6 with leading `-`)
    const protoItem = stripped.match(/^\s{6}-\s+(\w+)\s*:\s*(.+)$/);
    if (protoItem && currentTriggerKey === "required_protocol") {
      out.categories[currentCategory].required_protocol.push({
        [protoItem[1]]: unquote(protoItem[2].trim()),
      });
      continue;
    }
  }
  return out;
}

function lastNonEmpty(_curr, _arr, _i) { return null; }  // placeholder for clarity

function unquote(s) {
  s = stripInlineComment(s).trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function stripInlineComment(s) {
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

// YAML double-quoted unescape (matches registry-loader.mjs behavior).
function yamlUnescape(s) {
  return s.replace(/\\(.)/g, (_, c) => {
    switch (c) {
      case "n": return "\n";
      case "t": return "\t";
      case "r": return "\r";
      case "\\": return "\\";
      case "\"": return "\"";
      default: return "\\" + c; // keep regex escapes
    }
  });
}

// ── Classify a tool call against the loaded permissions config ───────────

export function classifyToolCall({ tool, input, permissions }) {
  if (!permissions || !permissions.categories) return [];
  const fields = ["command", "Command", "script"];
  let candidate = "";
  if (typeof input === "string") candidate = input;
  else if (input && typeof input === "object") {
    for (const f of fields) {
      if (typeof input[f] === "string") {
        candidate = input[f];
        break;
      }
    }
  }
  const hits = [];
  for (const [name, cat] of Object.entries(permissions.categories)) {
    const matched = matchCategory(candidate, tool, cat);
    if (matched) {
      hits.push({
        category: name,
        enforcement: cat.enforcement || "soft",
        matched_on: matched,
        required_protocol: cat.required_protocol || [],
      });
    }
  }
  return hits;
}

function matchCategory(commandText, toolName, cat) {
  const t = cat.triggers || {};

  // command_patterns: regex against the command string
  for (const p of t.command_patterns || []) {
    try {
      const re = new RegExp(p, "i");
      const m = commandText.match(re);
      if (m) return m[0];
    } catch { /* skip invalid regex */ }
  }

  // mcp_patterns: regex against the tool name (when it's an MCP tool name)
  for (const p of t.mcp_patterns || []) {
    try {
      const re = new RegExp(p, "i");
      if (re.test(toolName)) return toolName;
    } catch { /* skip */ }
  }

  // keywords: literal string check in command text
  for (const k of t.keywords || []) {
    if (commandText.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return null;
}
