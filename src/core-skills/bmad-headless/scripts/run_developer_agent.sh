#!/usr/bin/env bash
# run_developer_agent.sh — Invoke the developer-orchestrator agent
#
# Replaces the bash-based run_developer_stage() in run_pipeline.sh.
# The orchestrator runs as a single claude -p session that internally
# fans out per-ticket subagents using the Agent tool, gates each one,
# retries failures, and writes all state updates itself.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUTOPILOT_DIR=".autopilot"

mkdir -p "$AUTOPILOT_DIR/stages/developer"

# System prompt: the developer orchestrator skill
ORCHESTRATOR_PROMPT=$(cat "$SKILL_ROOT/developer-orchestrator.md")

# Inline context passed to the orchestrator
PIPELINE_STATE=""
[[ -f "$AUTOPILOT_DIR/PIPELINE_STATE.json" ]] && PIPELINE_STATE=$(cat "$AUTOPILOT_DIR/PIPELINE_STATE.json")

TASKS_MD=""
[[ -f "$AUTOPILOT_DIR/stages/task-breakdown/output.md" ]] && TASKS_MD=$(cat "$AUTOPILOT_DIR/stages/task-breakdown/output.md")

FULL_PROMPT="[PIPELINE_MODE: autonomous]

## Pipeline State (read-only context — update via python3 scripts/update_state.py)

\`\`\`json
$PIPELINE_STATE
\`\`\`

## Tasks Manifest (.autopilot/stages/task-breakdown/output.md)

\`\`\`markdown
$TASKS_MD
\`\`\`

---
Execute the developer stage per your system prompt. Start immediately with Step 1.
"

echo "$FULL_PROMPT" | claude -p "$ORCHESTRATOR_PROMPT" \
  --dangerously-skip-permissions \
  | tee "$AUTOPILOT_DIR/stages/developer/orchestrator.log"

echo "[developer-agent] Orchestrator session complete"
