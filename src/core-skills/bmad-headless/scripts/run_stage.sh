#!/usr/bin/env bash
# run_stage.sh — Invoke a single BMAD stage non-interactively
# Usage: bash scripts/run_stage.sh <stage_name>
#
# Resolves the corresponding BMAD-v6 skill for each stage, loads its full
# content (SKILL.md + step files + templates), and invokes it via claude -p
# with [PIPELINE_MODE: autonomous] to bypass interactive pauses.
# Falls back to hardcoded prompts if the skill cannot be resolved.

set -euo pipefail

STAGE="${1:?Usage: run_stage.sh <stage_name>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOPILOT_DIR=".autopilot"
STATE_FILE="$AUTOPILOT_DIR/PIPELINE_STATE.json"
OUTPUT_DIR="$AUTOPILOT_DIR/stages/$STAGE"
AUTOPILOT_OUTPUT="$OUTPUT_DIR/output.md"   # always written (stdout capture)

mkdir -p "$OUTPUT_DIR"

# ─── Skill resolution ────────────────────────────────────────────────────────
# Script lives at src/core-skills/headless-bmad/scripts/ inside the repo.
# BMAD-v6 skills live at src/bmm-skills/<phase>/<skill-name>/.
# Falls back to global install (~/.claude/skills/) if run from outside the repo.

resolve_bmad_skill() {
  local skill_name="$1"

  # Primary: repo-relative lookup (src/core-skills/bmad-headless/scripts/ → src/bmm-skills/)
  local skill_root bmad_src
  skill_root="$(cd "$SCRIPT_DIR/.." && pwd)"  # src/core-skills/bmad-headless/
  bmad_src="$(cd "$skill_root/../../bmm-skills" && pwd 2>/dev/null)" || true

  if [[ -n "$bmad_src" && -d "$bmad_src" ]]; then
    for phase_dir in \
      "$bmad_src/1-analysis" \
      "$bmad_src/2-plan-workflows" \
      "$bmad_src/3-solutioning" \
      "$bmad_src/4-implementation"; do
      if [[ -d "$phase_dir/$skill_name" ]]; then
        echo "$phase_dir/$skill_name"
        return 0
      fi
    done
    # Nested subdirs (e.g. 1-analysis/research/bmad-domain-research)
    local found
    found=$(find "$bmad_src" -type d -name "$skill_name" 2>/dev/null | head -1)
    if [[ -n "$found" ]]; then
      echo "$found"
      return 0
    fi
  fi

  # Project-local install (.claude/skills/ sibling — bmad project install)
  # SCRIPT_DIR/../.. resolves to the .claude/skills/ directory
  local project_skills
  project_skills="$(cd "$SCRIPT_DIR/../.." && pwd 2>/dev/null)" || true
  if [[ -n "$project_skills" && -d "$project_skills/$skill_name" ]]; then
    echo "$project_skills/$skill_name"
    return 0
  fi

  # Fallback: global install
  if [[ -d "$HOME/.claude/skills/$skill_name" ]]; then
    echo "$HOME/.claude/skills/$skill_name"
    return 0
  fi

  return 1
}

# Stage → BMAD-v6 skill mapping
get_stage_skill() {
  case "$1" in
    analyst)           echo "bmad-create-prd" ;;
    architect)         echo "bmad-create-architecture" ;;
    task-breakdown)    echo "bmad-create-epics-and-stories" ;;
    developer)         echo "bmad-dev-story" ;;           # per-story, called from run_dev_story.sh
    context-ingestion) echo "bmad-document-project" ;;
    reviewer)          echo "" ;;                          # keeps hardcoded prompt (runs bash tests)
    *)                 echo "" ;;
  esac
}

# Stage → canonical BMAD-v6 artifact output path
get_bmad_output_path() {
  case "$1" in
    analyst)           echo "docs/prd.md" ;;
    architect)         echo "docs/architecture.md" ;;
    task-breakdown)    echo "docs/epics.md" ;;
    context-ingestion) echo "docs/project-context.md" ;;
    *)                 echo "$AUTOPILOT_OUTPUT" ;;
  esac
}

# ─── Skill content loader ─────────────────────────────────────────────────────
# Concatenates SKILL.md + step files (sorted) + templates from a skill dir.

load_skill_content() {
  local skill_dir="$1"
  local content=""

  # SKILL.md — contains the autonomous mode block we added
  if [[ -f "$skill_dir/SKILL.md" ]]; then
    content+="$(cat "$skill_dir/SKILL.md")"$'\n\n'
  fi

  # Step files — load all in sorted order from any steps* subdir
  for steps_dir in \
    "$skill_dir/steps" \
    "$skill_dir/steps-c" \
    "$skill_dir/steps-e" \
    "$skill_dir/steps-v"; do
    if [[ -d "$steps_dir" ]]; then
      while IFS= read -r -d '' step_file; do
        content+="--- Step: $(basename "$step_file") ---"$'\n'
        content+="$(cat "$step_file")"$'\n\n'
      done < <(find "$steps_dir" -maxdepth 1 -name "*.md" -print0 | sort -z)
      break
    fi
  done

  # Instructions file (used by bmad-document-project and similar)
  if [[ -f "$skill_dir/instructions.md" ]]; then
    content+="--- Instructions ---"$'\n'
    content+="$(cat "$skill_dir/instructions.md")"$'\n\n'
  fi

  # Templates — include output templates so the model knows the expected format
  for tmpl_dir in "$skill_dir/templates" "$skill_dir/data"; do
    if [[ -d "$tmpl_dir" ]]; then
      while IFS= read -r -d '' tmpl; do
        content+="--- Template: $(basename "$tmpl") ---"$'\n'
        content+="$(cat "$tmpl")"$'\n\n'
      done < <(find "$tmpl_dir" -maxdepth 1 -name "*.md" -print0 | sort -z)
    fi
  done

  echo "$content"
}

# ─── Persona loading ─────────────────────────────────────────────────────────
# Maps each stage to its BMAD-v6 agent skill and extracts the Overview section
# (the persona identity) to prepend to the system prompt.

get_stage_persona_skill() {
  case "$1" in
    analyst)           echo "bmad-agent-analyst" ;;
    architect)         echo "bmad-agent-architect" ;;
    task-breakdown)    echo "bmad-agent-pm" ;;
    context-ingestion) echo "bmad-agent-analyst" ;;
    developer)         echo "bmad-agent-dev" ;;
    reviewer)          echo "" ;;
    *)                 echo "" ;;
  esac
}

load_persona_overview() {
  local skill_md="$1/SKILL.md"
  [[ ! -f "$skill_md" ]] && return
  python3 - "$skill_md" <<'PYEOF'
import sys, re
content = open(sys.argv[1]).read()
# Extract title line + Overview section, stopping before the next ## heading
m = re.search(r'^(# .+?\n\n## Overview\n.+?)(?=\n## )', content, re.DOTALL | re.MULTILINE)
if m:
    print(m.group(1).strip())
PYEOF
}

# ─── Design injection ────────────────────────────────────────────────────────

DESIGN_CONTEXT=""
if [[ "$STAGE" == "analyst" || "$STAGE" == "architect" || "$STAGE" == "developer" ]]; then
  DESIGN_CONTEXT=$(python3 "$SCRIPT_DIR/inject_designs.py" "$STAGE" 2>/dev/null || true)

  IMAGE_FLAGS=()
  if echo "$DESIGN_CONTEXT" | grep -q "^IMAGE_INJECT:"; then
    IMAGE_LINE=$(echo "$DESIGN_CONTEXT" | grep "^IMAGE_INJECT:")
    IFS=':' read -ra IMAGE_PATHS <<< "${IMAGE_LINE#IMAGE_INJECT:}"
    for img in "${IMAGE_PATHS[@]}"; do
      [[ -f "$img" ]] && IMAGE_FLAGS+=("--image" "$img")
    done
    DESIGN_CONTEXT=$(echo "$DESIGN_CONTEXT" | grep -v "^IMAGE_INJECT:")
  fi

  if echo "$DESIGN_CONTEXT" | grep -q "^FIGMA_INJECT:"; then
    FIGMA_LINE=$(echo "$DESIGN_CONTEXT" | grep "^FIGMA_INJECT:")
    IFS=':' read -ra FIGMA_PARTS <<< "${FIGMA_LINE#FIGMA_INJECT:}"
    FILE_KEY="${FIGMA_PARTS[0]}"
    FRAME_NAMES="${FIGMA_PARTS[1]:-}"
    FIGMA_IMG_DIR=".autopilot/stages/$STAGE/figma-frames"
    mkdir -p "$FIGMA_IMG_DIR"
    python3 "$SCRIPT_DIR/fetch_figma_frames.py" "$FILE_KEY" "$FRAME_NAMES" "$FIGMA_IMG_DIR" 2>/dev/null || true
    for img in "$FIGMA_IMG_DIR"/*.png; do
      [[ -f "$img" ]] && IMAGE_FLAGS+=("--image" "$img")
    done
    DESIGN_CONTEXT=$(echo "$DESIGN_CONTEXT" | grep -v "^FIGMA_INJECT:")
  fi
fi

# ─── Build context ────────────────────────────────────────────────────────────

BRIEF=$(cat PROJECT_BRIEF.md)
STATE=$(cat "$STATE_FILE")

PRIOR_CONTEXT=""
gather_prior() {
  local prior_stage="$1"
  local prior_file="$AUTOPILOT_DIR/stages/$prior_stage/output.md"

  # Prefer BMAD canonical path if it exists (richer content)
  local bmad_path
  bmad_path=$(get_bmad_output_path "$prior_stage")
  if [[ -f "$bmad_path" ]]; then
    prior_file="$bmad_path"
  fi

  if [[ -f "$prior_file" ]]; then
    PRIOR_CONTEXT+="
=== OUTPUT FROM STAGE: $prior_stage ===
$(cat "$prior_file")

"
  fi
}

case "$STAGE" in
  context-ingestion)
    PRIOR_CONTEXT=""
    ;;
  analyst)
    gather_prior "context-ingestion"
    ;;
  architect)
    gather_prior "context-ingestion"
    gather_prior "analyst"
    ;;
  task-breakdown)
    gather_prior "context-ingestion"
    gather_prior "analyst"
    gather_prior "architect"
    ADR_DIR="docs/ADRs"
    if [[ ! -d "$ADR_DIR" ]]; then
      ADR_DIR="$AUTOPILOT_DIR/stages/architect/ADRs"
    fi
    if [[ -d "$ADR_DIR" ]]; then
      PRIOR_CONTEXT+="
=== ARCHITECTURE DECISION RECORDS ===
"
      for adr in "$ADR_DIR"/*.md; do
        [[ -f "$adr" ]] || continue
        PRIOR_CONTEXT+="$(cat "$adr")

"
      done
    fi
    ;;
  reviewer)
    gather_prior "analyst"
    gather_prior "architect"
    gather_prior "task-breakdown"
    ;;
esac

# ─── Critiques from failed attempts ──────────────────────────────────────────

CRITIQUE_CONTEXT=""
for i in 1 2 3; do
  local_crit="$OUTPUT_DIR/critique_${i}.md"
  if [[ -f "$local_crit" ]]; then
    CRITIQUE_CONTEXT+="
=== CRITIQUE FROM ATTEMPT $i — YOU MUST ADDRESS THIS ===
$(cat "$local_crit")
"
  fi
done

# ─── System prompt: skill-based or hardcoded fallback ────────────────────────

BMAD_OUTPUT_PATH=$(get_bmad_output_path "$STAGE")
mkdir -p "$(dirname "$BMAD_OUTPUT_PATH")" 2>/dev/null || true

SKILL_NAME=$(get_stage_skill "$STAGE")
SYSTEM_PROMPT=""

if [[ -n "$SKILL_NAME" ]]; then
  SKILL_DIR=$(resolve_bmad_skill "$SKILL_NAME" 2>/dev/null || true)
  if [[ -n "$SKILL_DIR" ]]; then
    echo "  [run_stage] Using BMAD-v6 skill: $SKILL_NAME (from $SKILL_DIR)" >&2
    SYSTEM_PROMPT=$(load_skill_content "$SKILL_DIR")
  else
    echo "  [run_stage] Skill '$SKILL_NAME' not found — falling back to hardcoded prompt" >&2
  fi
fi

# Hardcoded fallback prompts (used when skill not installed/found, or for reviewer)
if [[ -z "$SYSTEM_PROMPT" ]]; then
  case "$STAGE" in
    context-ingestion)
      SYSTEM_PROMPT=$(cat <<'CEOF'
You are a senior engineer doing a codebase audit before a sprint.
Your job is to produce CONTEXT.md: a complete picture of the existing system
so downstream stages extend rather than replace it.

Use bash tools to:
1. Map the codebase: find source files (exclude node_modules, .git, dist, build)
2. Read key files from the brief (entry points, base classes, main patterns)
3. Read existing architecture docs if paths are provided
4. Pull sprint data from the board URL in the brief if present

Rules:
- Do NOT suggest changes — document only what exists
- Quote actual code snippets when documenting patterns (developers will copy these exactly)
- Sprint status must clearly mark: DONE (skip), IN-PROGRESS (do not conflict),
  THIS-RUN (build these), BLOCKED (do not touch)
- If sprint board is inaccessible, use the brief sprint context section and note this
- Output ONLY the CONTEXT.md in markdown. No preamble.
CEOF
)
      ;;
    analyst)
      SYSTEM_PROMPT=$(cat <<'EOF'
You are a senior product analyst running in fully automated mode.
Your job is to produce a complete PRD from the provided PROJECT_BRIEF.md.

Rules:
- Every functional requirement must have a clear acceptance criterion phrased as "Given X, when Y, then Z"
- Do NOT invent features not implied by the brief
- If the brief is ambiguous on a point, make the most conservative/minimal interpretation
  and document it in a "Decisions made" section — do not leave open questions
- The "Open questions" section must be EMPTY. Any open question means you haven't decided yet.
- Output ONLY the PRD in markdown. No preamble, no explanation.
EOF
)
      ;;
    architect)
      SYSTEM_PROMPT=$(cat <<'EOF'
You are a senior software architect running in fully automated mode.
You will receive a PROJECT_BRIEF and a PRD. Produce a complete architecture document
and one ADR per significant technology or design decision.

Rules:
- Every technology choice not specified in the brief requires an ADR
- The file/folder structure must be specific enough to create with mkdir -p commands
- API contracts must include types (TypeScript types, OpenAPI, or equivalent)
- If the brief specifies a tech, use it — do not substitute
- No "we could also..." — make decisions and document them in ADRs
- Separate ADRs with "--- ADR ---" delimiters so the script can split them
- Output ONLY the architecture markdown followed by the ADRs. No preamble.
EOF
)
      ;;
    task-breakdown)
      SYSTEM_PROMPT=$(cat <<'EOF'
You are a senior engineering lead running in fully automated mode.
You will receive a PRD and architecture document. Break the work into implementable
epics and user stories ordered by dependency, in BMAD-v6 epics format.

Output format (REQUIRED — must match exactly for pipeline compatibility):

---
stepsCompleted: []
inputDocuments: []
---

# <project_name> - Epic Breakdown

## Epic List
- Epic 1: <title>

## Epic 1: <title>

<one sentence goal>

### Story 1.1: <title>

As a <user>,
I want <capability>,
So that <value>.

**Acceptance Criteria:**

**Given** <precondition>
**When** <action>
**Then** <outcome>

[repeat for all stories]

Rules:
- Story IDs follow N.M format (Epic.Story), title uses kebab-case in sprint tracking
- Setup/foundation stories come first in Epic 1
- Stories must be ordered by dependency — no story depends on a later story
- Each story is implementable as a single focused dev session
- Output ONLY the epics document. No preamble.
EOF
)
      ;;
    reviewer)
      SYSTEM_PROMPT=$(cat <<'EOF'
You are a senior QA engineer running in fully automated mode.
Your job:
1. Run all tests and lint (use bash commands)
2. Start the application if applicable (from the definition of done in the brief)
3. Execute the acceptance criteria from PROJECT_BRIEF's definition of done
4. Write a review report: what passed, what failed, what needs fixing

Output format:
- First line: "PIPELINE_COMPLETE" if everything passes, or "PIPELINE_INCOMPLETE" if anything fails
- Then: the review report in markdown
EOF
)
      ;;
    *)
      echo "Unknown stage: $STAGE" >&2
      exit 1
      ;;
  esac
fi

# ─── Prepend persona to system prompt ────────────────────────────────────────

PERSONA_SKILL=$(get_stage_persona_skill "$STAGE")
if [[ -n "$PERSONA_SKILL" && -n "$SYSTEM_PROMPT" ]]; then
  PERSONA_DIR=$(resolve_bmad_skill "$PERSONA_SKILL" 2>/dev/null || true)
  if [[ -n "$PERSONA_DIR" ]]; then
    PERSONA_OVERVIEW=$(load_persona_overview "$PERSONA_DIR")
    if [[ -n "$PERSONA_OVERVIEW" ]]; then
      echo "  [run_stage] Prepending persona: $PERSONA_SKILL" >&2
      SYSTEM_PROMPT="$PERSONA_OVERVIEW

---

$SYSTEM_PROMPT"
    fi
  fi
fi

# ─── Construct full prompt ────────────────────────────────────────────────────

FULL_PROMPT=""

# Autonomous mode header
FULL_PROMPT+="[PIPELINE_MODE: autonomous]
[OUTPUT_PATH: $BMAD_OUTPUT_PATH]
"

# Stage-specific routing hints for the skill
case "$STAGE" in
  task-breakdown)
    FULL_PROMPT+="[TASK: Produce the epics and stories breakdown document]
"
    ;;
  analyst)
    FULL_PROMPT+="[TASK: Produce the complete PRD]
"
    ;;
  architect)
    FULL_PROMPT+="[TASK: Produce the architecture document and ADRs]
"
    ;;
  context-ingestion)
    FULL_PROMPT+="[TASK: Produce the project context document]
"
    ;;
esac

FULL_PROMPT+="
"

if [[ -n "$DESIGN_CONTEXT" ]]; then
  FULL_PROMPT+="$DESIGN_CONTEXT

"
fi

if [[ -n "$CRITIQUE_CONTEXT" ]]; then
  FULL_PROMPT+="PREVIOUS ATTEMPT(S) FAILED. YOU MUST ADDRESS ALL CRITIQUES BELOW BEFORE OUTPUTTING:
$CRITIQUE_CONTEXT

---
"
fi

FULL_PROMPT+="PROJECT_BRIEF:
$BRIEF
"

if [[ -n "$PRIOR_CONTEXT" ]]; then
  FULL_PROMPT+="
$PRIOR_CONTEXT
"
fi

FULL_PROMPT+="
CURRENT PIPELINE STATE (for context only):
$STATE

---
Your task: Execute the $STAGE stage. Write the output artifact to $BMAD_OUTPUT_PATH.
"

# ─── Invoke claude -p ─────────────────────────────────────────────────────────

echo "$FULL_PROMPT" | claude -p "$SYSTEM_PROMPT" \
  --dangerously-skip-permissions \
  "${IMAGE_FLAGS[@]+"${IMAGE_FLAGS[@]}"}" \
  > "$AUTOPILOT_OUTPUT"

# ─── Post-processing ──────────────────────────────────────────────────────────

# If claude wrote the artifact via tools to $BMAD_OUTPUT_PATH, copy it to
# the autopilot stage output so the gate can read it.
if [[ -f "$BMAD_OUTPUT_PATH" && "$BMAD_OUTPUT_PATH" != "$AUTOPILOT_OUTPUT" ]]; then
  cp "$BMAD_OUTPUT_PATH" "$AUTOPILOT_OUTPUT"
fi

# For architect: split ADRs out of the output
if [[ "$STAGE" == "architect" ]]; then
  ADR_DIR="docs/ADRs"
  mkdir -p "$ADR_DIR"
  python3 "$SCRIPT_DIR/split_adrs.py" "$AUTOPILOT_OUTPUT" "$ADR_DIR"
  # Also keep a copy in the legacy location for backwards compatibility
  mkdir -p "$AUTOPILOT_DIR/stages/architect/ADRs"
  for adr in "$ADR_DIR"/*.md; do
    [[ -f "$adr" ]] && cp "$adr" "$AUTOPILOT_DIR/stages/architect/ADRs/" 2>/dev/null || true
  done
fi

echo "Stage $STAGE complete → $AUTOPILOT_OUTPUT (artifact: $BMAD_OUTPUT_PATH)"
