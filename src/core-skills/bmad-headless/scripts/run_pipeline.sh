#!/usr/bin/env bash
# run_pipeline.sh — Main pipeline loop
# Called by the orchestrator after initialization.
# Reads PIPELINE_STATE.json, runs pending stages, gates, retries, escalates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
AUTOPILOT_DIR=".autopilot"
STATE_FILE="$AUTOPILOT_DIR/PIPELINE_STATE.json"

# Load stage plan from registry (ordered stages + per-stage capability flags)
PLAN_JSON=$(python3 "$SCRIPT_DIR/load_stage_plan.py") || { echo "[Autopilot] ERROR: load_stage_plan.py failed — registry missing or corrupt" >&2; exit 1; }
read -ra STAGES <<< "$(python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(d['stages']))" <<< "$PLAN_JSON")"

# Read a capability flag for a given stage from the plan
stage_flag() {
  python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print('true' if d['flags'].get(sys.argv[1], {}).get(sys.argv[2]) is True else 'false')
" "$1" "$2" <<< "$PLAN_JSON"
}

# Read max_retries for a stage from the plan
stage_retries() {
  python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(d['flags'].get(sys.argv[1], {}).get('max_retries', 3))
" "$1" <<< "$PLAN_JSON"
}

# Returns "true" if Decision Engine invocation is allowed; "false" if disabled via PROJECT_BRIEF.md
decision_engine_enabled() {
  if grep -qE '^contested_decision_detection:\s*false' PROJECT_BRIEF.md 2>/dev/null; then
    echo "false"
  else
    echo "true"
  fi
}

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
    # Write contested decisions for Decision Engine (PASS only; FAIL path skips this block)
    mkdir -p "$AUTOPILOT_DIR/stages/$stage"
    : > "$AUTOPILOT_DIR/stages/$stage/contested_decisions.json"
    if [[ "$contested_count" -gt 0 ]]; then
      log "  ↳ $contested_count contested decision(s) flagged — Decision Engine may deliberate"
      printf '%s\n' "$gate_output" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for dec in (d.get('contested_decisions') or []):
    print(json.dumps(dec))
" > "$AUTOPILOT_DIR/stages/$stage/contested_decisions.json" 2>/dev/null || true
    fi
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
  local max_retries="${2:-3}"

  log "⚠ Escalating: $stage failed $max_retries times"
  python3 "$SCRIPT_DIR/update_state.py" escalate "$stage"

  # Collect all critiques
  local critiques=""
  for i in $(seq 1 $max_retries); do
    local crit_file="$AUTOPILOT_DIR/stages/$stage/critique_${i}.md"
    if [[ -f "$crit_file" ]]; then
      critiques+="### Attempt $i\n$(cat "$crit_file")\n\n"
    fi
  done

  # Generate escalation file
  cat > "$AUTOPILOT_DIR/ESCALATION.md" <<EOF
# Escalation required — $stage

The pipeline cannot proceed automatically.
Stage **$stage** failed quality gates $max_retries times.

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

# ─── Repair-loop escalation ───────────────────────────────────────────────────

escalate_repair_loop() {
  local stage="$1"
  local repair_cycles_done="$2"

  log "⚠ Escalating: $stage failed after $repair_cycles_done repair cycle(s)"
  python3 "$SCRIPT_DIR/update_state.py" escalate "$stage"

  local history
  history="## Original $stage failure"$'\n\n'
  local original_out="$AUTOPILOT_DIR/stages/$stage/output_repair_0.md"
  if [[ -f "$original_out" ]]; then
    history+="$(cat "$original_out")"$'\n\n'
  fi

  for i in $(seq 1 "$repair_cycles_done"); do
    local pf_out="$AUTOPILOT_DIR/stages/$stage/parse_failures_${i}.json"
    if [[ -f "$pf_out" ]]; then
      history+=$'\n## Repair cycle '"$i"$' — failing tickets (parse_failures)\n\n```json\n'
      history+="$(cat "$pf_out")"
      history+=$'\n```\n\n'
    fi
    local cycle_out="$AUTOPILOT_DIR/stages/$stage/output_repair_${i}.md"
    if [[ -f "$cycle_out" ]]; then
      history+=$'\n## Repair cycle '"$i"$' — '"$stage"$' output\n\n'
      history+="$(cat "$cycle_out")"$'\n\n'
    fi
  done

  cat > "$AUTOPILOT_DIR/ESCALATION.md" <<EOF
# Escalation required — $stage (repair loop exhausted)

The $stage stage failed after $repair_cycles_done repair cycle(s) and cannot proceed automatically.

## What you need to do

Review the failure history below. Common causes:
- Test assertion relies on environment state not reproducible in automation
- An architectural decision needs changing (update PROJECT_BRIEF.md and re-run)
- A ticket's implementation has a logic error that the repair agent couldn't resolve

After fixing, resume with:
\`\`\`bash
bash scripts/run_pipeline.sh
\`\`\`

${history}

## Pipeline state

$(python3 "$SCRIPT_DIR/update_state.py" status)
EOF

  log "Escalation written to $AUTOPILOT_DIR/ESCALATION.md"
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

    local is_parallelizable is_repair_loop
    is_parallelizable=$(stage_flag "$stage" "parallelizable") || { log "ERROR: stage_flag failed for $stage parallelizable"; exit 1; }
    is_repair_loop=$(stage_flag "$stage" "repair_loop") || { log "ERROR: stage_flag failed for $stage repair_loop"; exit 1; }

    # Parallelizable stage: agent-orchestrated parallel execution
    if [[ "$is_parallelizable" == "true" ]]; then
      log "Starting $stage stage (agent-orchestrated)"
      python3 "$SCRIPT_DIR/update_state.py" start "$stage"
      mkdir -p "$AUTOPILOT_DIR/stages/$stage"
      bash "$SCRIPT_DIR/run_developer_agent.sh"
      continue

    # Repair-loop stage: targeted repair loop on gate failure
    elif [[ "$is_repair_loop" == "true" ]]; then
      local max_repair_cycles
      max_repair_cycles=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(d['flags'].get(sys.argv[1], {}).get('repair_loop_max_cycles', 2))
" "$stage" <<< "$PLAN_JSON") || { log "ERROR: failed to read repair_loop_max_cycles for $stage"; exit 1; }
      [[ "$max_repair_cycles" =~ ^[0-9]+$ ]] || { log "ERROR: invalid repair_loop_max_cycles '${max_repair_cycles}' for $stage"; exit 1; }

      local repair_target
      repair_target=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
targets = d['flags'].get(sys.argv[1], {}).get('repair_targets', [])
print(targets[0] if targets else '')
" "$stage" <<< "$PLAN_JSON")

      if [[ -z "$repair_target" ]]; then
        log "ERROR: $stage has repair_loop:true but no repair_targets in registry"
        exit 1
      fi

      log "Starting $stage stage (repair-loop capable, max cycles: $max_repair_cycles)"
      python3 "$SCRIPT_DIR/update_state.py" start "$stage"

      local repair_cycle=0
      local reviewer_passed=false

      # Initial stage run
      bash "$SCRIPT_DIR/run_stage.sh" "$stage" || true
      # Save output before first gate evaluation
      cp "$AUTOPILOT_DIR/stages/$stage/output.md" \
         "$AUTOPILOT_DIR/stages/$stage/output_repair_0.md" 2>/dev/null || true

      while true; do
        if run_gate "$stage" "$((repair_cycle + 1))"; then
          reviewer_passed=true
          break
        fi

        if [[ $repair_cycle -ge $max_repair_cycles ]]; then
          log "$stage repair cycles exhausted ($max_repair_cycles)"
          break
        fi

        repair_cycle=$((repair_cycle + 1))
        log "$stage failed — repair cycle $repair_cycle/$max_repair_cycles"

        # Increment repair_cycles in state
        python3 "$SCRIPT_DIR/update_state.py" repair_cycle "$stage"

        # Parse failures from stage output
        local repair_json
        repair_json=$(python3 "$SCRIPT_DIR/parse_failures.py" \
          --reviewer-output "$AUTOPILOT_DIR/stages/$stage/output.md" \
          --manifest-dir "$AUTOPILOT_DIR/stages/task-breakdown/manifests") || {
          log "WARNING: parse_failures.py failed — cannot identify failing tickets; escalating"
          break
        }

        # Save parse_failures output for escalation history
        printf '%s\n' "$repair_json" > "$AUTOPILOT_DIR/stages/$stage/parse_failures_${repair_cycle}.json" 2>/dev/null || true

        # Extract known ticket IDs (exclude "unknown"), one per line
        local failing_tickets
        failing_tickets=$(printf '%s\n' "$repair_json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for k in d.keys():
    if k != 'unknown':
        print(k)
")

        if [[ -z "$failing_tickets" ]]; then
          log "WARNING: no tickets identified in failure output — escalating"
          break
        fi

        while IFS= read -r ticket_id; do
          [[ -z "$ticket_id" ]] && continue
          log "Repairing $ticket_id (repair cycle $repair_cycle)"
          local repair_dir="$AUTOPILOT_DIR/stages/$repair_target/$ticket_id"
          mkdir -p "$repair_dir"

          # Write repair critique for this ticket
          printf '%s\n' "$repair_json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cycle = sys.argv[1]
tid = sys.argv[2]
entry = d.get(tid, {})
failures = entry.get('failures', [])
print(f'REPAIR CYCLE {cycle}: Fix only the following test failures. Do not change other behavior.')
print()
for f in failures:
    line_ref = f'{f[\"file\"]}:{f[\"line\"]}' if f.get('line') else f['file']
    print(f'- {line_ref} — {f[\"message\"]}')
" "$repair_cycle" "$ticket_id" > "$repair_dir/critique_${repair_cycle}.md"

          # Re-run repair target for this ticket (manifest-scoped)
          bash "$SCRIPT_DIR/run_stage.sh" "$repair_target" "$ticket_id" || true
          python3 "$SCRIPT_DIR/update_state.py" repair_cycle ticket "$ticket_id"
        done <<< "$failing_tickets"

        # Re-run stage and save output copy for escalation history
        bash "$SCRIPT_DIR/run_stage.sh" "$stage" || true
        cp "$AUTOPILOT_DIR/stages/$stage/output.md" \
           "$AUTOPILOT_DIR/stages/$stage/output_repair_${repair_cycle}.md" 2>/dev/null || true
      done

      if [[ "$reviewer_passed" == "false" ]]; then
        escalate_repair_loop "$stage" "$repair_cycle"
      fi
      continue

    else
      # Standard stage: run → gate → retry loop
      local attempt=1
      local stage_passed=false
      local max_retries
      max_retries=$(stage_retries "$stage")
      [[ "$max_retries" =~ ^[0-9]+$ ]] || { log "ERROR: invalid max_retries '${max_retries}' for stage $stage"; exit 1; }

      while [[ $attempt -le $max_retries ]]; do
        run_stage "$stage"

        if run_gate "$stage" "$attempt"; then
          stage_passed=true
          if [[ "$(decision_engine_enabled)" == "true" ]] && [[ "$(stage_flag "$stage" "decision_engine")" == "true" ]]; then
            local de_decisions_file="$AUTOPILOT_DIR/stages/$stage/contested_decisions.json"
            if [[ -f "$de_decisions_file" ]]; then
              while IFS= read -r decision_json; do
                [[ -z "$decision_json" ]] && continue
                local de_label
                de_label=$(python3 -c "import sys,json; print(json.loads(sys.argv[1]).get('decision','<unknown>')[:80])" "$decision_json" 2>/dev/null || echo "<unknown>")
                log "Running Decision Engine for: $de_label"
                bash "$SCRIPT_DIR/decision-engine.sh" "$decision_json" || \
                  log "WARNING: Decision Engine failed for '$de_label' — continuing"
              done < "$de_decisions_file"
            fi
          elif [[ -f "$AUTOPILOT_DIR/stages/$stage/contested_decisions.json" ]]; then
            log "Decision Engine disabled — contested decisions for $stage logged but not deliberated"
          fi
          break
        fi

        if [[ $attempt -lt $max_retries ]]; then
          log "Retrying $stage (attempt $((attempt+1))/$max_retries)..."
        fi

        ((attempt++))
      done

      if [[ "$stage_passed" == "false" ]]; then
        escalate "$stage" "$max_retries"
      fi
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
