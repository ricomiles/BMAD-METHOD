# Domain Research Step 3: Regulatory Focus

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without web search verification
- ✅ ALWAYS use {{current_year}} web searches for current regulatory data
- 📋 YOU ARE A REGULATORY ANALYST, not content generator
- 💬 FOCUS on compliance requirements and regulatory landscape
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show web search analysis before presenting findings
- ⚠️ Present [C] continue option after regulatory content generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2, 3]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Focus on regulatory and compliance requirements for the domain
- Web search capabilities with source verification are enabled
- May need to search for specific regulations and compliance frameworks

## YOUR TASK:

Conduct focused regulatory and compliance analysis using current {{current_year}} web data with emphasis on requirements that impact your project.

## REGULATORY FOCUS SEQUENCE:

### 1. Begin Regulatory Analysis

Start with regulatory research approach:
"Now I'll focus on **regulatory and compliance requirements** that impact the [domain/industry] using current {{current_year}} data.

**Regulatory Focus Areas:**

- Specific regulations and compliance frameworks
- Industry standards and best practices
- Licensing and certification requirements
- Data protection and privacy regulations
- Environmental and safety requirements

**Let me search for current regulatory requirements.**"

### 2. Web Search for Specific Regulations

Search for current regulatory information:
`WebSearch: "[domain/industry] regulations compliance requirements {{current_year}}"`

**Regulatory focus:**

- Specific regulations applicable to the domain
- Compliance frameworks and standards
- Recent regulatory changes or updates
- Enforcement agencies and oversight bodies

### 3. Web Search for Industry Standards

Search for current industry standards:
`WebSearch: "[domain/industry] standards best practices {{current_year}}"`

**Standards focus:**

- Industry-specific technical standards
- Best practices and guidelines
- Certification requirements
- Quality assurance frameworks

### 4. Web Search for Data Privacy Requirements

Search for current privacy regulations:
`WebSearch: "data privacy regulations [domain/industry] {{current_year}}"`

**Privacy focus:**

- GDPR, CCPA, and other data protection laws
- Industry-specific privacy requirements
- Data governance and security standards
- User consent and data handling requirements

### 5. Generate Regulatory Analysis Content

Prepare regulatory content with source citations:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Regulatory Requirements

### Applicable Regulations

[Specific regulations analysis with source citations]
_Source: [URL with {{current_year}} regulatory data]_

### Industry Standards and Best Practices

[Industry standards analysis with source citations]
_Source: [URL with {{current_year}} standards data]_

### Compliance Frameworks

[Compliance frameworks analysis with source citations]
_Source: [URL with {{current_year}} compliance data]_

### Data Protection and Privacy

[Privacy requirements analysis with source citations]
_Source: [URL with {{current_year}} privacy data]_

### Licensing and Certification

[Licensing requirements analysis with source citations]
_Source: [URL with {{current_year}} licensing data]_

### Implementation Considerations

[Practical implementation considerations with source citations]
_Source: [URL with {{current_year}} implementation data]_

### Risk Assessment

[Regulatory and compliance risk assessment]
```

### 6. Present Analysis and Continue Option

Show the generated regulatory analysis and present continue option:
"I've completed the **regulatory requirements analysis** focusing on compliance requirements that impact your [domain/industry] project.

**Key Regulatory Findings:**

- Specific regulations and frameworks identified
- Industry standards and best practices mapped
- Compliance requirements clearly documented
- Implementation considerations provided
- Risk assessment completed

**Ready to proceed to technical trends?**
[C] Continue - Save this to the document and move to technical trends

### 7. Handle Continue Selection

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1, 2, 3]`
- Load: `./step-04-technical-trends.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 5.

## SUCCESS METRICS:

✅ Applicable regulations identified with current {{current_year}} citations
✅ Industry standards and best practices documented
✅ Compliance frameworks clearly mapped
✅ Data protection requirements analyzed
✅ Implementation considerations provided
✅ [C] continue option presented and handled correctly
✅ Content properly appended to document when C selected

## FAILURE MODES:

❌ Not using {{current_year}} in regulatory web searches
❌ Missing critical regulatory requirements for the domain
❌ Not providing implementation considerations for compliance
❌ Not completing risk assessment for regulatory compliance
❌ Not presenting [C] continue option after content generation
❌ Appending content without user selecting 'C'

## REGULATORY RESEARCH PROTOCOLS:

- Search for specific regulations by name and number
- Identify regulatory bodies and enforcement agencies
- Research recent regulatory changes and updates
- Map industry standards to regulatory requirements
- Consider regional and jurisdictional differences

## SOURCE VERIFICATION:

- Always cite regulatory agency websites
- Use official government and industry association sources
- Note effective dates and implementation timelines
- Present compliance requirement levels and obligations

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-04-technical-trends.md` to analyze technical trends and innovations in the domain.

Remember: Always emphasize current {{current_year}} regulatory data and practical implementation considerations!
