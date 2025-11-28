# Domain Research Step 2: Industry Analysis

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without web search verification
- ✅ ALWAYS use {{current_year}} web searches for current data
- 📋 YOU ARE A RESEARCH ANALYST, not content generator
- 💬 FOCUS on industry/domain analysis with verified sources
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show web search analysis before presenting findings
- ⚠️ Present [C] continue option after domain analysis content generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from step-01 are available
- Research type = "domain" is already set
- Focus on industry/domain web research with {{current_year}} data
- Web search capabilities with source verification are enabled

## YOUR TASK:

Conduct comprehensive domain/industry analysis using current {{current_year}} web data with rigorous source verification.

## DOMAIN ANALYSIS SEQUENCE:

### 1. Begin Domain Analysis

Start with web research approach:
"Now I'll conduct comprehensive domain research using current {{current_year}} web data with rigorous source verification.

**Domain Analysis Focus:**

- Industry size, growth, and market dynamics
- Technology trends and innovation patterns
- Regulatory landscape and compliance requirements
- Key players and competitive ecosystem
- Supply chain and business model evolution

**Let me search for current {{current_year}} data on [domain/industry].**"

### 2. Web Search for Industry Overview

Search for current industry information:
`WebSearch: "[domain/industry] market size growth {{current_year}}"`

**Analysis approach:**

- Look for recent market research reports and industry analyses
- Identify market size, growth rates, and trends
- Find authoritative sources (market research firms, industry associations)
- Note conflicting information from different sources

### 3. Web Search for Technology Trends

Search for current technology developments:
`WebSearch: "[domain/industry] technology trends {{current_year}}"`

**Technology focus:**

- Emerging technologies and innovation patterns
- Digital transformation impacts
- Automation and efficiency improvements
- New business models enabled by technology

### 4. Web Search for Regulatory Landscape

Search for current regulatory requirements:
`WebSearch: "[domain/industry] regulations compliance {{current_year}}"`

**Regulatory focus:**

- Current regulations and compliance requirements
- Recent changes or upcoming regulations
- Industry standards and best practices
- Regional or jurisdictional differences

### 5. Generate Domain Analysis Content

Prepare analysis content with source citations:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Industry Overview

### Market Size and Growth

[Market size and growth data with source citations]
_Source: [URL with {{current_year}} data]_

### Technology Trends

[Technology trends analysis with source citations]
_Source: [URL with {{current_year}} data]_

### Regulatory Landscape

[Regulatory analysis with source citations]
_Source: [URL with {{current_year}} data]_

### Key Players and Ecosystem

[Key players analysis with source citations]
_Source: [URL with {{current_year}} data]_

### Growth Drivers and Challenges

[Growth drivers and challenges with source citations]
_Source: [URL with {{current_year}} data]_
```

### 6. Present Analysis and Continue Option

Show the generated analysis and present continue option:
"I've completed the **domain/industry analysis** using current {{current_year}} web data with rigorous source verification.

**Key Findings:**

- Multiple sources verified for critical market data
- Conflicting information noted where sources disagree
- Confidence levels applied to uncertain data
- All factual claims include source citations

**Ready to proceed to regulatory focus?**
[C] Continue - Save this to the document and move to regulatory focus

### 7. Handle Continue Selection

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1, 2]`
- Load: `./step-03-regulatory-focus.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 5.

## SUCCESS METRICS:

✅ Industry size and growth data with current {{current_year}} citations
✅ Technology trends identified with current developments
✅ Regulatory landscape analysis with current requirements
✅ Key players and ecosystem mapped with current data
✅ [C] continue option presented and handled correctly
✅ Content properly appended to document when C selected
✅ Web searches properly structured with {{current_year}} parameter

## FAILURE MODES:

❌ Not using {{current_year}} in web search queries
❌ Not requiring source citations for factual claims
❌ Not presenting conflicting information when sources disagree
❌ Not applying confidence levels to uncertain data
❌ Not presenting [C] continue option after content generation
❌ Appending content without user selecting 'C'

## WEB RESEARCH PROTOCOLS:

All web searches must:

- Include {{current_year}} for current data
- Require multiple sources for critical claims
- Present conflicting information when found
- Include source URLs for all factual claims
- Apply confidence levels appropriately

## SOURCE VERIFICATION:

- Always cite URLs for web search results
- Use authoritative sources (market research firms, industry associations)
- Note data currency and potential limitations
- Present multiple perspectives when sources conflict

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-03-regulatory-focus.md` to focus on specific regulatory and compliance requirements.

Remember: Always emphasize current {{current_year}} data and rigorous source verification in domain research!
