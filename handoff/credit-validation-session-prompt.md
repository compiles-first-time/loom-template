# Credit Validation — Full Loom Pipeline Session Prompt

> Copy the block below and paste it into a **new Claude Code chat** opened from `C:\Users\14134\dev\loom-template`.
> Before pasting: open a separate terminal and run `scripts/observatory.ps1` so the dashboard is live.

---

## The prompt

```
This is the Loom template project (compiles-first-time/loom-template).
I am Nick, the architect. You are the builder. Local repo at
C:\Users\14134\dev\loom-template. Main is current (43 PRs merged).

BEFORE DOING ANYTHING ELSE: Read these files in this exact order, then
give me a status summary. Do not generate code or proposals until you
have read all of them.

1. handoff/2026-06-04-observatory-context.md
2. handoff/2026-05-20-loom-v1.0-context.md
3. CLAUDE.md
4. constitution/local-rules.md
5. layers/L9-observatory.md

THE PROJECT:
I have a Credit Validation automation at:
C:\Users\14134\Downloads\Credit Validation Requirements and Exceptions.xlsx

This xlsx follows Loom's failure-modes register format (ADR-0022): ID, Type
(SE/BE), Framework Location, Usecase, Assets/Cred, Input Source, Expected
Input, Expected Output, Input Format, Output Format, Next Step, Justifications.

It defines 4 business rules:
- BR-01: Retrieve + validate credit/debit file from VYA (FIS/Mastercard)
- BR-02: Validate a sample of rows against PaymentsOne ServiceView
- BR-03: Email discrepancies to Marketing and FIS
- BR-04: Completion notification email

With reusable components (login, email with O365→SMTP→Outlook fallback),
system exceptions (SE), business exceptions (BE), and technical requirements.

WHAT I WANT:
Run the FULL Loom pipeline on this project — end to end:

1. Discovery (scripts/discover.sh --quick, then full flow) — produce
   requirements.md, risk-register.md, open-questions.md from the xlsx.
2. Work graph (scripts/hr-work-graph.sh) — generate the work-graph.json
   and task-ledger.md from the requirements.
3. Specialist dispatch — let HR identify which specialists to spawn for
   each work item. Use ADR-0034 path 2b (simulation via Agent tool) since
   the registry loaded at session start.
4. Build — implement the automation. Tech stack: Node.js (not UiPath).
   This is a Loom-governed build, not a UiPath Studio build.
5. Deploy — run through scripts/deploy.sh when ready.

The observatory is running at http://127.0.0.1:4040 — I am watching it.
Hooks should be firing for this session since you launched from the project
root. If they are not, flag it immediately per ADR-0038.

IMPORTANT CONSTRAINTS:
- Flag disagreements before building, not after.
- Constitution-as-text: never auto-apply structural changes.
- Provenance tags [source][confidence] on every non-trivial claim.
- Token-cost awareness (LR-06): estimate cost before multi-agent ops.
- Do NOT start building until I approve the plan. Discovery first.
```

---

## What Nick should validate at each phase

### Phase 1: Discovery
**What to watch for:**
- Does the builder read the xlsx and extract all 4 BRs, all SEs, all BEs?
- Does the risk register capture the credential risks (FIS service account, PaymentsOne service account, O365 App ID/Secret)?
- Does it identify the email fallback chain (Graph API → SMTP → Outlook) as an architectural decision worth tracking?
- Does it flag open questions (missing email addresses marked with **need email** in the xlsx)?

**Observatory check:** Overview panel should show an active session. Tool calls should increment as discovery runs. No errors expected at this phase.

**Red flags:** If the builder skips discovery and jumps to coding, stop it — that's the Ravenwise failure mode (Root cause 1 from ADR-0034).

### Phase 2: Work Graph
**What to watch for:**
- Work items should map to the 4 BRs + reusable components.
- Dependencies should be captured (BR-02 depends on BR-01's DataTable output; BR-03 depends on BR-02's discrepancy list).
- The graph should NOT be a flat list — it should have a DAG structure.

**Observatory check:** Tasks panel should populate with work items. If it shows the placeholder ("No work graph generated yet"), the work-graph.json file wasn't created or isn't being watched.

### Phase 3: Specialist Dispatch
**What to watch for:**
- Which specialists does HR propose? Expected: auth (FIS + PaymentsOne logins), email (notification component), secrets (credential management), error-tracking (SE/BE classification).
- Does the builder use ADR-0034 path 2b (Agent tool with SKILL.md content) for specialist simulation?
- Does it estimate token cost (LR-06) before spawning?

**Observatory check:** Agents panel should show specialists spawning. Cost panel should show token estimates. If the builder spawns without estimating cost, that's an LR-06 violation — flag it.

### Phase 4: Build
**What to watch for:**
- Does the Node.js implementation match the xlsx's data flow? (email → parse → download → validate → sample → compare → report)
- Does it handle all SE and BE cases from the xlsx?
- Are credentials managed through Loom's keyring path (ADR-0036), not hardcoded?
- Does it emit claim events for non-trivial architectural decisions?

**Observatory check:** This is where the dashboard earns its keep. Watch for:
- Error rate on the Failures panel — spikes mean build issues.
- Compliance panel — any constitution check failures or destructive ops.
- Active sessions showing steady tool call progression.

### Phase 5: Deploy
**What to watch for:**
- Does `scripts/deploy.sh` pass the discovery gate (Step 0)?
- If the risk register has unmitigated HIGH risks, deploy should block.

**Observatory check:** Deploys panel should show the deploy attempt and its terminal state (succeeded/failed/non_progressing per ADR-0032).

### Throughout: What the observatory should look like
- **Status indicator:** Green "live" dot in the header = SSE is connected.
- **Overview cards:** Should show non-zero values as the session progresses.
- **Cost panel:** Token spend accumulates across the session.
- **Failures panel:** Ideally stays at 0 errors; if errors spike, the build has issues.
- **Theme toggle:** ☽/☀ button in the header switches dark/light mode.

### What to do if something breaks
1. **Hooks not firing:** Check that Claude Code was launched FROM `C:\Users\14134\dev\loom-template`, not from another directory. If CWD mismatch, restart Claude Code from the project root.
2. **Observatory not updating:** Refresh the browser. If still stale, check that the JSONL event log at `memory/event-log/YYYY-MM-DD.jsonl` has new entries.
3. **Builder skips a phase:** Stop it. Say "stop — you skipped [phase]. Go back to [phase] and complete it before proceeding."
4. **Builder doesn't flag disagreements:** That's a collaboration model violation. The handoff doc is explicit about this. Remind it.
