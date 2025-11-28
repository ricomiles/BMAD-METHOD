# Technical Research Step 2: Technical Overview

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without web search verification
- ✅ ALWAYS use {{current_year}} web searches for current technical data
- 📋 YOU ARE A TECHNICAL ANALYST, not content generator
- 💬 FOCUS on technical architecture and implementation patterns
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show web search analysis before presenting findings
- ⚠️ Present [C] continue option after technical overview content generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from step-01 are available
- Focus on technical architecture and implementation landscape
- Web search capabilities with source verification are enabled
- May need to search for current technical trends and frameworks

## YOUR TASK:

Conduct comprehensive technical overview using current {{current_year}} web data with emphasis on architecture patterns and implementation approaches.

## TECHNICAL OVERVIEW SEQUENCE:

### 1. Begin Technical Overview

Start with technical research approach:
"Now I'll conduct **technical overview analysis** using current {{current_year}} web data to understand the technical landscape for [technology/domain].

**Technical Overview Focus:**

- Current technical architecture patterns and frameworks
- Implementation approaches and best practices
- Technology stack evolution and trends
- Integration patterns and interoperability
- Performance and scalability considerations

**Let me search for current technical landscape information.**"

### 2. Web Search for Technical Architecture

Search for current architecture patterns:
`WebSearch: "[technology/domain] architecture patterns frameworks {{current_year}}"`

**Architecture focus:**

- Current architectural patterns and design principles
- Frameworks and platforms commonly used
- Microservices, monolith, and hybrid approaches
- Cloud-native and edge computing patterns

### 3. Web Search for Implementation Approaches

Search for current implementation practices:
`WebSearch: "[technology/domain] implementation best practices {{current_year}}"`

**Implementation focus:**

- Development methodologies and approaches
- Code organization and structure patterns
- Testing and quality assurance practices
- Deployment and operations strategies

### 4. Web Search for Technology Stack Trends

Search for current technology trends:
`WebSearch: "[technology/domain] technology stack trends {{current_year}}"`

**Stack focus:**

- Programming languages and frameworks popularity
- Database and storage technologies
- APIs and communication protocols
- Development tools and platforms

### 5. Generate Technical Overview Content

Prepare technical analysis with web search citations:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Technical Overview

### Current Architecture Patterns

[Architecture patterns analysis with source citations]
_Source: [URL with {{current_year}} architecture data]_

### Implementation Approaches

[Implementation approaches analysis with source citations]
_Source: [URL with {{current_year}} implementation data]_

### Technology Stack Evolution

[Technology stack analysis with source citations]
_Source: [URL with {{current_year}} technology data]_

### Integration and Interoperability

[Integration patterns analysis with source citations]
_Source: [URL with {{current_year}} integration data]_

### Performance and Scalability Patterns

[Performance patterns analysis with source citations]
_Source: [URL with {{current_year}} performance data]_

### Development and Operations Practices

[DevOps practices analysis with source citations]
_Source: [URL with {{current_year}} DevOps data]_
```

### 6. Present Analysis and Continue Option

Show the generated technical overview and present continue option:
"I've completed the **technical overview analysis** using current {{current_year}} data to understand the technical landscape.

**Key Technical Findings:**

- Current architecture patterns and frameworks identified
- Implementation approaches and best practices mapped
- Technology stack evolution and trends documented
- Integration patterns and interoperability analyzed
- Performance and scalability considerations captured

**Ready to proceed to architectural patterns?**
[C] Continue - Save this to the document and move to architectural patterns

### 7. Handle Continue Selection

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1, 2]`
- Load: `./step-03-architectural-patterns.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 5.

## SUCCESS METRICS:

✅ Architecture patterns identified with current {{current_year}} citations
✅ Implementation approaches clearly documented
✅ Technology stack evolution thoroughly analyzed
✅ Integration patterns and interoperability mapped
✅ Performance and scalability considerations captured
✅ [C] continue option presented and handled correctly
✅ Content properly appended to document when C selected
✅ Proper routing to architectural patterns step

## FAILURE MODES:

❌ Not using {{current_year}} in technical web searches
❌ Missing critical architecture patterns or frameworks
❌ Not identifying current implementation best practices
❌ Incomplete technology stack evolution analysis
❌ Not presenting [C] continue option after content generation
❌ Appending content without user selecting 'C'

## TECHNICAL RESEARCH PROTOCOLS:

- Search for technical documentation and architecture guides
- Use industry technical publications and conference proceedings
- Research open-source projects and their architectures
- Note technology adoption patterns and migration trends
- Research performance benchmarking and optimization techniques

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-03-architectural-patterns.md` to focus on specific architectural patterns and design decisions.

Remember: Always emphasize current {{current_year}} technical data and rigorous source verification!
