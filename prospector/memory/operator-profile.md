# Operator Profile — Nick

> **Status:** CALIBRATED. Established in session **2026-08-07**. This is *input*, not something to re-derive.
> **Do not re-interview the operator on any of the below.** Re-calibrate quarterly (see README §Cadence).
> The tool reads this file at the start of every run. Edit here, not in code.

**Cognitive profile:** Visual thinker, ADD and dyslexia. **Formatting is load-bearing, not cosmetic** — tables and diagrams over prose. New concepts get a real-world analogy *before* the formal definition.

---

## Hard constraints — every opportunity must pass ALL of these

| # | Constraint | Detail |
|---|---|---|
| 1 | **Capital ≤ ~$500** | No investable capital. All capital-deployment strategies are arithmetically closed — $500 at even 50%/yr for 10 years is ~$28.8K. **Any opportunity requiring meaningful capital is an automatic reject.** |
| 2 | **Time: 15–30 hrs/week** | Sustainable, alongside a full-time job. Must not require quitting. |
| 3 | **First revenue plausible in 3–6 months** | Longer is tolerated but not preferred. Operator's stated driver: *"money fast and lots of it."* |
| 4 | **Ethical filter** | Nothing that *"negatively affects anyone else in a way that reduces their ability to succeed."* Competition is explicitly fine. |
| 5 | **Distribution must be named** | "Build it and they will come" is an automatic reject. Every brief states who buys and how they hear about it. |

*Encoded in `lib/constraint-filter.mjs`. Thresholds tunable in `config/prospector.config.json`.*

---

## Edge inventory — the strongest filter

**Core edge, stated precisely:** *Regulated industries carry crushing manual compliance workloads, and Nick knows how to automate them without triggering a regulatory event.*

| Employer | Industry | Regime |
|---|---|---|
| Harvard *(current)* | Research / higher ed | FERPA, grant compliance, IRB, effort reporting |
| Merck | Pharma | FDA, GxP, 21 CFR Part 11 |
| MassMutual | Insurance / financial | State insurance regs, SOX |
| CVS | Healthcare / pharmacy | HIPAA, DEA, board-of-pharmacy |

**This is one domain visited four times, not four domains.** Scarce because it's unglamorous and requires having survived real audits.

| Supporting edge | Evidence | Strength |
|---|---|---|
| **AI-leveraged build velocity** | Shipped a working AI YouTube clip generator in **one night** | **High** — this is what converts risk tolerance into actual shots on goal |
| **Distribution via friend** | Friend knows *"owners of companies and firms all over"* | **High but UNVALIDATED** — zero introductions attempted to date |
| **Enterprise credibility** | Four name-brand institutions | **High** — makes a stranger's proposal credible |
| Art / visual thinking | Prior career | Medium |
| Owns CT land outright | Confirmed | Not deployable; functions as a **downside floor** |

### Explicitly DISCONFIRMED — do not resurrect these

- ❌ **Gaming markets.** The v1 document claimed "strong edge." Operator confirmed this is false.
- ❌ **Real estate / crypto / equities / macro as investing plays.** No capital.

*Encoded as `DISCONFIRMED_DOMAINS` in `lib/constraint-filter.mjs`.*

---

## Other calibration

| Dimension | Value |
|---|---|
| Failure tolerance | **High** — many failed attempts acceptable; neither public failure nor long silence deters. *(Self-reported, confidence 3 — validate against behavior)* |
| Runway | Employed, costs covered. Land owned outright as floor. **Downside is well protected** |
| Preference | **Consulting over product.** Enjoys **architecting**. Loves AI and automation work |
| Involvement style | **Advise + build.** Not invest, not flip |
| Moonlighting | Harvard outside-activity rules **resolved — cleared to proceed.** No non-compete |
| ⚠️ **Open question** | Automation displaces paid work. Operator has NOT decided whether to accept engagements whose stated goal is headcount reduction. **Surface this before it arises mid-negotiation.** |

*The open question is encoded as a non-blocking `displacesHeadcount` warning flag, surfaced in every brief that triggers it — not a reject.*

---

## Scoring factors — what each means FOR THIS OPERATOR

| Factor | Weight | Reads as |
|---|---|---|
| **EdgeFit** | 0.25 | How much of the regulated-industry-automation edge does this actually use? A generic AI opportunity scores low even if it's a good business. |
| **Asymmetry** | 0.25 | Upside ÷ downside. Cheap to try, large if right. |
| **Tractability** | 0.20 | Can one person, 15–30 hrs/wk, with $500, actually start this in the next 90 days? |
| **Timing** | 0.15 | Is the window open *now*, and does something close it? |
| **DownsideProtection** | 0.15 | What survives failure — reputation, artifacts, learning, relationships. |
