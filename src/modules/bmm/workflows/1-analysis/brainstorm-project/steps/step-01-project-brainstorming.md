# Project Brainstorming Step 1: Orchestrated Brainstorming Session

## MANDATORY EXECUTION RULES (READ FIRST):

- 🎯 This is a meta-workflow that orchestrates the core brainstorming workflow
- 📋 YOU ARE A BRAINSTORMING FACILITATOR, Guiding the user to get the best ideas out of them through facilitated suggestion
- 💬 FOCUS on project-specific context and workflow integration
- 🔗 CRITICAL: Must pass context to core brainstorming workflow correctly

## EXECUTION PROTOCOLS:

- 🎯 Validate workflow status and execution context before proceeding
- 📖 Load project context from brainstorming-focus.md
- 🔗 Invoke core brainstorming workflow with project context
- 💾 Save results to specified output location
- 📊 Update workflow status in integrated mode

## CONTEXT BOUNDARIES:

- Project context from brainstorming-focus.md is available
- Core brainstorming workflow path: `{project-root}/{bmad_folder}/core/workflows/brainstorming/workflow.yaml`
- Output location: `{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md`
- Status file: `{output_folder}/bmm-workflow-status.yaml` (if in integrated mode)

## YOUR TASK:

Orchestrate a project brainstorming session using the core brainstorming workflow with project-specific context.

## PROJECT BRAINSTORMING SEQUENCE:

### 1. Workflow Status Validation

Begin with status validation approach:
"Now I'll set up your **project brainstorming session** by validating the workflow context and preparing the core brainstorming workflow.

**Status Validation Focus:**

- Check for existing workflow status file
- Validate execution mode (standalone vs integrated)
- Ensure brainstorming is appropriate next step in sequence
- Prepare workflow integration context

**Let me check the current workflow status.**"

#### Status File Check

- Check if `{output_folder}/bmm-workflow-status.yaml` exists
- If no status file: Set standalone_mode = true
- If status file exists: Load and validate workflow sequence
- Check if brainstorm-project is next expected workflow
- Validate project_level from metadata

### 2. Project Context Loading

Load project-specific brainstorming guidance:
"**Loading Project Brainstorming Context...**

**Project Focus Areas for Today's Session:**

- User Problems and Pain Points identification
- Feature Ideas and Capabilities exploration
- Technical Approaches and feasibility consideration
- User Experience design thinking
- Business Model and Value creation strategies
- Market Differentiation opportunities
- Technical Risks and Challenges assessment
- Success Metrics definition

**Integration Pathways:**
This brainstorming session will feed into:

- Product Briefs for initial product vision
- PRDs for detailed requirements
- Technical Specifications for architecture plans
- Research Activities for validation needs"

### 3. Core Brainstorming Workflow Orchestration

Invoke the core brainstorming workflow with project context:

**Orchestration Approach:**
"I'll now orchestrate the **core brainstorming workflow** with your project-specific context.

**What to Expect:**

- Interactive brainstorming techniques menu tailored for projects
- Project-focused ideation methods and guidance
- Structured capture of all generated ideas and insights
- Results saved to your project's brainstorming folder

**The core workflow will provide:**

- Multiple brainstorming technique options
- Guided ideation sessions based on your selections
- Real-time capture and organization of ideas
- Project-specific prompting and context awareness

**Let me launch the core brainstorming workflow with your project context...**"

#### Workflow Invocation

- Execute: `{project-root}/{bmad_folder}/core/workflows/brainstorming/workflow.yaml`
- Pass: `brainstorming-focus.md` context as input data
- Ensure: Output saves to `{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md`
- Monitor: Session progress and results generation

### 4. Session Completion and Status Update

Complete the orchestrated session:

**Completion Process:**
"**✅ Project Brainstorming Session Complete!**

**Session Results:**

- Brainstorming session successfully orchestrated
- Core workflow executed with project context
- Results captured in: `{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md`
- All ideas and insights organized for downstream workflows

{{#if standalone_mode != true}}
**Workflow Status Updated:**

- Progress tracking updated in BMAD workflow system
- Ready for next workflow in sequence

**Next Steps:**

- **Next required:** [Will determine from workflow status]
- **Recommended:** Review results before proceeding to next workflow
- **Optional:** Run additional analysis workflows (research, product-brief)

{{else}}
**Next Steps:**
Since no workflow sequence is active:

- Review brainstorming results and identify key concepts
- Consider running `workflow-init` to create a guided workflow path
- Refer to BMAD workflow guide for next steps
  {{/if}}

**Integration Opportunities:**
Your brainstorming results are ready to feed into:

- **Product Brief** workflow for initial product vision
- **PRD** workflow for detailed requirements
- **Research** workflows for market/technical validation
- **Architecture** workflows for technical design"

#### Status Update (Integrated Mode Only)

- Load: `{output_folder}/bmm-workflow-status.yaml`
- Update: `workflow_status["brainstorm-project"] = "{output_folder}/analysis/brainstorming/project-{{topic}}-brainstorming-{{date}}.md"`
- Preserve: ALL comments and structure in status file
- Determine: Next workflow and agent for progression

## SUCCESS METRICS:

✅ Workflow status validated and execution context confirmed
✅ Project context loaded and prepared for core workflow
✅ Core brainstorming workflow successfully orchestrated
✅ Project-specific context passed correctly to core workflow
✅ Session results captured in specified output location
✅ Workflow status updated (in integrated mode)
✅ Integration guidance provided for next steps

## FAILURE MODES:

❌ Not validating workflow status before execution
❌ Failing to pass project context to core workflow
❌ Core brainstorming workflow execution failure
❌ Results not saved to correct output location
❌ Status not updated in integrated mode
❌ Not providing integration guidance for next steps

## CRITICAL WORKFLOW INTEGRATION:

- **Context Passing**: Must pass brainstorming-focus.md intact to core workflow
- **Output Management**: Ensure core workflow saves to correct location
- **Status Consistency**: Update workflow status file only in integrated mode
- **Path Recording**: Record only file paths as status values (no extra text)

## NEXT STEPS:

After completion, users can:

- Review brainstorming session results
- Brainstorm something else
- Proceed with recommended next workflow (integrated mode)
- Run product-brief or PRD workflows to develop concepts further
- Conduct research workflows to validate brainstormed ideas
- Begin architecture workflows for technical design concepts

This meta-workflow successfully bridges project-specific brainstorming needs with the powerful core brainstorming workflow while maintaining seamless integration with the broader BMAD methodology.
