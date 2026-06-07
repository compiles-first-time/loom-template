# Loom collaboration handoff — 2026-06-07 (Credential Agent + Sovereign Forge)

> Successor to [`handoff/2026-06-04-observatory-context.md`](./2026-06-04-observatory-context.md).

---

## TL;DR

```
This is the Loom template project (compiles-first-time/loom-template).
I am Nick, the architect. You are the builder.

Two items from the 2026-06-07 session:

1. NEW FEATURE REQUEST: A credential-setup agent/specialist that handles
   account registration, login, 2FA, and API key retrieval using browser
   automation — with explicit user consent. Extends ADR-0036 + auth/oauth.
   Constitutional guardrails: LR-04 consent, LR-03 secrets-not-in-logs.

2. SOVEREIGN FORGE (C:\Users\14134\dev\sovereign-forge) — a real project
   built with Loom's pipeline as a validation exercise. It's the test bed
   for the credential-setup agent (first test: register for Alpaca paper
   trading API keys).

Full context: C:\Users\14134\dev\sovereign-forge\handoff\2026-06-07-sovereign-forge-genesis.md

Read that file + the standard Loom handoff chain before proposing anything.
```

---

## What changed since 2026-06-04

### Sovereign Forge (new project, separate repo)

- **Repo:** github.com/compiles-first-time/sovereign-forge (private)
- **Local:** C:\Users\14134\dev\sovereign-forge
- Created from loom-template via `gh repo create --template`
- Bootstrapped and stamped as "Sovereign Forge"
- Ran full Loom SDLC pipeline (Discovery → Work Graph → Specialist Dispatch → Build → Deploy gate)
- MVP built: 8 source files, SQLite, 5 AI trading agents, 2 portfolios, $1K paper capital
- Needs Alpaca + Anthropic API keys to run first trading cycle

### 5 Loom pipeline gaps identified

These are findings from running the pipeline on a real project:

1. ADR-0022 (xlsx failure-modes format) doesn't feed into ADR-0029 (work-graph input format)
2. Risk register parser expects 13-column ADR-0022 format; natural risk assessment has fewer columns
3. No specialist registry match for novel domains (investment, trading, agent lifecycle)
4. CWD dependency for hooks/observatory = silent degradation from wrong directory
5. Bootstrap script em dashes cause PowerShell 5.1 parse errors

### Credential-setup agent (new feature request)

Nick wants Loom to have a specialist that handles the full credential lifecycle:
- Register for API keys on services (navigating web UIs)
- Create accounts
- Log in / sign in
- Handle 2FA (email codes, SMS codes, authenticator)
- Store credentials in OS keyring
- All with explicit user consent at each step

**Design mapping:**
- New specialist: `agents/specialists/_registry/credential-setup/SKILL.md`
- Browser automation via Claude in Chrome MCP
- Extends: `provisioning` (ADR-0036), `auth`, `oauth`
- Constitutional: LR-04 (consent per action), LR-03 (secrets never in logs), Kernel Rule 8 (anti-paternalism)

**First test:** Register for Alpaca paper trading API keys for Sovereign Forge.

---

## What's next

1. Build the credential-setup specialist in loom-template (ADR + SKILL.md + implementation)
2. Test on Sovereign Forge (Alpaca registration)
3. Fix the 5 pipeline gaps identified above
4. Run Sovereign Forge's first live trading cycle

---

*Frozen snapshot 2026-06-07. Loom at v0.3.4 on main (43 PRs merged). Sovereign Forge at v0.1.0 MVP.*
