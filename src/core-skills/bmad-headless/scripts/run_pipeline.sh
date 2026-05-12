#!/usr/bin/env bash
# run_pipeline.sh — Main pipeline loop
# Called by the orchestrator after initialization.
# Reads PIPELINE_STATE.json, runs pending stages, gates, retries, escalates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
AUTOPILOT_DIR=".autopilot"
STATE_FILE="$AUTOPILOT_DIR/PIPELINE_STATE.json"
MAX_RETRIES=3

# Stages in order — edit this to add/remove/reorder stages
# Stages resolved from pipeline state (handles greenfield vs brownfield)
get_stages() {
  local mode
  mode=$(python3 "$SCRIPT_DIR/update_state.py" get mode 2>/dev/null || echo "greenfield")
  if [[ "$mode" == "brownfield" ]]; then
    echo "context-ingestion analyst architect task-breakdown developer reviewer"
  else
    echo "analyst architect task-breakdown developer reviewer"
  fi
}
read -ra STAGES <<< "$(get_stages)"

# ─── Helpers ────────────────────────────────────────────────────────────────

log() { echo "[Autopilot] $*"; }

state_get() {
  python3 "$SCRIPT_DIR/update_state.py" get "$1"
}

check_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "ERROR: No pipeline state found. Run: python3 scripts/update_state.py init PROJECT_BRIEF.md"
    exit 1
  fi
}

# ─── Stage runner ────────────────────────────────────────────────────────────

run_stage() {
  local stage="$1"
  log "Starting stage: $stage"
  python3 "$SCRIPT_DIR/update_state.py" start "$stage"
  bash "$SCRIPT_DIR/run_stage.sh" "$stage"
}

# ─── Gate runner ─────────────────────────────────────────────────────────────

run_gate() {
  local stage="$1"
  local attempt="$2"

  log "Running quality gate: $stage (attempt $attempt)"
  local gate_output
  gate_output=$(bash "$SCRIPT_DIR/gate.sh" "$stage")

  local verdict score critique blind_critic_score edge_case_score contested_count
  verdict=$(echo "$gate_output" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['verdict'])")
  score=$(echo "$gate_output"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['score'])")
  critique=$(echo "$gate_output" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('critique',''))")
  blind_critic_score=$(printf '%s\n' "$gate_output" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('blind_critic_score'); print(v if v is not None else 'null')")
  edge_case_score=$(printf '%s\n' "$gate_output" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('edge_case_score'); print(v if v is not None else 'null')")
  contested_count=$(printf '%s\n' "$gate_output" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('contested_decisions') or []))")

  if [[ "$verdict" == "PASS" ]]; then
    log "✓ $stage passed (score $score/10)"
    python3 "$SCRIPT_DIR/update_state.py" gate "$stage" PASS "$score" "" "$blind_critic_score" "$edge_case_score" "$contested_count"
    return 0
  else
    log "✗ $stage failed (score $score/10)"
    if [[ -n "$critique" ]]; then
      log "  Critique: ${critique:0:120}..."
    fi
    python3 "$SCRIPT_DIR/update_state.py" gate "$stage" FAIL "$score" "$critique" "$blind_critic_score" "$edge_case_score" "$contested_count"

    # Save critique file for retry context
    mkdir -p "$AUTOPILOT_DIR/stages/$stage"
    echo "$critique" > "$AUTOPILOT_DIR/stages/$stage/critique_${attempt}.md"
    return 1
  fi
}

# ─── Escalation ──────────────────────────────────────────────────────────────

escalate() {
  local stage="$1"

  log "⚠ Escalating: $stage failed $MAX_RETRIES times"
  python3 "$SCRIPT_DIR/update_state.py" escalate "$stage"

  # Collect all critiques
  local critiques=""
  for i in $(seq 1 $MAX_RETRIES); do
    local crit_file="$AUTOPILOT_DIR/stages/$stage/critique_${i}.md"
    if [[ -f "$crit_file" ]]; then
      critiques+="### Attempt $i\n$(cat "$crit_file")\n\n"
    fi
  done

  # Generate escalation file
  cat > "$AUTOPILOT_DIR/ESCALATION.md" <<EOF
# Escalation required — $stage

The pipeline cannot proceed automatically.
Stage **$stage** failed quality gates $MAX_RETRIES times.

## What you need to do

Review the critiques below. The most common cause is the PROJECT_BRIEF.md
not providing enough detail on a specific point. Update the brief with the
missing information, then resume:

\`\`\`bash
bash scripts/run_pipeline.sh
\`\`\`

## Critique history

$(echo -e "$critiques")

## Stage output (last attempt)

See: $AUTOPILOT_DIR/stages/$stage/output.md

## Pipeline state

$(python3 "$SCRIPT_DIR/update_state.py" status)
EOF

  log "Escalation written to $AUTOPILOT_DIR/ESCALATION.md"
  log "Please review and update PROJECT_BRIEF.md, then re-run the pipeline."
  exit 2
}

# ─── Main loop ───────────────────────────────────────────────────────────────

main() {
  check_state
  log "Resuming pipeline..."
  python3 "$SCRIPT_DIR/update_state.py" status

  for stage in "${STAGES[@]}"; do
    local status
    status=$(state_get "stages.$stage.status")

    if [[ "$status" == "passed" ]]; then
      log "↷ Skipping $stage (already passed)"
      continue
    fi

    if [[ "$status" == "escalated" ]]; then
      log "Pipeline previously escalated at $stage. Check $AUTOPILOT_DIR/ESCALATION.md"
      exit 2
    fi

    # Developer stage: agent-orchestrated parallel execution
    if [[ "$stage" == "developer" ]]; then
      log "Starting developer stage (agent-orchestrated)"
      python3 "$SCRIPT_DIR/update_state.py" start "developer"
      mkdir -p "$AUTOPILOT_DIR/stages/developer"
      bash "$SCRIPT_DIR/run_developer_agent.sh"
      continue
    fi

    # Standard stage: run → gate → retry loop
    local attempt=1
    local stage_passed=false

    while [[ $attempt -le $MAX_RETRIES ]]; do
      run_stage "$stage"

      if run_gate "$stage" "$attempt"; then
        stage_passed=true
        break
      fi

      if [[ $attempt -lt $MAX_RETRIES ]]; then
        log "Retrying $stage (attempt $((attempt+1))/$MAX_RETRIES)..."
      fi

      ((attempt++))
    done

    if [[ "$stage_passed" == "false" ]]; then
      escalate "$stage"
    fi
  done

  # All stages passed
  log "All stages complete. Assembling deliverables..."
  python3 "$SCRIPT_DIR/assemble.py"
  python3 "$SCRIPT_DIR/update_state.py" complete

  log "Pipeline complete. Deliverables in .autopilot/DELIVERABLES/"
  python3 "$SCRIPT_DIR/update_state.py" status
}

main "$@"
