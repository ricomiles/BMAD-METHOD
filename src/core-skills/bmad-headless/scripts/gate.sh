#!/usr/bin/env bash
# gate.sh — Run quality gate on a stage's output (3-agent adversarial ensemble)
# Usage: bash scripts/gate.sh <stage_name> [ticket_id]
# Returns: JSON verdict to stdout

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

STAGE="${1:?Usage: gate.sh <stage_name> [ticket_id]}"
TICKET_ID="${2:-}"
AUTOPILOT_DIR=".autopilot"

# ─── Temp dir with cleanup trap ───────────────────────────────────────────────

TMPDIR_GATE=$(mktemp -d)
[[ -n "$TMPDIR_GATE" ]] || { echo "gate.sh: mktemp failed — cannot create temp dir" >&2; exit 1; }
trap 'rm -rf "$TMPDIR_GATE"' EXIT

# ─── Determine what to judge ─────────────────────────────────────────────────

if [[ -n "$TICKET_ID" ]]; then
  OUTPUT_FILE="$AUTOPILOT_DIR/stages/developer/$TICKET_ID/output.md"
  CHECKLIST_STAGE="developer"
else
  OUTPUT_FILE="$AUTOPILOT_DIR/stages/$STAGE/output.md"
  CHECKLIST_STAGE="$STAGE"
fi

if [[ ! -f "$OUTPUT_FILE" ]]; then
  echo '{"verdict":"FAIL","score":0,"checklist":[],"blockers":["Output file not found: '"$OUTPUT_FILE"'"],"critique":"The stage produced no output file. This is a runner error, not a content error.","suggestions":[],"contested_decisions":[]}'
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
- Every ticket has a manifest file at .autopilot/stages/task-breakdown/manifests/TASK-NNN.json — BLOCKER if any ticket is missing one
- All paths in requires.existing_files of every manifest exist in the repository — BLOCKER if any path is absent
- All ADRs in requires.adrs of every manifest exist in the ADR directory — BLOCKER if any ADR is missing
- No circular manifest dependencies (TASK-A's requires references TASK-B's provides.new_files and TASK-B's requires references TASK-A's provides.new_files) — BLOCKER if circular dependency found
- provides.exports for each ticket is sufficient to satisfy all downstream_contracts that reference that ticket — BLOCKER if signature mismatch found
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
    security-scan)
      local severity_threshold
      severity_threshold=$(python3 -c "
import re
try:
    txt = open('${SKILL_DIR}/references/stage-registry.yaml').read()
    m = re.search(r'id: security-scan.*?severity_threshold:\s*(\S+)', txt, re.DOTALL)
    print(m.group(1) if m else 'HIGH')
except Exception:
    print('HIGH')
" 2>/dev/null || echo "HIGH")
      if [[ "$severity_threshold" == "CRITICAL" ]]; then
        cat <<'EOF'
- CRITICAL finding present → FAIL (BLOCKER)
- HIGH findings present → WARNING only (severity_threshold is CRITICAL; HIGH is non-blocking)
- MEDIUM findings → suggestion only (non-blocking)
- Each finding must include: CWE reference, location, risk description, required mitigation — BLOCKER if any finding is missing one of these fields
- "Required before task-breakdown" section present listing all CRITICAL findings
EOF
      else
        cat <<'EOF'
- CRITICAL finding present → FAIL (BLOCKER)
- HIGH finding present → FAIL (BLOCKER)
- MEDIUM findings → suggestion only (non-blocking)
- Each finding must include: CWE reference, location, risk description, required mitigation — BLOCKER if any finding is missing one of these fields
- "Required before task-breakdown" section present listing all CRITICAL and HIGH findings
EOF
      fi
      ;;
    *)
      echo "Unknown stage for checklist: $CHECKLIST_STAGE" >&2
      exit 1
      ;;
  esac
}

CHECKLIST=$(get_checklist)
if [[ ! -f "PROJECT_BRIEF.md" ]]; then
  echo '{"verdict":"FAIL","score":0,"checklist":[],"blockers":["PROJECT_BRIEF.md not found in working directory"],"critique":"The gate cannot run without a project brief. Ensure gate.sh is invoked from the project root.","suggestions":[],"contested_decisions":[]}'
  exit 0
fi
BRIEF=$(cat PROJECT_BRIEF.md)
OUTPUT=$(cat "$OUTPUT_FILE")

# ─── For task-breakdown: append manifest contents to output for Adjudicator ───

if [[ "$CHECKLIST_STAGE" == "task-breakdown" ]]; then
  MANIFEST_DIR="$AUTOPILOT_DIR/stages/task-breakdown/manifests"
  MANIFEST_CONTEXT=""
  MANIFEST_COUNT=0
  MANIFEST_CAP=30
  if [[ -d "$MANIFEST_DIR" ]]; then
    for manifest_file in "$MANIFEST_DIR"/TASK-*.json; do
      [[ -f "$manifest_file" ]] || continue
      if [[ $MANIFEST_COUNT -ge $MANIFEST_CAP ]]; then
        printf 'gate.sh: WARNING: manifest count exceeds cap (%d); remaining manifests omitted from gate context\n' "$MANIFEST_CAP" >&2
        break
      fi
      if ! python3 -c "import sys,json; json.load(open(sys.argv[1]))" "$manifest_file" 2>/dev/null; then
        printf 'gate.sh: WARNING: skipping malformed manifest %s (invalid JSON)\n' "$(basename "$manifest_file")" >&2
        continue
      fi
      MANIFEST_CONTEXT+="=== MANIFEST: $(basename "$manifest_file") ===
$(cat "$manifest_file")

"
      MANIFEST_COUNT=$(( MANIFEST_COUNT + 1 ))
    done
  fi
  if [[ -n "$MANIFEST_CONTEXT" ]]; then
    OUTPUT="$OUTPUT

=== CONTEXT MANIFESTS ===
$MANIFEST_CONTEXT"
  else
    printf 'gate.sh: WARNING: no valid manifest files found in %s — manifest BLOCKER checks rely on LLM inference only\n' "$MANIFEST_DIR" >&2
  fi
fi

# ─── Agent system prompts ─────────────────────────────────────────────────────

read -r -d '' BLIND_CRITIC_SYSTEM_PROMPT << 'BCPROMPT' || true
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
BCPROMPT

read -r -d '' EDGE_CASE_HUNTER_SYSTEM_PROMPT << 'ECHPROMPT' || true
You are an edge case analyst. You will receive a technical document and the original brief
that drove it.

Your job: walk every branching path and boundary condition described in the brief,
and report only those that the document does not handle.

For each unhandled case: describe the scenario, describe what the document says (or doesn't say),
and describe what could go wrong if this scenario occurs in implementation.

Output a numbered list. If all cases are handled, output "ALL_CASES_HANDLED".
Do NOT suggest how to fix them — only enumerate them.
ECHPROMPT

read -r -d '' ADJUDICATOR_SYSTEM_PROMPT << 'ADJPROMPT' || true
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
ADJPROMPT

# ─── Launch Blind Critic and Edge Case Hunter in parallel ─────────────────────

echo "$OUTPUT" | claude -p "$BLIND_CRITIC_SYSTEM_PROMPT" --dangerously-skip-permissions \
  > "$TMPDIR_GATE/bc_output" 2>"$TMPDIR_GATE/bc_err" &
BC_PID=$!

printf '%s\n\nBRIEF:\n%s' "$OUTPUT" "$BRIEF" | claude -p "$EDGE_CASE_HUNTER_SYSTEM_PROMPT" --dangerously-skip-permissions \
  > "$TMPDIR_GATE/ech_output" 2>"$TMPDIR_GATE/ech_err" &
ECH_PID=$!

# ─── Wait for both agents individually ───────────────────────────────────────

BC_STATUS=0
wait $BC_PID || BC_STATUS=$?

ECH_STATUS=0
wait $ECH_PID || ECH_STATUS=$?

# ─── Read results with fallback on failure ────────────────────────────────────

if [[ $BC_STATUS -ne 0 ]]; then
  cat "$TMPDIR_GATE/bc_err" >&2
  BC_REPORT="[BLIND_CRITIC_UNAVAILABLE: agent failed (exit $BC_STATUS)]"
else
  BC_REPORT=$(cat "$TMPDIR_GATE/bc_output")
  [[ -n "$BC_REPORT" ]] || BC_REPORT="[BLIND_CRITIC_UNAVAILABLE: agent produced no output]"
fi

if [[ $ECH_STATUS -ne 0 ]]; then
  cat "$TMPDIR_GATE/ech_err" >&2
  ECH_REPORT="[EDGE_CASE_HUNTER_UNAVAILABLE: agent failed (exit $ECH_STATUS)]"
else
  ECH_REPORT=$(cat "$TMPDIR_GATE/ech_output")
  [[ -n "$ECH_REPORT" ]] || ECH_REPORT="[EDGE_CASE_HUNTER_UNAVAILABLE: agent produced no output]"
fi

# ─── Build Adjudicator input and run sequentially ────────────────────────────

ADJUDICATOR_PROMPT="OUTPUT:
$OUTPUT

BRIEF:
$BRIEF

CHECKLIST:
$CHECKLIST

BLIND_CRITIC_REPORT:
$BC_REPORT

EDGE_CASE_REPORT:
$ECH_REPORT"

ADJUDICATOR_STATUS=0
RESULT=$(echo "$ADJUDICATOR_PROMPT" | claude -p "$ADJUDICATOR_SYSTEM_PROMPT" --dangerously-skip-permissions) || ADJUDICATOR_STATUS=$?

if [[ $ADJUDICATOR_STATUS -ne 0 ]]; then
  echo "gate.sh: adjudicator agent failed (exit $ADJUDICATOR_STATUS)" >&2
  echo '{"verdict":"FAIL","score":1,"checklist":[],"blockers":["Adjudicator agent failed to run (exit '"$ADJUDICATOR_STATUS"')"],"critique":"The adjudicator agent exited non-zero. This is likely a transient error. Retry the gate run.","suggestions":[],"contested_decisions":[]}'
  exit 0
fi

# ─── Validate JSON ────────────────────────────────────────────────────────────

if ! printf '%s\n' "$RESULT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  # Gate returned non-JSON — treat as a FAIL with a runner error
  echo '{"verdict":"FAIL","score":1,"checklist":[],"blockers":["Gate returned invalid JSON — model response was malformed"],"critique":"The quality gate itself produced a non-JSON response. This is a transient error. Retry the gate run.","suggestions":[],"contested_decisions":[]}'
  exit 0
fi

# ─── Compute BC/ECH issue counts and merge into result ───────────────────────

if [[ -z "$BC_REPORT" || "$BC_REPORT" == \[BLIND_CRITIC_UNAVAILABLE* ]]; then
  BC_SCORE="null"
else
  BC_SCORE=$(printf '%s\n' "$BC_REPORT" | grep -cE '^[0-9]+\. ' || true)
fi

if [[ -z "$ECH_REPORT" || "$ECH_REPORT" == \[EDGE_CASE_HUNTER_UNAVAILABLE* ]]; then
  ECH_SCORE="null"
else
  ECH_SCORE=$(printf '%s\n' "$ECH_REPORT" | grep -cE '^[0-9]+\. ' || true)
fi

RESULT=$(printf '%s\n' "$RESULT" | python3 -c "
import sys, json
bc = sys.argv[1]; ech = sys.argv[2]
d = json.load(sys.stdin)
d['blind_critic_score'] = int(bc) if bc != 'null' else None
d['edge_case_score'] = int(ech) if ech != 'null' else None
print(json.dumps(d))
" "$BC_SCORE" "$ECH_SCORE") || { printf '%s\n' '{"verdict":"FAIL","score":1,"checklist":[],"blockers":["Gate score merge failed"],"critique":"Internal error merging BC/ECH scores into result JSON.","suggestions":[],"contested_decisions":[]}'; exit 0; }

printf '%s\n' "$RESULT"
