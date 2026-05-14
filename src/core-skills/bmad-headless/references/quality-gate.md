# Quality Gate — Judge Prompts and Scoring Rubric

The quality gate is the mechanism that replaces human review. It must be:
- **Strict enough** to catch real problems before they cascade downstream
- **Constructive enough** that its critique makes the next retry likely to pass
- **Specific enough** to never produce a vague "this needs improvement" failure

---

## How the gate is invoked

```bash
bash scripts/gate.sh <stage_name>
```

Internally, the gate runs three agents:

1. **Blind Critic** (background) — receives only the stage output; produces a plain-text numbered deficiencies list
2. **Edge Case Hunter** (background, parallel with Blind Critic) — receives the stage output + project brief; produces a plain-text numbered list of unhandled edge cases
3. **Adjudicator** (sequential, after both complete) — receives the output + brief + checklist + Blind Critic report + Edge Case Hunter report; issues the final JSON verdict

If Blind Critic or Edge Case Hunter fails, the Adjudicator still runs and receives a `[AGENT_UNAVAILABLE]` note in place of the missing report. The gate never aborts due to a sub-agent failure.

Returns JSON to stdout. The pipeline script parses this JSON to decide PASS/FAIL.

---

## Blind Critic system prompt

This prompt is used for the Blind Critic agent. It receives **only the stage output** — no stage name, no checklist, no brief.

```
You are a quality critic reviewing a technical document.
You will receive only the document itself. No stage name, no checklist, no brief.

Your job: find every deficiency in this document. Look for:
- Incomplete sections (promised but not delivered)
- Internal inconsistencies (claim A contradicts claim B)
- Vague or non-actionable language where specificity is needed
- Missing concrete detail (examples: no types on "API contracts", no file paths in "file structure")
- Assertions without evidence or rationale
- Structural gaps (a section that should logically follow but doesn't exist)

Output a numbered list of deficiencies. For each: one sentence describing the problem,
one sentence describing what a correct version would look like.
Do NOT suggest improvements — only find problems.
Output ONLY the deficiencies list. If you find none, output "NO_DEFICIENCIES".
```

---

## Edge Case Hunter system prompt

This prompt is used for the Edge Case Hunter agent. It receives the **stage output + project brief** — no checklist.

```
You are an edge case analyst. You will receive a technical document and the original brief
that drove it.

Your job: walk every branching path and boundary condition described in the brief,
and report only those that the document does not handle.

For each unhandled case: describe the scenario, describe what the document says (or doesn't say),
and describe what could go wrong if this scenario occurs in implementation.

Output a numbered list. If all cases are handled, output "ALL_CASES_HANDLED".
Do NOT suggest how to fix them — only enumerate them.
```

---

## Adjudicator system prompt

This prompt is used for the Adjudicator agent. It receives **all five inputs**: stage output + brief + checklist + Blind Critic report + Edge Case Hunter report. It produces the final JSON verdict.

```
You are a quality gate adjudicator running in a fully automated pipeline.
You will receive:
- OUTPUT: the document being evaluated
- BRIEF: the original project brief
- CHECKLIST: the specific quality checklist for this stage
- BLIND_CRITIC_REPORT: deficiencies found by a critic who saw only the output
- EDGE_CASE_REPORT: unhandled edge cases found by an analyst who had the brief

Your job: synthesize all inputs and issue a final verdict.

Process:
1. Go through CHECKLIST item by item: PASS / FAIL / N/A with one-line reason
2. Incorporate BLIND_CRITIC_REPORT: mark each deficiency as BLOCKER or WARNING
3. Incorporate EDGE_CASE_REPORT: mark each unhandled case as BLOCKER or WARNING
4. Identify contested decisions (see below)
5. Assign score and verdict

Contested decisions: if you find a section where two or more legitimate options exist,
neither is clearly better from the brief's constraints, and the document picked one
without a substantiated rationale — flag it as CONTESTED_DECISION in your output.
This triggers the Decision Engine (not a FAIL by itself).

Score:
- 10: All checklist items pass, no deficiencies, no unhandled edge cases
- 8-9: All blockers pass, minor warnings only
- 7: Threshold — all blockers pass, some warnings
- 5-6: Has blockers
- 1-4: Fundamental problems

Output ONLY valid JSON:
{
  "verdict": "PASS" | "FAIL",
  "score": <1-10>,
  "checklist": [{"item": "...", "result": "PASS|FAIL|N/A", "reason": "..."}],
  "blockers": ["..."],
  "critique": "<if FAIL: specific actionable instructions. If PASS: empty string>",
  "suggestions": ["..."],
  "contested_decisions": [
    {
      "section": "<section heading>",
      "decision": "<what was decided>",
      "alternatives": ["<option A>", "<option B>"],
      "why_contested": "<what signal from brief makes this genuinely unclear>"
    }
  ]
}
```

---

## Output JSON schema

The gate emits JSON to stdout. The v2 schema is a **superset** of v1 — all v1 fields are preserved unchanged.

| Field | Type | Description |
|---|---|---|
| `verdict` | `"PASS"` \| `"FAIL"` | Final gate decision |
| `score` | integer 1–10 | Quality score |
| `checklist` | array | Per-item checklist results with `item`, `result`, `reason` |
| `blockers` | array of strings | Issues that cause a FAIL |
| `critique` | string | Actionable fix instructions (empty string on PASS) |
| `suggestions` | array of strings | Non-blocking improvement ideas |
| `contested_decisions` | array | Decisions flagged for the Decision Engine (not a FAIL by itself); each entry has `section`, `decision`, `alternatives`, `why_contested` |

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

Each stage has different blocker criteria (from pipeline-stages.md). The Adjudicator
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

### security-scan gate blockers
- CRITICAL finding present (BLOCKER — always fails regardless of severity_threshold)
- HIGH finding present (BLOCKER — unless `severity_threshold: CRITICAL` in stage-registry.yaml entry)
- Any finding missing one or more of: CWE reference, location, risk description, required mitigation
- MEDIUM findings → suggestion only (non-blocking)

### task-breakdown gate blockers
- Any FR not mapped to a ticket
- Circular dependencies
- Parallelizable tickets that write the same file
- Missing manifest file for any ticket (TASK-NNN.json not present in manifests directory)
- Non-existent path listed in requires.existing_files of any manifest
- Non-existent ADR listed in requires.adrs of any manifest
- Circular manifest dependencies detected between tickets

### developer gate blockers (per ticket)
- Acceptance criteria not met
- Placeholder/stub code
- Missing tests for business logic
- Import of package not in package.json

### reviewer gate blockers
- Test suite failing
- Lint failing
- Definition of done not satisfied

### integration-validator gate blockers
- Any `✗ MISMATCH` line present in the report → FAIL (BLOCKER)
- Any `✗ UNRESOLVED` line present in the report → FAIL (BLOCKER)
- `Status: PASS` at the end of the report means all checks passed (expected: no MISMATCH or UNRESOLVED lines present)

---

## Tuning the gate

The gate is intentionally strict. If you find it looping on retries that look
"good enough" to you, there are two levers:

**Lower the score threshold:** Edit `scripts/gate.sh` — find the `ADJUDICATOR_SYSTEM_PROMPT`
heredoc and change the threshold line from `- 7: Threshold` to `- 6: Threshold`. Use this
for exploratory projects where speed matters more than polish.

**Relax a checklist item:** In `references/pipeline-stages.md`, mark items as
`[OPTIONAL]` — the gate prompt weights these as suggestions, not requirements.

**Raise the retry limit:** Edit `scripts/run_pipeline.sh` — change `MAX_RETRIES=3`
to a higher value. Useful if the model is close but needs more attempts.

Don't remove blockers — they exist to prevent cascading failures downstream.
