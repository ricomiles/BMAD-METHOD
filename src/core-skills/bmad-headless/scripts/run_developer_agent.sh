#!/usr/bin/env bash
# run_developer_agent.sh — Invoke the developer-orchestrator agent
#
# Replaces the bash-based run_developer_stage() in run_pipeline.sh.
# The orchestrator runs as a single claude -p session that internally
# fans out per-story subagents using the Agent tool, gates each one,
# retries failures, and writes all state updates itself.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUTOPILOT_DIR=".autopilot"

mkdir -p "$AUTOPILOT_DIR/stages/developer"

# Generate sprint-status.yaml from docs/epics.md if it doesn't exist yet
if [[ ! -f "stories/sprint-status.yaml" ]]; then
  echo "[developer-agent] Generating sprint-status.yaml from docs/epics.md..." >&2
  python3 "$SCRIPT_DIR/generate_sprint_status.py"
fi

# System prompt: the developer orchestrator skill
ORCHESTRATOR_PROMPT=$(cat "$SKILL_ROOT/developer-orchestrator.md")

# Inline context passed to the orchestrator
PIPELINE_STATE=""
[[ -f "$AUTOPILOT_DIR/PIPELINE_STATE.json" ]] && PIPELINE_STATE=$(cat "$AUTOPILOT_DIR/PIPELINE_STATE.json")

SPRINT_STATUS=""
[[ -f "stories/sprint-status.yaml" ]] && SPRINT_STATUS=$(cat "stories/sprint-status.yaml")

FULL_PROMPT="[PIPELINE_MODE: autonomous]

## Pipeline State (read-only context — update via python3 scripts/update_state.py)

\`\`\`json
$PIPELINE_STATE
\`\`\`

## Sprint Status (stories/sprint-status.yaml)

\`\`\`yaml
$SPRINT_STATUS
\`\`\`

---
Execute the developer stage per your system prompt. Start immediately with Step 1.
"

echo "$FULL_PROMPT" | claude -p "$ORCHESTRATOR_PROMPT" \
  --dangerously-skip-permissions \
  | tee "$AUTOPILOT_DIR/stages/developer/orchestrator.log"

echo "[developer-agent] Orchestrator session complete"
