---
name: headless-bmad
description: >
  Fully autonomous BMAD-v6 pipeline with zero human-in-the-loop after ideation.
  Use this skill whenever the user wants to run multiple BMAD stages automatically,
  says "run headless", "run autopilot", "start the pipeline", "automate this", or
  hands you a PROJECT_BRIEF.md and wants it executed end-to-end. Also triggers for
  "chain the BMAD skills", "run without me", or "just build it".
  This skill replaces every human approval node with a self-correcting quality gate.
---

# BMAD Autopilot

Autonomous BMAD-v6 pipeline. Human provides the brief once — Claude drives everything
from there: analyst → architect → task breakdown → implementation, with automated
quality gates that self-correct before proceeding.

---

## First: detect mode, then load reference files

Check `PROJECT_BRIEF.md` for `mode: brownfield` before loading references.

**If greenfield (default):** read in order:
1. `references/brief-schema.md`
2. `references/pipeline-stages.md`
3. `references/quality-gate.md`
4. `references/state-schema.md`

**If brownfield:** read in order:
1. `references/brief-schema.md`
2. `references/brownfield.md` ← **read this before pipeline-stages**
3. `references/pipeline-stages.md` (brownfield.md overrides stages where noted)
4. `references/quality-gate.md`
5. `references/state-schema.md`

Brownfield mode changes the stage sequence, all stage prompts, and the brief
validation rules. `references/brownfield.md` is the authoritative reference for
all of those changes.

---

## Entry points

### Starting fresh

User provides a PROJECT_BRIEF.md (or you just created one from ideation):

```bash
# 1. Validate the brief is rich enough to run unattended
python3 scripts/validate_brief.py PROJECT_BRIEF.md

# 2. Initialize pipeline state
python3 scripts/update_state.py init PROJECT_BRIEF.md

# 3. Start the loop
bash scripts/run_pipeline.sh
```

### Resuming an interrupted run

State file exists at `.autopilot/PIPELINE_STATE.json`:

```bash
python3 scripts/update_state.py status   # show where we are
bash scripts/run_pipeline.sh             # continues from last passing stage
```

---

## Stage sequences by mode

**Greenfield:** `analyst → architect → task-breakdown → developer → reviewer`

**Brownfield:** `context-ingestion → analyst → architect → task-breakdown → developer → reviewer`

The mode is read from `PIPELINE_STATE.json` after init. All scripts handle both.

---

## The main loop (what run_pipeline.sh does)

For each pending stage (in order from pipeline-stages.md):

```
LOOP:
  1. Construct stage prompt (brief + state + stage system prompt)
  2. Run: bash scripts/run_stage.sh <stage>
     → output lands in .autopilot/stages/<stage>/output.md
  3. Run: bash scripts/gate.sh <stage>
     → returns JSON: {verdict, score, critique, blockers[]}
  4a. PASS (score ≥ 7): update state → next stage
  4b. FAIL (score < 7, retries < 3):
        - write critique to .autopilot/stages/<stage>/critique_<N>.md
        - re-run stage with critique appended to context
        - increment retry counter
  4c. FAIL (retries = 3):
        - write .autopilot/ESCALATION.md (see below)
        - STOP — surface to user with full context
```

**Never go silent for more than 3 minutes.** Print a status line between stages:
```
[Autopilot] ✓ analyst (score 8/10) → starting architect...
[Autopilot] ↻ architect retry 2/3 — critique: missing ADR for auth approach
[Autopilot] ✓ architect (score 9/10) → starting task-breakdown...
```

---

## Running a stage

```bash
bash scripts/run_stage.sh <stage_name>
```

The script:
- Reads the stage's system prompt from `references/pipeline-stages.md`
- Appends: current PROJECT_BRIEF.md, PIPELINE_STATE.json, any critiques from
  previous failed attempts at this stage
- Invokes `claude -p` in non-interactive mode
- Writes output to `.autopilot/stages/<stage_name>/output.md`

If the stage involves parallel work (e.g. implementing multiple tickets), the
script spawns subprocesses — one `claude -p` per ticket — and waits for all to
complete before running the gate.

---

## Running a quality gate

```bash
bash scripts/gate.sh <stage_name>
```

Returns JSON to stdout:
```json
{
  "verdict": "PASS",
  "score": 8,
  "critique": "...",
  "blockers": [],
  "suggestions": ["Consider adding rate-limit handling to the API spec"]
}
```

The gate prompt is in `references/quality-gate.md`. It is strict but constructive —
it produces critiques specific enough that a retry using them is likely to pass.

A PASS does not require perfection (score = 10). It requires:
- Score ≥ 7
- Zero blockers (blockers = things that would break downstream stages)

---

## Escalation

When a stage fails 3 times, write `.autopilot/ESCALATION.md`:

```markdown
# Escalation required — <stage_name>

## What happened
<stage> failed quality gates 3 times. The pipeline cannot proceed automatically.

## Critiques (all 3 attempts)
<paste all three critique texts>

## What you need to decide
<specific question — e.g. "The architect stage can't resolve the auth approach.
The brief says 'use existing auth' but no existing system is described.
Options: (a) JWT from scratch, (b) OAuth via provider — which?">

## To resume
Answer the question above, then update PROJECT_BRIEF.md with the clarification.
Run: bash scripts/run_pipeline.sh
The pipeline will retry <stage> with your update included.
```

Then surface this file to the user and stop.

---

## Deliverables assembly

After all stages pass, run:

```bash
python3 scripts/assemble.py
```

This collects outputs from all stages into `.autopilot/DELIVERABLES/`:
- `PRD.md` (from analyst)
- `ARCHITECTURE.md` + `ADRs/` (from architect)
- `TASKS.md` (from task-breakdown)
- `src/` (from developer)
- `tests/` (from developer)
- `PIPELINE_REPORT.md` — scores, retries, total time per stage

---

## Design principles

**Critiques are the mechanism.** The quality gate doesn't just say PASS/FAIL — it
produces a specific, actionable critique that the next attempt uses as a second system
prompt. "The PRD lacks acceptance criteria for error states" is actionable.
"This is bad" is not. Read quality-gate.md carefully.

**The brief is ground truth.** Every stage prompt, every gate judgement, references
the brief. If the brief is vague on a point, the gate will flag it and the escalation
will ask about exactly that point. This is by design — it surfaces ambiguity that
would otherwise become a bug.

**State is load-bearing.** Each `claude -p` call is stateless. PIPELINE_STATE.json is
the memory of the pipeline. Never skip writing state after a PASS.

**Parallelism is safe after task-breakdown.** Before that, stages are sequential
(each feeds the next). After task-breakdown, each ticket is independent and can run
in parallel subprocesses. The developer stage does this automatically.
