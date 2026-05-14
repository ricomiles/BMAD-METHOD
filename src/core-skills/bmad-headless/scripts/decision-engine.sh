#!/usr/bin/env bash
# decision-engine.sh — Three-agent Decision Engine for one contested architectural decision
# Usage: bash scripts/decision-engine.sh '<contested_decision_json>'
#   JSON shape: {"section":"...","decision":"...","alternatives":["opt-A","opt-B"],"why_contested":"..."}
# Outputs:
#   .autopilot/stages/architect/ADRs/ADR-NNN-decision-engine.md (auto-incremented, no collision)
#   PIPELINE_STATE.json: stages.architect.decision_engine_adrs[] updated

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTESTED_JSON="${1:?Usage: decision-engine.sh '<contested_decision_json>'}"
ADR_DIR=".autopilot/stages/architect/ADRs"

# ─── Parse contested decision fields ─────────────────────────────────────────

DECISION=$(python3 -c "import sys,json; print(json.loads(sys.argv[1]).get('decision',''))" "$CONTESTED_JSON")
SECTION=$(python3 -c "import sys,json; print(json.loads(sys.argv[1]).get('section',''))" "$CONTESTED_JSON")
BEST_ALTERNATIVE=$(python3 -c "
import sys, json
d = json.loads(sys.argv[1])
alts = d.get('alternatives', [])
print(alts[0] if alts else 'no alternative specified')
" "$CONTESTED_JSON")
WHY_CONTESTED=$(python3 -c "import sys,json; print(json.loads(sys.argv[1]).get('why_contested',''))" "$CONTESTED_JSON")

# ─── Load brief and architecture section ──────────────────────────────────────

BRIEF=$(cat PROJECT_BRIEF.md)

ARCH_FILE=""
if [[ -f "docs/architecture.md" ]]; then
  ARCH_FILE="docs/architecture.md"
elif [[ -f ".autopilot/stages/architect/output.md" ]]; then
  ARCH_FILE=".autopilot/stages/architect/output.md"
fi

ARCH_SECTION=""
if [[ -n "$ARCH_FILE" ]]; then
  ARCH_SECTION=$(python3 -c "
import sys, re
content = open(sys.argv[1]).read()
section = sys.argv[2]
m = re.search(r'(#{1,4}\s+.*?' + re.escape(section) + r'.*?\n.+?)(?=\n#{1,4}\s|\Z)', content, re.IGNORECASE | re.DOTALL)
if m:
    print(m.group(1)[:4000])
else:
    print(content[:4000])
" "$ARCH_FILE" "$SECTION")
fi

# ─── Proponent agent ──────────────────────────────────────────────────────────

PROPONENT_SYSTEM=$(cat <<'SEOF'
You are arguing for a specific technical decision.

Your job: make the strongest possible case for this decision given the project's constraints.
Be specific — cite constraints from the brief, architectural implications, tradeoffs accepted.
Output: 3-5 paragraphs. Arguments only. Do not hedge.
SEOF
)

PROPONENT_OUTPUT=$(printf 'DECISION: %s\nWHY_CONTESTED: %s\n\nCONTEXT:\n%s\n\nPROJECT BRIEF:\n%s\n' \
  "$DECISION" "$WHY_CONTESTED" "$ARCH_SECTION" "$BRIEF" \
  | claude -p "$PROPONENT_SYSTEM" --dangerously-skip-permissions)

# ─── Opponent agent ───────────────────────────────────────────────────────────

OPPONENT_SYSTEM=$(cat <<'SEOF'
You are arguing against a specific technical decision in favor of an alternative.

Your job: make the strongest possible case for the alternative over the decision-as-made.
Be specific — cite constraints from the brief, architectural implications, risks of the chosen path.
Output: 3-5 paragraphs. Arguments only. Do not hedge.
SEOF
)

OPPONENT_OUTPUT=$(printf 'DECISION MADE: %s\nALTERNATIVE: %s\nWHY_CONTESTED: %s\n\nCONTEXT:\n%s\n\nPROJECT BRIEF:\n%s\n' \
  "$DECISION" "$BEST_ALTERNATIVE" "$WHY_CONTESTED" "$ARCH_SECTION" "$BRIEF" \
  | claude -p "$OPPONENT_SYSTEM" --dangerously-skip-permissions)

# ─── DE Adjudicator agent ─────────────────────────────────────────────────────

ADJUDICATOR_SYSTEM=$(cat <<'SEOF'
You are adjudicating a technical decision for an automated software pipeline.

Your job: produce a definitive ADR resolving this decision.

Rules:
- The brief is ground truth. If the brief implies a constraint that favors one side, cite it.
- If both options are genuinely equal given the brief's constraints, preserve the decision-as-made
  (consistency bias: changing a decision costs implementation coherence).
- Do not split the difference. Pick one.

Output ONLY a valid ADR in this format:
# ADR-NNN: <decision title>

Status: Accepted (via Decision Engine)
Date: <date>

## Context
<what made this contested>

## Decision
<the chosen option>

## Rationale
<cite specific brief constraints and architectural implications — not generic arguments>

## Rejected alternative
<the losing option and the specific reason it lost>

## Consequences
<what this means for implementation>
SEOF
)

ADR_CONTENT=$(printf 'DECISION_MADE: %s\nALTERNATIVE: %s\nWHY_CONTESTED: %s\n\nFOR_DECISION:\n%s\n\nFOR_ALTERNATIVE:\n%s\n\nBRIEF:\n%s\n\nCONTEXT:\n%s\n' \
  "$DECISION" "$BEST_ALTERNATIVE" "$WHY_CONTESTED" "$PROPONENT_OUTPUT" "$OPPONENT_OUTPUT" "$BRIEF" "$ARCH_SECTION" \
  | claude -p "$ADJUDICATOR_SYSTEM" --dangerously-skip-permissions)

if [[ -z "$ADR_CONTENT" ]]; then
  echo "[Decision Engine] ERROR: Adjudicator returned empty output — ADR not written" >&2
  exit 1
fi

# ─── Auto-number and write ADR ────────────────────────────────────────────────

mkdir -p "$ADR_DIR"

NEXT_NUM=$(python3 -c "
import os, re, sys
adr_dir = sys.argv[1]
nums = []
if os.path.isdir(adr_dir):
    for f in os.listdir(adr_dir):
        m = re.match(r'^(?:ADR-)?(\d+)', f)
        if m:
            nums.append(int(m.group(1)))
print(max(nums, default=0) + 1)
" "$ADR_DIR")

ADR_FILENAME=$(printf 'ADR-%03d-decision-engine.md' "$NEXT_NUM")
ADR_PATH="$ADR_DIR/$ADR_FILENAME"
printf '%s\n' "$ADR_CONTENT" > "$ADR_PATH"

# ─── Record in pipeline state ─────────────────────────────────────────────────

python3 "$SCRIPT_DIR/update_state.py" adr architect "$ADR_PATH"
echo "[Decision Engine] ADR written: $ADR_PATH"
