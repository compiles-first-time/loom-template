# Loom — Architectural Base Spec Template

> A reusable AI-augmented development ecosystem. This repository is the **template** (`project-000`) — clone it to bootstrap new agentic software projects.

**Status:** v0.1 scaffold
**Kernel version:** v6
**Canonical spec:** [`loom-spec.md`](./loom-spec.md)

---

## What this is

Loom is the *workshop* in which agentic software projects are designed, scaffolded, governed, and refined. It is not itself a product — it is the substrate on top of which products (Prism, future projects) are built.

Think of the difference between *a house* (a specific software product) and *a general contractor's truck full of tools, blueprints, and SOPs* (Loom). Each new project gets a fresh "warp" of Loom threaded into it via the bootstrap step.

**Read the full spec first:** [`loom-spec.md`](./loom-spec.md). The reading guide at the top will route you by intent.

---

## How to use this template

### Option A — Use as a GitHub template repository

1. Push this repo to GitHub (see [Pushing to GitHub](#pushing-to-github) below)
2. On GitHub, go to **Settings → General** and enable **"Template repository"**
3. On any other PC, click **"Use this template"** on the GitHub repo page to spin up a new project
4. Clone the new repo locally and follow [Bootstrapping a new project](#bootstrapping-a-new-project)

### Option B — Clone directly

```bash
git clone https://github.com/<you>/loom-template my-new-project
cd my-new-project
rm -rf .git
git init
```

Then follow [Bootstrapping a new project](#bootstrapping-a-new-project).

---

## Bootstrapping a new project

The full bootstrap protocol is specified in **Part C** of [`loom-spec.md`](./loom-spec.md). At v0.1, bootstrap is manual — a `loom init` CLI is on the roadmap. Steps:

1. **Rename** — edit [`CLAUDE.md`](./CLAUDE.md) and [`AGENTS.md`](./AGENTS.md), replace the project name and one-sentence description
2. **Constitution** — review [`constitution/kernel-v6.md`](./constitution/kernel-v6.md); add any project-local rules to [`constitution/local-rules.md`](./constitution/local-rules.md)
3. **Layers** — skim each file in [`layers/`](./layers/) and confirm/customize defaults
4. **Agents** — for each base agent in [`agents/`](./agents/), open the directory's `SKILL.md` and confirm role; trim agents you don't need (see §E.2 — minimal-3 vs full-6)
5. **Tools** — edit [`tools/mcp-servers/config.yaml`](./tools/mcp-servers/config.yaml) for your MCP server set
6. **ADRs** — record any deviation from defaults as a new ADR in [`adr/`](./adr/)
7. **Commit** — `git add . && git commit -m "Loom scaffold: <project-name>"`

---

## Directory map

```
.
├── CLAUDE.md                # Primary index for Claude (chat) and Claude Code
├── AGENTS.md                # Agent roster quick-reference
├── loom-spec.md             # Canonical v0.1 specification
├── constitution/            # L0 — Trajectory Kernel V6 + local rules
├── layers/                  # L0–L7 layer specs (one file each)
├── agents/                  # Base agent set + dynamic specialists
├── memory/                  # L3 — markdown self-knowledge, vector, KG, log, skills
├── tools/                   # L4 — MCP server configs
├── orchestration/           # L5 — Task + Progress ledgers
├── observability/           # L6 — Langfuse, OTel, eval suite
├── adr/                     # Architecture Decision Records
├── lessons-learned/         # Failure-avoidance events
├── update-bus/              # L7 — semi-auto update queue
├── scripts/                 # Bootstrap helpers
└── spec/                    # Source / supporting docs
```

Full structure rationale lives in **§B.2** of the spec.

---

## Pushing to GitHub

```powershell
# from the template directory
git init
git add .
git commit -m "Loom v0.1 template scaffold"
gh repo create loom-template --public --source . --remote origin --push
```

Then on GitHub: **Settings → General → Template repository → ☑**

---

## Roadmap

- **v0.1** (this) — manual scaffold; canonical spec; skeleton dirs and stubs
- **v0.2** — `loom init <name>` CLI, smoke evals, `loom doctor` env check
- **v0.3** — Update Bus implementation; cross-project lessons propagation
- **v1.0** — A2A / ACP protocol adoption; cryptographic kernel-amendment signing

Open questions and disputed claims live in **Parts G–H** of the spec.

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

*Loom v0.1 · Kernel v6 · 2026-05-14*
