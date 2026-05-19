# Loom — Architectural Base Spec Template

> A reusable AI-augmented development ecosystem. This repository is the **template** (`project-000`) — clone it to bootstrap new agentic software projects.

**Status:** v0.2.0 scaffold (v0.1 docs + v0.2 enforcement runtime)
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

## Upgrading from v0.1

If your project was bootstrapped from the v0.1 template, the v0.2 enforcement runtime is opt-in and additive:

```bash
# from your existing v0.1 project root, with the v0.2 template checked out alongside
cp -r /path/to/loom-template/.claude .
cp -r /path/to/loom-template/scripts/hooks scripts/
cp -r /path/to/loom-template/scripts/lib scripts/
cp /path/to/loom-template/scripts/doctor.* scripts/
# next Claude Code session will start populating memory/event-log/YYYY-MM-DD.jsonl
bash scripts/doctor.sh   # validate the upgrade
```

No v0.1 files are broken by the upgrade.

## Running `loom doctor`

`scripts/doctor.{sh,ps1}` cross-checks your project for v0.2 conformance: placeholders stamped, size caps held, Proposed ADRs listed in CLAUDE.md, MCP YAML/JSON in sync, subagents present + parsing, hook coverage. Exit 0 if all hard checks pass; exit 1 if any hard check fails. Pass `--fix` to attempt mechanical fixes (currently: regenerate `.claude/settings.json#mcpServers` from YAML).

**Note:** `loom doctor` exits 1 against the *template itself* on the placeholder check — that's correct, since the template ships placeholders by design for `bootstrap.{sh,ps1}` to stamp. Run doctor against a *bootstrapped project*, not the template.

## Roadmap

- **v0.1** — manual scaffold; canonical spec; skeleton dirs and stubs
- **v0.2 (this)** — enforcement runtime: hooks ([ADR-0011](./adr/0011-claude-code-enforcement-runtime.md)), subagents, bootstrap unification, `loom doctor`, lessons-learned auto-suggestion, Update Bus stub
- **v0.3** — Update Bus implementation; cross-project lessons propagation
- **v1.0** — A2A / ACP protocol adoption; cryptographic kernel-amendment signing

Open questions and disputed claims live in **Parts G–H** of the spec.

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

*Loom v0.1 · Kernel v6 · 2026-05-14*
