#!/usr/bin/env bash
# gate.sh — Run quality gate on a stage's output
# Usage: bash scripts/gate.sh <stage_name> [ticket_id]
# Returns: JSON verdict to stdout

set -euo pipefail

STAGE="${1:?Usage: gate.sh <stage_name> [ticket_id]}"
TICKET_ID="${2:-}"
AUTOPILOT_DIR=".autopilot"

# ─── Determine what to judge ─────────────────────────────────────────────────

if [[ -n "$TICKET_ID" ]]; then
  OUTPUT_FILE="$AUTOPILOT_DIR/stages/developer/$TICKET_ID/output.md"
  CHECKLIST_STAGE="developer"
else
  OUTPUT_FILE="$AUTOPILOT_DIR/stages/$STAGE/output.md"
  CHECKLIST_STAGE="$STAGE"
fi

if [[ ! -f "$OUTPUT_FILE" ]]; then
  echo '{"verdict":"FAIL","score":0,"checklist":[],"blockers":["Output file not found: '"$OUTPUT_FILE"'"],"critique":"The stage produced no output file. This is a runner error, not a content error.","suggestions":[]}'
  exit 0
fi

# ─── Load checklist for this stage ───────────────────────────────────────────

get_checklist() {
  case "$CHECKLIST_STAGE" in
    analyst)
      cat <<'EOF'
- All features from brief appear as functional requirements
- Every FR has at least one acceptance criterion in Given/When/Then form
- Non-functional requirements present (at minimum: the constraints from brief)
- Out of scope section present and non-empty
- Open questions section is EMPTY (any open question is a BLOCKER)
- No invented features not in brief
- "Decisions made" section present if any brief ambiguities were resolved
EOF
      ;;
    architect)
      cat <<'EOF'
- All PRD functional requirements are addressed by the design
- File/folder structure is complete and specific (every file listed)
- API contracts have types — not just names (BLOCKER if missing)
- Error handling strategy present
- Testing strategy present
- One ADR per technology not explicitly specified in brief (BLOCKER if missing)
- No TBD, no decisions left unmade (BLOCKER)
- ADR separator "--- ADR ---" present between each ADR
EOF
      ;;
    task-breakdown)
      cat <<'EOF'
- Every FR from PRD maps to at least one ticket
- No circular dependencies between tickets
- Every ticket references specific files from the architecture
- Setup tickets (init, config) are ordered before implementation tickets
- Parallelizable tickets do not write the same file
- Ticket count is reasonable for project scope
- Each ticket has explicit acceptance criteria
EOF
      ;;
    developer)
      cat <<'EOF'
- All acceptance criteria from the specific ticket are met
- No placeholder code (TODO, "implement this", empty function bodies) — BLOCKER
- Tests present for business logic functions
- Code follows patterns from ADRs
- No imports of packages not in package.json — BLOCKER
- File(s) specified in the ticket were actually created/modified
- If a design artifact was provided: UI structure matches the artifact — no components removed or added beyond loading/error/empty states (BLOCKER if design was seeded)
EOF
      ;;
    reviewer)
      cat <<'EOF'
- Test suite exits 0 (BLOCKER if failing)
- Lint exits 0 (BLOCKER if failing)
- Definition of done from brief is satisfied (BLOCKER if not)
- No TODO comments in production code
- README or equivalent exists
EOF
      ;;
    *)
      echo "Unknown stage for checklist: $CHECKLIST_STAGE" >&2
      exit 1
      ;;
  esac
}

CHECKLIST=$(get_checklist)
BRIEF=$(cat PROJECT_BRIEF.md)
OUTPUT=$(cat "$OUTPUT_FILE")

# ─── Gate system prompt ───────────────────────────────────────────────────────

GATE_SYSTEM_PROMPT='You are a strict quality gate running in a fully automated pipeline.
Your job is to evaluate whether a stage'"'"'s output meets the standard required
to proceed to the next stage without human review.

You will receive:
- STAGE: the name of the stage being evaluated
- BRIEF: the original PROJECT_BRIEF.md
- OUTPUT_TO_JUDGE: the output produced by the stage
- CHECKLIST: the specific quality checklist for this stage

Evaluation process:
1. Go through every checklist item
2. For each: PASS, FAIL, or N/A with a one-line reason
3. Identify BLOCKERS (failures that would break downstream stages)
4. Score 1-10:
   - 10: All checklist items pass, output is excellent
   - 8-9: All blockers pass, minor issues only
   - 7: Threshold — all blockers pass, some non-blocking gaps
   - 5-6: Has blockers — do not pass
   - 1-4: Fundamental problems — major rework needed

5. If FAIL: write a critique that is:
   - SPECIFIC (reference the exact section/requirement that failed)
   - ACTIONABLE (say what needs to change, not just what is wrong)
   - SCOPED (targeted fixes, not rewrites)

Output ONLY valid JSON in this exact format (no markdown, no preamble):
{
  "verdict": "PASS" or "FAIL",
  "score": <1-10 integer>,
  "checklist": [
    {"item": "<checklist item text>", "result": "PASS" or "FAIL" or "N/A", "reason": "<one line>"}
  ],
  "blockers": ["<blocker description>"],
  "critique": "<if FAIL: specific actionable instructions. If PASS: empty string>",
  "suggestions": ["<non-blocking improvement ideas>"]
}

RULES:
- If blockers is non-empty: verdict MUST be FAIL
- If score < 7: verdict MUST be FAIL  
- Never output PASS with blockers present
- Output raw JSON only — no markdown code blocks, no preamble'

# ─── Build gate prompt ────────────────────────────────────────────────────────

GATE_PROMPT="STAGE: $STAGE"
if [[ -n "$TICKET_ID" ]]; then
  GATE_PROMPT+=" (ticket: $TICKET_ID)"
fi
GATE_PROMPT+="

BRIEF:
$BRIEF

OUTPUT_TO_JUDGE:
$OUTPUT

CHECKLIST:
$CHECKLIST"

# ─── Invoke gate ─────────────────────────────────────────────────────────────

RESULT=$(echo "$GATE_PROMPT" | claude -p "$GATE_SYSTEM_PROMPT" --dangerously-skip-permissions)

# ─── Validate JSON ────────────────────────────────────────────────────────────

if ! echo "$RESULT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  # Gate returned non-JSON — treat as a FAIL with a runner error
  echo '{"verdict":"FAIL","score":1,"checklist":[],"blockers":["Gate returned invalid JSON — model response was malformed"],"critique":"The quality gate itself produced a non-JSON response. This is a transient error. Retry the gate run.","suggestions":[]}'
  exit 0
fi

echo "$RESULT"
