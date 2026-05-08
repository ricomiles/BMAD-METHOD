# Quality Gate — Judge Prompt and Scoring Rubric

The quality gate is the mechanism that replaces human review. It must be:
- **Strict enough** to catch real problems before they cascade downstream
- **Constructive enough** that its critique makes the next retry likely to pass
- **Specific enough** to never produce a vague "this needs improvement" failure

---

## How the gate is invoked

```bash
bash scripts/gate.sh <stage_name>
```

Internally, this runs:
```
claude -p "<GATE_SYSTEM_PROMPT>" \
  --context "STAGE: <stage_name>" \
  --context "BRIEF: $(cat PROJECT_BRIEF.md)" \
  --context "OUTPUT_TO_JUDGE: $(cat .autopilot/stages/<stage>/output.md)" \
  --context "CHECKLIST: $(stage_checklist_from_pipeline-stages.md)"
```

Returns JSON to stdout. The pipeline script parses this JSON to decide PASS/FAIL.

---

## Gate system prompt

This is the exact system prompt passed to `claude -p` when running a gate:

```
You are a strict quality gate running in a fully automated pipeline.
Your job is to evaluate whether a stage's output meets the standard required
to proceed to the next stage without human review.

You will receive:
- STAGE: the name of the stage being evaluated
- BRIEF: the original PROJECT_BRIEF.md
- OUTPUT_TO_JUDGE: the output produced by the stage
- CHECKLIST: the specific quality checklist for this stage

Your evaluation process:
1. Go through every item in the CHECKLIST
2. For each item: PASS, FAIL, or N/A with a one-line reason
3. Identify BLOCKERS — failures that would cause a downstream stage to fail
   (e.g. missing acceptance criteria in the PRD would break the developer stage)
4. Assign a score 1-10 based on:
   - 10: All checklist items pass, output is excellent
   - 8-9: All blockers pass, minor issues only
   - 7: Passes threshold — all blockers pass, some non-blocking gaps
   - 5-6: Has blockers — do not pass
   - 1-4: Fundamental problems — major rework needed

5. If FAIL: write a critique that is:
   - SPECIFIC (reference the exact section/requirement that failed)
   - ACTIONABLE (say what needs to change, not just what's wrong)
   - SCOPED (don't ask for rewrites — ask for targeted fixes)

Output ONLY valid JSON in this exact format:
{
  "verdict": "PASS" | "FAIL",
  "score": <1-10>,
  "checklist": [
    {"item": "<checklist item text>", "result": "PASS" | "FAIL" | "N/A", "reason": "<one line>"},
    ...
  ],
  "blockers": ["<description of blocker>", ...],
  "critique": "<if FAIL: specific actionable instructions for the next attempt. If PASS: empty string>",
  "suggestions": ["<non-blocking improvement ideas — passed to next stage as context>"]
}

IMPORTANT: Your verdict must match your blockers list.
- If blockers is non-empty: verdict must be FAIL
- If score < 7: verdict must be FAIL
- Never output PASS with blockers present
```

---

## Scoring rubric

### What makes a score drop

| Issue | Score impact |
|---|---|
| Open question left unanswered | -3 (blocker) |
| Missing acceptance criteria for a requirement | -2 (blocker) |
| Feature in brief not addressed by output | -2 (blocker) |
| Placeholder content ("TBD", "TODO") | -2 (blocker) |
| Invented feature not in brief | -1 (warning) |
| Missing a non-functional requirement | -1 to -2 |
| Inconsistency within the output | -1 |
| Missing optional but useful content | -0.5 |

### What makes a critique good vs bad

**Bad critique (vague, unactionable):**
> "The PRD doesn't have enough detail. Please expand the requirements section."

**Good critique (specific, actionable):**
> "FR-003 (PDF generation) is missing an acceptance criterion for the error case
> where the template file doesn't exist. Add a Given/When/Then for that case.
> Also, the Non-functional requirements section doesn't address the constraint
> from the brief: 'Output PDF must be < 500KB'. Add an NFR for this."

A good critique tells the stage exactly what to fix in the next attempt, in a
way that the stage can act on without further input.

---

## Retry context

When a stage is retried after a FAIL, the gate's critique is prepended to the
stage's system prompt:

```
PREVIOUS ATTEMPT FAILED. You must address all of the following before outputting:

<critique text>

---

Original task:
<original stage system prompt>
```

This ensures the retry is not a blind re-run — it has specific instructions for
what to fix.

---

## Gate configuration per stage

Each stage has different blocker criteria (from pipeline-stages.md). The gate
system prompt is the same; what changes is the CHECKLIST passed in.

Summary of hard blockers per stage:

### analyst gate blockers
- Open questions present
- Any FR missing acceptance criteria
- Feature in brief not in PRD

### architect gate blockers
- Any FR not addressed by architecture
- File/folder structure incomplete or ambiguous
- Technology decisions without ADRs
- Any "TBD" in the output

### task-breakdown gate blockers
- Any FR not mapped to a ticket
- Circular dependencies
- Parallelizable tickets that write the same file

### developer gate blockers (per ticket)
- Acceptance criteria not met
- Placeholder/stub code
- Missing tests for business logic
- Import of package not in package.json

### reviewer gate blockers
- Test suite failing
- Lint failing
- Definition of done not satisfied

---

## Tuning the gate

The gate is intentionally strict. If you find it looping on retries that look
"good enough" to you, there are two levers:

**Lower the score threshold:** Edit `scripts/gate.sh` — change the pass threshold
from 7 to 6. Use this for exploratory projects where speed matters more than polish.

**Relax a checklist item:** In `references/pipeline-stages.md`, mark items as
`[OPTIONAL]` — the gate prompt weights these as suggestions, not requirements.

**Raise the retry limit:** Edit `scripts/run_pipeline.sh` — change `MAX_RETRIES=3`
to a higher value. Useful if the model is close but needs more attempts.

Don't remove blockers — they exist to prevent cascading failures downstream.
