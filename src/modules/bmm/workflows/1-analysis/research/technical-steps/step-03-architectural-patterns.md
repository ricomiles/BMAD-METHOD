# Technical Research Step 3: Architectural Patterns

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without web search verification
- ✅ ALWAYS use {{current_year}} web searches for current architectural data
- 📋 YOU ARE A SYSTEMS ARCHITECT, not content generator
- 💬 FOCUS on architectural patterns and design decisions
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show web search analysis before presenting findings
- ⚠️ Present [C] continue option after architectural patterns content generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2, 3]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Focus on architectural patterns and design decisions
- Web search capabilities with source verification are enabled
- May need to search for specific architectural frameworks and patterns

## YOUR TASK:

Conduct comprehensive architectural patterns analysis using current {{current_year}} web data with emphasis on design decisions and implementation approaches.

## ARCHITECTURAL PATTERNS SEQUENCE:

### 1. Begin Architectural Patterns Analysis

Start with architectural research approach:
"Now I'll focus on **architectural patterns and design decisions** using current {{current_year}} data to understand effective architecture approaches for [technology/domain].

**Architectural Patterns Focus:**

- System architecture patterns and their trade-offs
- Design principles and best practices
- Scalability and maintainability considerations
- Integration and communication patterns
- Security and performance architectural considerations

**Let me search for current architectural patterns and approaches.**"

### 2. Web Search for System Architecture Patterns

Search for current architecture patterns:
`WebSearch: "system architecture patterns best practices {{current_year}}"`

**Architecture focus:**

- Microservices, monolithic, and serverless patterns
- Event-driven and reactive architectures
- Domain-driven design patterns
- Cloud-native and edge architecture patterns

### 3. Web Search for Design Principles

Search for current design principles:
`WebSearch: "software design principles patterns {{current_year}}"`

**Design focus:**

- SOLID principles and their application
- Clean architecture and hexagonal architecture
- API design and GraphQL vs REST patterns
- Database design and data architecture patterns

### 4. Web Search for Scalability Patterns

Search for current scalability approaches:
`WebSearch: "scalability architecture patterns {{current_year}}"`

**Scalability focus:**

- Horizontal vs vertical scaling patterns
- Load balancing and caching strategies
- Distributed systems and consensus patterns
- Performance optimization techniques

### 5. Generate Architectural Patterns Content

Prepare architectural analysis with web search citations:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Architectural Patterns and Design

### System Architecture Patterns

[System architecture patterns analysis with source citations]
_Source: [URL with {{current_year}} architecture data]_

### Design Principles and Best Practices

[Design principles analysis with source citations]
_Source: [URL with {{current_year}} design data]_

### Scalability and Performance Patterns

[Scalability patterns analysis with source citations]
_Source: [URL with {{current_year}} scalability data]_

### Integration and Communication Patterns

[Integration patterns analysis with source citations]
_Source: [URL with {{current_year}} integration data]_

### Security Architecture Patterns

[Security patterns analysis with source citations]
_Source: [URL with {{current_year}} security data]_

### Data Architecture Patterns

[Data architecture analysis with source citations]
_Source: [URL with {{current_year}} data architecture data]_

### Deployment and Operations Architecture

[Deployment architecture analysis with source citations]
_Source: [URL with {{current_year}} deployment data]_
```

### 6. Present Analysis and Continue Option

Show the generated architectural patterns and present continue option:
"I've completed the **architectural patterns analysis** using current {{current_year}} data to understand effective architecture approaches.

**Key Architectural Findings:**

- System architecture patterns and trade-offs clearly mapped
- Design principles and best practices thoroughly documented
- Scalability and performance patterns identified
- Integration and communication patterns analyzed
- Security and data architecture considerations captured

**Ready to proceed to implementation research?**
[C] Continue - Save this to the document and move to implementation research

### 7. Handle Continue Selection

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1, 2, 3]`
- Load: `./step-04-implementation-research.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 5.

## SUCCESS METRICS:

✅ System architecture patterns identified with current {{current_year}} citations
✅ Design principles clearly documented and analyzed
✅ Scalability and performance patterns thoroughly mapped
✅ Integration and communication patterns captured
✅ Security and data architecture considerations analyzed
✅ [C] continue option presented and handled correctly
✅ Content properly appended to document when C selected
✅ Proper routing to implementation research step

## FAILURE MODES:

❌ Not using {{current_year}} in architectural web searches
❌ Missing critical system architecture patterns
❌ Not analyzing design trade-offs and considerations
❌ Incomplete scalability or performance patterns analysis
❌ Not presenting [C] continue option after content generation
❌ Appending content without user selecting 'C'

## ARCHITECTURAL RESEARCH PROTOCOLS:

- Search for architecture documentation and pattern catalogs
- Use architectural conference proceedings and case studies
- Research successful system architectures and their evolution
- Note architectural decision records (ADRs) and rationales
- Research architecture assessment and evaluation frameworks

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-04-implementation-research.md` to focus on implementation approaches and technology adoption.

Remember: Always emphasize current {{current_year}} architectural data and rigorous source verification!
