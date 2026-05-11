# PIPELINE_STATE.json — Schema

The state file is the pipeline's memory. Since each `claude -p` call is
stateless, this file is the only thing that persists between invocations.
Never skip writing it after a PASS.

---

## Location

`.autopilot/PIPELINE_STATE.json`

The `.autopilot/` directory is created on `init`. It should be in `.gitignore`
unless you want to commit pipeline runs (which can be useful for debugging).

---

## Full schema

```json
{
  "version": "1",
  "project": "<name from brief>",
  "brief_path": "PROJECT_BRIEF.md",
  "brief_hash": "<md5 of brief at pipeline start — used to detect modifications>",
  "started_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>",

  "current_stage": "analyst | architect | task-breakdown | developer | reviewer | complete | escalated",

  "stages": {
    "analyst": {
      "status": "pending | running | passed | failed | escalated",
      "attempts": 0,
      "score": null,
      "passed_at": null,
      "output_path": ".autopilot/stages/analyst/output.md",
      "critiques": []
    },
    "architect": {
      "status": "pending",
      "attempts": 0,
      "score": null,
      "passed_at": null,
      "output_path": ".autopilot/stages/architect/output.md",
      "adr_dir": ".autopilot/stages/architect/ADRs/",
      "critiques": []
    },
    "task-breakdown": {
      "status": "pending",
      "attempts": 0,
      "score": null,
      "passed_at": null,
      "output_path": ".autopilot/stages/task-breakdown/output.md",
      "ticket_count": null,
      "critiques": []
    },
    "developer": {
      "status": "pending",
      "attempts": 0,
      "score": null,
      "passed_at": null,
      "tickets": {
        "TASK-001": {
          "status": "pending | running | passed | failed | escalated",
          "attempts": 0,
          "score": null,
          "critiques": []
        }
      }
    },
    "reviewer": {
      "status": "pending",
      "attempts": 0,
      "score": null,
      "passed_at": null,
      "output_path": ".autopilot/stages/reviewer/output.md",
      "critiques": []
    }
  },

  "escalations": [],
  "total_retries": 0,
  "total_duration_seconds": null
}
```

---

## Status transitions

```
pending → running → passed
                  → failed → running (retry) → passed
                                             → failed → running (retry 2) → passed
                                                                          → failed → escalated
```

Once a stage reaches `passed`, it never runs again (even on resume).
Once a stage reaches `escalated`, the pipeline halts until the user resolves it.

---

## Operations

All state operations go through `scripts/update_state.py`.

### Initialize
```bash
python3 scripts/update_state.py init PROJECT_BRIEF.md
```
Creates `.autopilot/PIPELINE_STATE.json` with all stages as `pending`.
Computes and stores `brief_hash`. Errors if brief fails validation.

### Mark stage running
```bash
python3 scripts/update_state.py start <stage>
```

### Record gate result
```bash
python3 scripts/update_state.py gate <stage> <verdict> <score> [<critique>]
```
On PASS: sets status to `passed`, records score, updates `current_stage`.
On FAIL: increments attempts, appends critique, sets status back to `pending`.
On FAIL with attempts = MAX_RETRIES: sets status to `escalated`.

### Record ticket result (developer stage)
```bash
python3 scripts/update_state.py ticket <ticket-id> <verdict> <score> [<critique>]
```

### Show status
```bash
python3 scripts/update_state.py status
```
Prints a human-readable summary:
```
BMAD Autopilot — Invoice CLI
Started: 2025-01-15 14:32 UTC

✓ analyst       score 8/10    0 retries    14s
✓ architect     score 9/10    1 retry      31s
↻ task-breakdown              attempt 2/3
  pending  developer
  pending  reviewer
```

---

## Brief hash

The brief hash is checked on resume. If `PROJECT_BRIEF.md` has been modified
since the run started (e.g. user updated it to resolve an escalation), the
pipeline detects this and re-runs stages that depend on changed sections.

Currently this is a simple full-file hash — if it changed, all pending stages
are re-evaluated from the current_stage. Passed stages are not re-run unless
their direct inputs changed. (This is conservative — future improvement:
semantic diffing to only invalidate truly affected stages.)

---

## Escalation log

Each escalation appends to `stages[stage].critiques` and also to the top-level
`escalations` array:

```json
{
  "escalations": [
    {
      "stage": "architect",
      "ticket": null,
      "attempt": 3,
      "timestamp": "<ISO 8601>",
      "critique_history": ["...", "...", "..."],
      "escalation_path": ".autopilot/ESCALATION.md"
    }
  ]
}
```

This makes it easy to look back at what caused escalations across a run.
