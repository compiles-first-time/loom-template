# EMBER

> Co-op survival RPG for 2–10 players per server. WoW-style systems, stylized look, hardcore-leaning stakes. **Godot 4.x + GDScript.** Built on the Loom substrate (below) — Loom governs *how* the game is built; [`GAME_INFRA_SPEC.md`](./GAME_INFRA_SPEC.md) governs *what* the game is.

| Start here | What it is |
|---|---|
| [`GAME_INFRA_SPEC.md`](./GAME_INFRA_SPEC.md) | **The law.** Product definition, stack, repo layout, the R1–R10 rules, the EventBus contract, data schemas, agent roster, gates, phases. On any conflict, it wins. |
| [`CLAUDE.md`](./CLAUDE.md) · [`AGENTS.md`](./AGENTS.md) | Thin adapters for Claude Code and any other harness: session ritual, write scopes, commands. |
| [`systems/`](./systems/) | **The systems atlas.** 740 systems in 16 domains, 1,131 wired edges. `scripts/systems-map.sh impact <id>` answers *what is affected, how, where, why*. Index: [`systems/ATLAS.md`](./systems/ATLAS.md); interactive map: `systems/explorer.html`. ([ADR-0065](./adr/0065-systems-atlas-and-impact-map.md)) |
| [`constitution/local-rules.md`](./constitution/local-rules.md) | Loom's local rules plus **LR-08**: this project never pushes to the `loom-template` repository. |

**Current phase:** 0 — studio setup (spec §13). **This repository was seeded from a Loom feature branch; its founding PR is marked do-not-merge and exists to be pushed to a new `ember` repository.**

---

## Loom — Architectural Base Spec Template (the substrate)

> A reusable framework for building software projects with AI assistance — safely, transparently, and with institutional memory built in. *The section below is the template's own README, kept verbatim as the reference for the governance layer EMBER inherits.*

**Status:** v1.0 (complete) + v0.3.1 (deploy hardening) + v0.3.2 (integration follow-throughs) · merged to `main` on 2026-05-22
**Kernel version:** v6
**Canonical spec:** [`loom-spec.md`](./loom-spec.md)

---

## What this is, in plain language

When you use an AI assistant (like Claude) to help write code, you usually start fresh every time. The AI doesn't remember your project's rules, your past mistakes, or which actions are dangerous in your environment. It might suggest deleting something you needed, expose a password, run up a cloud-services bill, or quietly hang for 12 hours waiting for a deploy that already failed.

**Loom is a starter kit that fixes all of that.** It's a folder of files you copy into a new software project. Once it's in place:

- The AI **knows the project's rules** — what to do, what not to do, what previous failures taught you.
- The AI **specializes** — there's a dedicated expert for authentication, one for deployment, one for databases, one for handling secrets. Each one stays in its lane and knows when to hand off.
- Every action gets **logged** — what the AI did, when, with what reasoning. Anyone can audit it later.
- Dangerous actions **pause for confirmation** — destructive commands, payment changes, secret rotations all check in with a human before executing.
- The AI **doesn't silently hang** — deploys, builds, and long-running operations have built-in detection for the "neither succeeding nor failing" state that wastes hours.
- **Lessons stick** — when something goes wrong, the failure gets written down once and avoided forever after, across every project that uses Loom.

The difference: instead of hiring a new junior developer for every project (who knows nothing and might break things), Loom is like hiring a senior developer who carries a notebook of every mistake the team has ever made, follows safety procedures by default, and asks before doing anything irreversible.

> **Loom is the workshop.** It is not itself a product. It's the substrate on top of which products (Prism, future projects) are built. Think of the difference between *a house* (a specific software product) and *a general contractor's truck full of tools, blueprints, and SOPs* (Loom). Each new project gets a fresh "warp" of Loom threaded into it via the bootstrap step.

---

## What's in the box (v1.0)

| Component | What it does | Plain-language analogy |
|---|---|---|
| **Constitution (Kernel V6)** | 8 unbreakable foundational rules + 5 project-specific rules (LR-01 through LR-05) | Company code of conduct |
| **6 base agents** | HR, EAC (research), Critic, Human-Replica, Memory-Keeper, Constitution-Service | A small ops team that runs in the background |
| **12 specialist agents** | auth, oauth, deploy, db-migration, secrets, email, file-storage, error-tracking, monitoring, queues, payments, ci | Domain experts on call — only the right one wakes up for the job |
| **Discovery flow** | A 5-question quick scan at bootstrap + a 30–60-minute deep walk that builds a risk register before you ship anything | Pre-project intake interview that prevents nasty surprises |
| **Deploy primitive** | A safe-deploy command that runs pre-flight checks, gates on discovery completeness, refuses to ship if the risk register is empty | Aviation pre-flight checklist |
| **Wait-for-deploy primitive** | Watches deploys for three outcomes — succeeded, failed, **or "non-progressing"** — and surfaces stuck deploys loudly instead of hanging silently | A flight controller, not just a timer |
| **Hooks** | Background watchers that log every tool call the AI makes to a JSONL audit log | A read-only security camera |
| **`loom doctor`** | Health-check command that surfaces drift, stale handoffs, missing files, broken cross-references | An automotive safety inspection |
| **Lessons-learned registry** | Append-only failure record that auto-suggests entries when the same failure recurs across sessions | The team's "we got burned by this" book |
| **HR work-graph** | Generates a structured task list from a plain-English requirements document | A project manager who actually reads the spec |
| **Permissions protocol (LR-04)** | Three-category meta-rule that classifies every tool call as `external_service_setup`, `destructive_actions`, or `credentials` — each gets its own pre-flight discipline | Risk classification at the moment of action |
| **Pre-flight quota check** | Before any deploy or paid-service operation, the deploy specialist verifies billing/quota state and refuses to retry on quota errors | Checking the gas gauge before a road trip |

**By the numbers:** 33 ADRs (architectural decisions, each cited and superseded only by peer-reviewed evidence), 5 Local Rules, 8 architecture layers (L0–L8), 18 subagents, ~30 scripts.

---

## The story — how Loom evolved (May 2026)

| Phase | What landed | Why |
|---|---|---|
| **v0.1** | First scaffold. Files + a canonical spec. No enforcement — you had to follow the rules yourself. | Establishing the model |
| **v0.2** | Runtime grew teeth. Hooks log everything. Bootstrap auto-stamps placeholders. `loom doctor` checks conformance. The 6 base subagents arrived. | Making the spec executable |
| **v0.3** | Production safety. Intent classifier nags when you skip a specialist. Secrets get redacted automatically. Deploy gets its own primitive. Runtime discovers MCPs + subagent staleness. | Closing the AI-shoots-foot risk class |
| **v0.4** | The 12 starter specialists shipped — each with a SKILL.md, runtime subagent, eval rubric, and citation-backed evidence basis. The "Justifications"-column failure-modes convention landed. | Specialization without bloat |
| **v0.5** | Discovery became a first-class layer (L8). Quick scan + full discovery + Critic checklists. Deploys gate on a complete risk register. | NFRs surface before deploy, not after |
| **v0.6** | Permissions got a meta-rule (LR-04) that subsumes the prior production-mutation and secrets rules. OAuth got preference detection so PKCE happens by default. | Consolidating three rules into one classifier |
| **v1.0** | HR work-graph auto-generates task lists from requirements. Specialist lifecycle (spawn / retire / promote-lessons across projects) closes the loop. | The roadmap-as-PRs phase is complete |
| **v0.3.1** | **Real-session lessons fold in.** A real Vercel + Supabase deploy session ("AnonForum") surfaced 5 silent-failure modes the v0.2 runtime didn't catch — a one-line fix took 14 hours to ship because of platform quirks (zero-quota plans, device-code scope drops, CLIs exiting 0 with error bodies, wait loops that hung on the `UNKNOWN` state). ADR-0032 codifies the fixes. | Theory met reality; reality won |
| **v0.3.2** | Integrates the v0.3.1 primitives into the deploy command, wires pre-flight quota into the permissions classifier, adds Response shape declarations across the 12 specialists, and ships a (platform, action) → (mcp / cli / human-browser) capability matrix. | Closing the loop on the AnonForum findings |

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

Run [`scripts/bootstrap.sh`](./scripts/bootstrap.sh) (or `bootstrap.ps1` on Windows) and answer the 5 quick-scan questions. The script stamps placeholders, populates the discovery quick-scan, syncs MCP YAML → JSON, and seeds the audit log. Restart Claude Code afterward so the new subagent files are registered.

Manual steps still required for the full discovery flow:

1. **Constitution** — review [`constitution/kernel-v6.md`](./constitution/kernel-v6.md); add any project-local rules to [`constitution/local-rules.md`](./constitution/local-rules.md)
2. **Layers** — skim each file in [`layers/`](./layers/) and confirm/customize defaults
3. **Agents** — for each base agent in [`agents/`](./agents/), open the directory's `SKILL.md` and confirm role; trim agents you don't need (see §E.2 — minimal-3 vs full-6)
4. **Tools** — edit [`tools/mcp-servers/config.yaml`](./tools/mcp-servers/config.yaml) for your MCP server set
5. **Discovery (full)** — run `scripts/discover.sh` to walk through the 30–60-minute requirements + risk-register + open-questions flow
6. **ADRs** — record any deviation from defaults as a new ADR in [`adr/`](./adr/)

Full bootstrap protocol is specified in **Part C** of [`loom-spec.md`](./loom-spec.md).

---

## Directory map

```
.
├── CLAUDE.md                # Primary index for Claude (chat) and Claude Code
├── AGENTS.md                # Agent roster quick-reference
├── loom-spec.md             # Canonical specification
├── constitution/            # L0 — Trajectory Kernel V6 + local rules (LR-01..LR-05)
├── layers/                  # L0–L8 layer specs (one file each; L8 = Discovery)
├── agents/                  # 6 base agents + 12 bundled specialists (under specialists/_registry/)
├── memory/                  # L3 — markdown self-knowledge, vector index, knowledge graph, event log, skills
├── tools/                   # L4 — MCP server configs + runtime.yaml (deploy config)
├── orchestration/           # L5 — Task ledger + Progress ledger + HR work-graph
├── observability/           # L6 — Langfuse config + OTel + eval suite + Critic checklists
├── discovery/               # L8 — quick-scan, requirements, risk-register, open-questions (generated)
├── adr/                     # 33 Architecture Decision Records (0000 template + 0001-0033)
├── lessons-learned/         # Failure-avoidance entries (auto-suggested on recurrence)
├── update-bus/              # L7 — semi-auto update queue (cross-project lessons propagation)
├── scripts/                 # Bootstrap + doctor + deploy + discover + hr-work-graph + secrets-doctor + ...
└── spec/                    # Source / supporting docs
```

Full structure rationale lives in **§B.2** of the spec.

---

## Pushing to GitHub

```powershell
# from the template directory
git init
git add .
git commit -m "Loom v1.0 template scaffold"
gh repo create loom-template --public --source . --remote origin --push
```

Then on GitHub: **Settings → General → Template repository → ☑**

---

## Upgrading an existing project

If your project was bootstrapped from an earlier version of the template:

```bash
# from your existing project root, with the latest loom-template checked out alongside
cp -r /path/to/loom-template/.claude .
cp -r /path/to/loom-template/scripts/hooks scripts/
cp -r /path/to/loom-template/scripts/lib scripts/
cp /path/to/loom-template/scripts/doctor.* scripts/
cp /path/to/loom-template/scripts/deploy.* scripts/
cp /path/to/loom-template/scripts/discover.* scripts/
# review any new ADRs (0017-0033) and adopt or supersede as needed
bash scripts/doctor.sh   # validate the upgrade
```

Earlier-version files are not broken by the upgrade. Restart Claude Code after copying to register new subagents.

---

## Running `loom doctor`

`scripts/doctor.{sh,ps1}` cross-checks your project for conformance: placeholders stamped, size caps held, Proposed ADRs listed in CLAUDE.md, MCP YAML/JSON in sync, subagents present + parsing, hook coverage, constitution coverage, ADR template conformance, bidirectional ADR links, handoff freshness. Exit 0 if all hard checks pass; exit 1 if any hard check fails. Pass `--fix` to attempt mechanical fixes (currently: regenerate `.claude/settings.json#mcpServers` from YAML).

**Note:** `loom doctor` exits 1 against the *template itself* on the placeholder check — that's correct, since the template ships placeholders by design for `bootstrap.{sh,ps1}` to stamp. Run doctor against a *bootstrapped project*, not the template.

---

## Roadmap

Completed:

- **v0.1** — manual scaffold; canonical spec; skeleton dirs and stubs
- **v0.2** — enforcement runtime: hooks, subagents, bootstrap unification, `loom doctor`, lessons-learned auto-suggestion, Update Bus stub
- **v0.3** — intent classifier, secrets handling, deploy primitive, runtime discovery, subagent evals
- **v0.4** — specialist registry foundation, 12 starter specialists with xlsx failure-modes convention
- **v0.5** — Discovery scaffolding (quick-scan + full flow), L8 layer, deploy gate on discovery completeness
- **v0.6** — Permissions protocol meta-rule (LR-04), OAuth preference detector
- **v1.0** — HR work-graph (requirements.md → orchestration/work-graph.json), specialist lifecycle
- **v0.3.1** — deployment hardening from AnonForum session findings ([ADR-0032](./adr/0032-deployment-hardening.md)): wait-for-terminal-state primitive, pre-flight quota check, response-body discipline, device-code-auth recovery
- **v0.3.2** — integration of v0.3.1 primitives into deploy.mjs, permissions-classifier wiring, Response shape declarations across 12 specialists, MCP-vs-CLI capability matrix ([ADR-0033](./adr/0033-mcp-vs-cli-capability-matrix.md))

Next:

- **v1.1+** — real-session-driven additions; spec mirror catch-up (§B.9 Discovery + amendments to §B.3, §B.5, §B.6); 8 deferred starter specialists once the first 12 validate in real use
- **A2A / ACP protocol adoption**
- **Cryptographic kernel-amendment signing**

Open questions and disputed claims live in **Parts G–H** of the spec.

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

*Loom v1.0 + v0.3.1 + v0.3.2 · Kernel v6 · 2026-05-22*
