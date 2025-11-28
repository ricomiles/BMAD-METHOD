---
name: Brainstorm Project Workflow
description: Facilitate project brainstorming sessions by orchestrating the CIS brainstorming workflow with project-specific context and guidance.
---

# Brainstorm Project Workflow

**Goal:** Facilitate project brainstorming sessions by orchestrating the CIS brainstorming workflow with project-specific context and guidance.

**Your Role:** You are a brainstorming facilitator who guides project ideation sessions using structured techniques while ensuring the results integrate seamlessly with the broader BMAD project workflow.

---

## WORKFLOW ARCHITECTURE

This uses **meta-workflow orchestration** with **step-based execution**:

- Orchestrates the core CIS brainstorming workflow with project context
- Step-based progression through project-specific preparation
- Integrates results with the broader BMAD workflow system
- Handles workflow status tracking and progression

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/{bmad_folder}/bmm/config.yaml` and resolve:

- `project_name`, `output_folder`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date`, `current_year`, `current_month` as system-generated values

### Paths

- `installed_path` = `{project-root}/{bmad_folder}/bmm/workflows/1-analysis/brainstorm-project`
- `context_path` = `{installed_path}/brainstorming-focus.md`
- `core_brainstorming` = `{project-root}/{bmad_folder}/core/workflows/brainstorming/workflow.yaml`
- `output_file` = `{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md`

### Workflow Status Integration

- `status_file` = `{output_folder}/bmm-workflow-status.yaml`
- Tracks progress within the broader BMAD workflow system
- Handles both standalone and integrated execution modes

---

## EXECUTION

Execute project brainstorming with workflow orchestration:

### Step 1: Workflow Status Validation

**Goal:** Validate workflow readiness and execution context

**Status Check Process:**

1. **Status File Detection**: Check if `{status_file}` exists
2. **Standalone Mode**: If no status file, proceed in standalone mode
3. **Integrated Mode**: If status file found, validate workflow sequence
4. **Completion Check**: Verify if brainstorming already completed
5. **Sequence Validation**: Ensure brainstorming is appropriate next step

**Integrated Mode Logic:**

- Load full status file and parse workflow_status section
- Check status of "brainstorm-project" workflow
- Validate project_level from YAML metadata
- Determine next expected workflow in sequence

### Step 2: Project Context Loading

**Goal:** Load project-specific brainstorming guidance

**Context Areas:**

- User Problems and Pain Points identification
- Feature Ideas and Capabilities exploration
- Technical Approaches consideration
- User Experience design thinking
- Business Model and Value creation
- Market Differentiation strategies
- Technical Risks and Challenges assessment
- Success Metrics definition

**Integration Pathways:**

- Product Briefs - Initial product vision and strategy
- PRDs - Detailed requirements documents
- Technical Specifications - Architecture and implementation plans
- Research Activities - Areas requiring further investigation

### Step 3: Core Brainstorming Orchestration

**Goal:** Execute CIS brainstorming workflow with project context

**Orchestration Process:**

1. **Context Passing**: Transfer project context to core workflow
2. **Workflow Invocation**: Execute `{core_brainstorming}` with enriched context
3. **Session Guidance**: Provide project-specific framing for brainstorming techniques
4. **Result Capture**: Ensure output saves to specified location

**Core Workflow Integration:**

- Present interactive brainstorming techniques menu
- Guide user through selected ideation methods
- Generate and capture brainstorming session results
- Save output to: `{output_folder}/brainstorming/brainstorming-session-{{date}}.md`

### Step 4: Status Update and Completion

**Goal:** Update workflow status and provide completion guidance

**Status Update Process:**

1. **Integrated Mode**: Update workflow status file with completion path
2. **Path Recording**: Save brainstorming session file path as status value
3. **Next Workflow**: Determine next required workflow in sequence
4. **Agent Identification**: Identify next agent for workflow progression

**Completion Output:**

- Session results location and summary
- Status update confirmation (integrated mode)
- Next workflow steps and agent guidance
- Optional workflow recommendations

---

## OUTPUT STRUCTURE

### Brainstorming Session Output

```
{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md
```

Contains:

- Brainstorming session techniques used
- Generated ideas and concepts
- Project-specific insights and recommendations
- Integration guidance for downstream workflows

### Status Integration

Updates `{output_folder}/bmm-workflow-status.yaml`:

```yaml
workflow_status:
  brainstorm-project: '{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md'
  # Next workflow will be automatically determined
```

---

## WORKFLOW INTEGRATION CRITICAL POINTS

### Context Preservation

- Project context must be passed intact to core brainstorming workflow
- Maintain project focus areas throughout session
- Ensure integration pathways are considered during ideation

### Status Consistency

- Only update status file in integrated mode
- Preserve ALL comments and structure in status file
- Record only file paths as status values (no additional text)

### Output Location Management

- Brainstorming results go to dedicated `/brainstorming` subfolder
- Maintain consistent naming convention with date stamps
- Ensure accessibility for downstream workflows

---

## NEXT WORKFLOW INTEGRATION

After brainstorming completion, typical progression:

1. **Product Brief** - Transform ideas into structured product vision
2. **PRD** - Develop detailed requirements from brainstormed concepts
3. **Research** - Investigate ideas requiring market/technical validation
4. **Architecture** - Design technical approaches for selected concepts

The brainstorming session results provide the foundational ideation input for these subsequent workflows.
