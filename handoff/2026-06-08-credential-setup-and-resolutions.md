# Loom collaboration handoff — 2026-06-08 (Credential-setup shipped + base-template resolutions)

> Successor to [`handoff/2026-06-07-credential-agent-and-sovereign-forge.md`](./2026-06-07-credential-agent-and-sovereign-forge.md).

---

## TL;DR — paste into a new chat

```
This is the Loom template project (compiles-first-time/loom-template).
I am Nick, the architect. You are the builder.

IMPORTANT: open this session ROOTED IN C:\Users\14134\dev\loom-template
so the hooks fire and the L9 observatory captures the session live. The
previous session ran from the wrong cwd and was NOT governed (gap #4) —
fixing that is the first task below.

Two things happened 2026-06-07/08 (all UNCOMMITTED, in the working tree):
1. SHIPPED the credential-setup specialist (ADR-0042) + validated it
   end-to-end by registering Alpaca paper keys for Sovereign Forge
   (brokerage now Connected, paper). See "What shipped" below.
2. APPROVED four base-template resolutions to implement now (see
   "Next work"). Gap #4 (cwd-robust hooks/observatory) is #1.

Read this file, then propose the gap-#4 ADR before editing hooks.
Don't start building until Nick says go.
```

---

## What shipped this session (UNCOMMITTED — in the working tree)

### Task 1 — `credential-setup` specialist (loom-template)
A bundled specialist that acquires web-gated credentials (register / login / 2FA / API-key retrieval) under a human-in-the-loop consent model, handing the secret to `collect-credentials` (stdin → keyring) and never capturing it.

Files (all new/modified, uncommitted):
- `adr/0042-credential-setup-specialist.md` (NEW, Proposed) — consent model (Rule 8 + LR-04), LR-03 secret-handoff seam, decline triggers, cost model, **+ the two executing-agent-constraint findings** and the **path-preference rule**.
- `agents/specialists/_registry/credential-setup/SKILL.md` (NEW) — 10 `CRED-EX` failure modes, consent protocol, 2FA pause, pre-flight path check, executing-agent + domain-block constraints.
- `agents/specialists/_registry/manifest.yaml` — new `credential-setup` row.
- `.claude/agents/credential-setup.md` (NEW) — runtime subagent counterpart.
- `observability/eval-suite/subagents/credential-setup.md` (NEW) — canonical-prompt eval.
- `scripts/collect-credentials.{ps1,sh}` — added `alpaca` (paired two-header validate-before-store); **fixed pre-existing PS7-only ternary + added UTF-8 BOM so the .ps1 parses under Windows PowerShell 5.1** (gap #5 for this script).
- `tools/provisioning-playbooks/alpaca.md` (NEW) — sourced against authoritative Alpaca docs; `issuetokens`/OAuth disambiguation; Class A2 = `alpaca-mcp-server`.
- `.claude/loom-permissions.yaml` — new `browser_credential_automation` category (classifier-verified, 60/60 tests pass).
- `tools/mcp-servers/config.yaml` — `alpaca-docs` MCP registered (`enabled: false`, http).
- `tools/mcp-cli-capability-matrix.md` — new **Alpaca** section.
- `CLAUDE.md` — ADR-0042 added to ADRs-in-flight.

`loom doctor`: no regressions. 2 hard failures are **pre-existing** (template `<PROJECT_NAME>` placeholders; ADR-0035 `Proposed` not in CLAUDE.md in-flight while its summary line calls it Accepted — a status inconsistency). Offer to reconcile ADR-0035/0036 status in the PR.

### Task 2 — validated on Sovereign Forge (`C:\Users\14134\dev\sovereign-forge`)
- Architect created the Alpaca paper account + keys in-browser; the collector validated + attested + stored them in the OS keyring (service `loom-sovereign-forge`).
- `src/config/index.js` patched with a **synchronous `keyring:` resolver** (reads via `@napi-rs/keyring`, installed `--save-optional` in `src/`). `src/scripts/lib/keyring.mjs` copied so the collector resolves from `src/`. `src/.env.local` holds only `keyring:` refs.
- `node index.js --status` → **Brokerage: Connected (paper)** ($100k equity / $400k buying power). LLM still `NOT CONFIGURED` (Anthropic key pending).
- Follow-up chip created: evaluate migrating SF trading from the `@alpacahq/alpaca-trade-api` SDK to `alpaca-mcp-server`.

## Findings from the validation (folded into SKILL.md + ADR-0042)
1. **Executing-agent constraint:** a standard Claude instance is prohibited from creating accounts / entering passwords / solving CAPTCHAs → specialist degrades to *guide + validate + store*; human performs auth actions.
2. **Browser domain block:** the agent browser tool blocks brokerage domains outright (Alpaca was) → even read-only nav fails → degrade to *text guidance from docs + docs MCP*.
3. **Pre-flight path check:** verify programmatic/OAuth/MCP path before browser automation (the `issuetokens`-is-OAuth, not key-creation lesson).
4. **SF integration gap:** hand-rolled sync env loader couldn't resolve keyring refs — patched.
5. **Collector robustness:** Alpaca paired validation; PS 5.1 ternary + BOM.

---

## Next work — four base-template resolutions (ALL approved 2026-06-08)

> Do these from a session rooted in this repo. R1 needs hooks to actually fire to test.

### R1 — Fix gap #4: cwd-robust hooks + observatory  ★ do first; own ADR (0043)
**Problem:** hooks in `.claude/settings.json` + the observatory assume cwd == repo root. A session launched from elsewhere (as 2026-06-07/08 was, from `…\Internal Platform`) silently writes no event log → the observatory shows nothing and governance/claims aren't captured.
**Approach (propose in an ADR first):** resolve the Loom project root independent of cwd — walk up from the hook script's own location (or `$PWD`) for a marker (`loom-spec.md` + `constitution/kernel-v6.md` + `.claude/loom-permissions.yaml`), or honor a `LOOM_PROJECT_ROOT` env var. Update `scripts/hooks/*.mjs` (they already resolve paths — point them at the resolved root) and `observatory/server.mjs` / `config.yaml` to read the event log from the resolved root. ADR-0038 (hook-capture-gap detection) is the sibling — this is the *fix* it only *detects*.
**Test:** launch a session from a subdir and from a sibling dir; confirm `memory/event-log/<today>.jsonl` is written and the observatory renders it live.

### R2 — PS 5.1 BOM/ASCII sweep across all `.ps1`
Apply the UTF-8 BOM (or ASCII-ize) to every template `.ps1` (`bootstrap.ps1`, `deploy.ps1`, `discover*.ps1`, `doctor.ps1`, `observatory.ps1`, `hr-work-graph.ps1`, `secrets-doctor.ps1`, `skeleton-amend.ps1`, `specialist-lifecycle.ps1`, `update-bus-tick.ps1`, `validate-playbook.ps1`, `eval-subagents.ps1`) — `collect-credentials.ps1` is already done. Add a `loom doctor` soft check: flag any `.ps1` containing non-ASCII bytes without a BOM. Closes handoff gap #5 broadly. (Verify each parses with `[System.Management.Automation.Language.Parser]::ParseFile` under 5.1.)

### R3 — Generalize the keyring-ref resolver
The SF patch was a one-off because SF hand-rolled a synchronous env loader. Make this a documented template pattern: (a) the canonical async path is `scripts/lib/load-env.mjs` (`await loadEnv()` at startup); (b) provide a tiny **sync** resolver helper for projects that load env synchronously (mirror the SF `resolveKeyringRef`); (c) note it in the bootstrap scaffold + the `secrets` specialist so future projects don't re-hit the gap. Reference `sovereign-forge/src/config/index.js` as the worked example.

### R4 — Collector handles `src/`-subdir layouts
Let `collect-credentials.{ps1,sh}` target an app whose `.env.local` / `node_modules` live in a subdir (like SF's `src/`) — e.g., a `--project-dir <path>` flag or auto-detection — so the `src/scripts/lib/keyring.mjs` copy hack isn't needed. Keyring service key derives from the target dir's `package.json`.

### Plus (not base-template, but queued)
- **Anthropic key + first trading cycle:** `cd sovereign-forge/src; collect-credentials … anthropic` (keyring), then `node index.js --cycle`.
- **Commit/PR:** loom-template on branch `v0.5/credential-setup-specialist`; Sovereign Forge separately. Note the pre-existing doctor failures; offer ADR-0035/0036 status reconciliation. Gap #4 is moot once run in-repo.
- **Optional new capability:** a Playwright-based `web-automation`/scraping specialist for ToS-permitted data extraction + authorized RPA (extract→decide→act), scoped with the same guardrails (no auth-circumvention/CAPTCHA-defeat, secret hygiene, ToS-aware). Nick asked about this 2026-06-08.

---

## Note on this handoff's session
It ran from `…\Internal Platform` (not the repo), so its **mechanical** trace was not hook-captured. The **introspective** subset (6 `claim` events covering the decisions above) was emitted manually to `memory/event-log/2026-06-08.jsonl` per the CLAUDE.md claim convention, so the observatory reflects the session's decisions. Running R1 prevents this gap going forward.

## Read order for the next session
1. This file
2. `adr/0042-credential-setup-specialist.md`
3. `agents/specialists/_registry/credential-setup/SKILL.md`
4. `tools/provisioning-playbooks/alpaca.md`
5. `scripts/collect-credentials.ps1` + `sovereign-forge/src/config/index.js` (the keyring resolver pattern)
6. `adr/0038-hook-capture-gap-detection.md` (sibling to the R1 gap-#4 fix)

*Frozen snapshot 2026-06-08. credential-setup specialist (ADR-0042) shipped + validated on Alpaca paper; 4 base-template resolutions approved & pending; all work uncommitted.*
