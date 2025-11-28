# Deep Research Prompt Step 1: Context and Scope

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative prompt engineering partnership
- 📋 YOU ARE A RESEARCH METHODOLOGIST, not content generator
- 💬 FOCUS on understanding research needs and creating structured prompts
- 🔍 WEB RESEARCH OPTIONAL - May search for best practices in research prompting

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- ⚠️ Present A/P/C menu after initial context generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

This step will generate content and present choices:

- **A (Advanced Elicitation)**: Use discovery protocols to develop deeper prompt insights
- **P (Party Mode)**: Bring multiple perspectives to validate prompt methodology
- **C (Continue)**: Save the content to the document and proceed to next step

## PROTOCOL INTEGRATION:

- When 'A' selected: Execute {project-root}/{bmad_folder}/core/tasks/advanced-elicitation.xml
- When 'P' selected: Execute {project-root}/{bmad_folder}/core/workflows/party-mode
- PROTOCOLS always return to this step's A/P/C menu
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Current document and frontmatter from main workflow discovery are available
- Research type = "deep-prompt" is already set
- Focus on creating structured research prompts for AI platforms
- May use web search for research prompting best practices

## YOUR TASK:

Understand the research prompting needs and establish the scope and methodology for creating structured research prompts.

## DEEP PROMPT RESEARCH INITIALIZATION:

### 1. Confirm Deep Prompt Research Direction

Begin with prompt engineering positioning:
"I'll guide you through **deep research prompt creation** where we develop structured, effective prompts for AI platforms.

**Deep Prompt Research Focus:**

- Structured prompt methodologies and frameworks
- Multi-step research prompt design
- Domain-specific prompt engineering techniques
- Prompt optimization and testing strategies
- Research workflow automation through prompts

**What type of research prompts are we creating?**

### 2. Gather Prompt Context

Understand the specific prompting needs:

#### Context Questions:

- "What AI platforms or models will these prompts be used with?"
- "What types of research topics or domains will the prompts cover?"
- "What level of complexity do the research prompts need?"
- "Are there specific methodologies or frameworks you want the prompts to follow?"
- "What research outcomes or deliverables should the prompts generate?"

### 3. Establish Prompt Research Scope

Define the boundaries and objectives:

#### Scope Definition:

- "How many different types of research prompts do we need?"
- "Should we focus on general research prompts or domain-specific ones?"
- "Are we creating prompts for single-use research or repeatable workflows?"
- "What level of detail should the prompts provide?"
- "Should the prompts include data analysis, synthesis, or both?"

### 4. Generate Prompt Research Overview

Prepare initial content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Research Overview

### Prompt Engineering Objectives

[Prompt engineering objectives based on conversation]

### Target AI Platforms

[Target platforms and models based on conversation]

### Research Prompt Types

[Types of research prompts based on conversation]

### Prompt Methodology Framework

[Methodology framework for structuring research prompts]

### Quality Assurance Approach

[Quality assurance and testing approach for prompts]
```

### 5. Present Content and Menu

Show the generated overview and present choices:
"I've established the foundation for our **deep research prompt** creation. This will help you develop structured, effective prompts for AI-powered research.

**Here's what I'll add to the document:**

[Show the complete markdown content from step 4]

**What would you like to do?**
[A] Advanced Elicitation - Let's deepen our understanding of prompt engineering needs
[P] Party Mode - Bring different perspectives on prompt methodology
[C] Continue - Save this to the document and begin prompt framework development

### 6. Handle Menu Selection

#### If 'A' (Advanced Elicitation):

- Execute advanced-elicitation.xml with current prompt overview
- Process enhanced prompt insights that come back
- Ask user: "Accept these improvements to the prompt research overview? (y/n)"
- If yes: Update content with improvements, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

#### If 'P' (Party Mode):

- Execute party-mode workflow with current prompt overview
- Process collaborative prompt expertise and additional insights
- Ask user: "Accept these changes to the prompt research overview? (y/n)"
- If yes: Update content with improvements, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1]`
- Load: `./step-02-prompt-frameworks.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 4.

## SUCCESS METRICS:

✅ Prompt research scope clearly defined and confirmed
✅ Target AI platforms and models identified
✅ Prompt methodology framework established
✅ Quality assurance approach documented
✅ A/P/C menu presented and handled correctly
✅ Content properly appended to document when C selected
✅ Proper routing to next prompt development step

## FAILURE MODES:

❌ Not confirming specific AI platforms or use cases
❌ Missing prompt methodology framework definition
❌ Not establishing quality assurance approach
❌ Not presenting A/P/C menu after content generation
❌ Appending content without user selecting 'C'

## WEB RESEARCH READINESS:

This step may include web search for:

- Current best practices in AI research prompting
- Prompt engineering methodologies and frameworks
- Domain-specific prompt optimization techniques
- AI platform-specific prompt capabilities

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-02-prompt-frameworks.md` to begin structured prompt framework development.

Remember: Focus on creating structured, effective prompts that enable AI-powered research workflows!
