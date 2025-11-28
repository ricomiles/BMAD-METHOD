# Domain Research Step 1: Initialization and Context

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative research partnership
- 📋 YOU ARE A RESEARCH FACILITATOR, not content generator
- 💬 FOCUS on domain/industry research with current web data
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- ⚠️ Present A/P/C menu after initial context generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

This step will generate content and present choices:

- **A (Advanced Elicitation)**: Use discovery protocols to develop deeper domain insights
- **P (Party Mode)**: Bring multiple perspectives to validate domain scope
- **C (Continue)**: Save the content to the document and proceed to next step

## PROTOCOL INTEGRATION:

- When 'A' selected: Execute {project-root}/{bmad_folder}/core/tasks/advanced-elicitation.xml
- When 'P' selected: Execute {project-root}/{bmad_folder}/core/workflows/party-mode
- PROTOCOLS always return to this step's A/P/C menu
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Current document and frontmatter from main workflow are available
- Research type = "domain" is already set
- **Research topic = "{{research_topic}}"** - discovered from initial discussion
- **Research goals = "{{research_goals}}"** - captured from initial discussion
- Focus on industry/domain analysis with web research
- Web search capabilities with {{current_year}} data are enabled

## YOUR TASK:

Initialize domain research scope and approach for the already-identified topic: **{{research_topic}}**

## DOMAIN RESEARCH INITIALIZATION:

### 1. Confirm Domain Research Direction

Begin with domain-specific positioning:
"I'll guide you through **domain research** for **{{research_topic}}** using current {{current_year}} web data with rigorous source verification.

**Research Goals Identified:** {{research_goals}}

**Domain Research Focus for {{research_topic}}:**

- Industry analysis and market dynamics for this domain
- Regulatory requirements and compliance standards affecting {{research_topic}}
- Technology trends and innovation patterns in {{research_topic}}
- Competitive landscape within the {{research_topic}} domain
- Supply chain and ecosystem analysis

Let me refine the research scope specifically for **{{research_topic}}**:

### 2. Establish Research Context

Refine domain-specific details based on the already-identified topic:

#### Context Refinement Questions:

- "What specific aspects of {{research_topic}} are most critical for your goals?"
- "Are there particular segments or sub-domains within {{research_topic}} we should examine?"
- "What regulatory or compliance factors most impact {{research_topic}}?"
- "What time horizon for {{research_topic}} research - current state or include future trends?"
- "How deep should we analyze the {{research_topic}} domain - overview or comprehensive?"

### 3. Define Research Scope

Collaboratively establish research boundaries:

#### Scope Definition:

- "How broad should our domain analysis be?"
- "Are we looking at global markets or specific regions?"
- "Should we focus on current state or include future projections?"
- "What depth of research do you need (overview vs deep dive)?"

### 4. Generate Research Overview Content

Prepare initial content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Research Overview

### Research Objectives

[Domain research objectives based on conversation]

### Scope and Boundaries

[Research scope definition based on conversation]

### Research Methodology

[Research methodology approach with {{current_year}} web data emphasis]

### Source Verification Standards

[Source verification approach and confidence level framework]
```

### 5. Present Content and Menu

Show the generated overview and present choices:
"I've established the foundation for our **domain research** with {{current_year}} web data and rigorous source verification.

**Here's what I'll add to the document:**

[Show the complete markdown content from step 4]

**Research Standards:**

- Always using {{current_year}} web searches
- Requiring multiple sources for critical claims
- Citing all factual claims with URLs
- Presenting conflicting information when sources disagree
- Using confidence levels for uncertain data

**What would you like to do?**
[A] Advanced Elicitation - Let's deepen our understanding of the domain scope
[P] Party Mode - Bring different perspectives on domain research approach
[C] Continue - Save this to the document and begin domain analysis

### 6. Handle Menu Selection

#### If 'A' (Advanced Elicitation):

- Execute advanced-elicitation.xml with current domain overview
- Process enhanced domain insights that come back
- Ask user: "Accept these improvements to the research overview? (y/n)"
- If yes: Update content with improvements, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

#### If 'P' (Party Mode):

- Execute party-mode workflow with current domain overview
- Process collaborative domain expertise and additional insights
- Ask user: "Accept these changes to the research overview? (y/n)"
- If yes: Update content with improvements, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1]`
- Load: `./step-02-domain-analysis.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 4.

## SUCCESS METRICS:

✅ Domain research scope clearly defined and confirmed
✅ Research methodology established with {{current_year}} emphasis
✅ Source verification standards communicated and documented
✅ A/P/C menu presented and handled correctly
✅ Content properly appended to document when C selected
✅ Proper routing to next domain research step

## FAILURE MODES:

❌ Not confirming specific domain/industry to research
❌ Missing research scope boundaries
❌ Not emphasizing {{current_year}} web data requirement
❌ Not communicating source verification protocols
❌ Not presenting A/P/C menu after content generation
❌ Appending content without user selecting 'C'

## WEB RESEARCH READINESS:

This step prepares for web research by:

- Establishing {{current_year}} search query framework
- Defining source verification protocols
- Setting confidence level methodology
- Preparing for multiple source verification of critical claims

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-02-domain-analysis.md` to begin web-based domain analysis with current {{current_year}} data.

Remember: Always emphasize current {{current_year}} data and rigorous source verification in domain research!
