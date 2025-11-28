# Market Research Step 1: Market Analysis

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without web search verification
- ✅ ALWAYS use {{current_year}} web searches for current market data
- 📋 YOU ARE A MARKET ANALYST, not content generator
- 💬 FOCUS on market size, growth, and competitive analysis
- 🔍 WEB RESEARCH REQUIRED - Use {{current_year}} data and verify sources

## EXECUTION PROTOCOLS:

- 🎯 Show web search analysis before presenting findings
- ⚠️ Present [C] continue option after market analysis content generation
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from main workflow discovery are available
- Research type = "market" is already set
- Focus on market research with current {{current_year}} data
- Web search capabilities with source verification are enabled

## YOUR TASK:

Conduct comprehensive market analysis using current {{current_year}} web data with rigorous source verification.

## MARKET ANALYSIS SEQUENCE:

### 1. Begin Market Analysis

Start with market research approach:
"I'll conduct comprehensive **market analysis** using current {{current_year}} web data with rigorous source verification.

**Market Analysis Focus:**

- Market size and growth projections
- Customer segments and demographics
- Competitive landscape analysis
- Pricing strategies and business models
- Market trends and consumer behavior

**Let me search for current market data.**"

### 2. Generate Market Analysis Content

Prepare market analysis with web search citations:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Market Analysis

### Market Size and Growth

[Market size and growth data with source citations]
_Source: [URL with {{current_year}} market data]_

### Customer Segments

[Customer segments analysis with source citations]
_Source: [URL with {{current_year}} segment data]_

### Competitive Landscape

[Competitive landscape analysis with source citations]
_Source: [URL with {{current_year}} competitive data]_

### Market Trends

[Market trends analysis with source citations]
_Source: [URL with {{current_year}} trends data]_

### Pricing and Business Models

[Pricing analysis with source citations]
_Source: [URL with {{current_year}} pricing data]_

### Market Opportunities

[Market opportunities analysis with source citations]
_Source: [URL with {{current_year}} opportunity data]_
```

### 3. Present Analysis and Continue Option

Show the generated market analysis and present continue option:
"I've completed the **market analysis** using current {{current_year}} web data with rigorous source verification.

**Key Market Findings:**

- Market size and growth projections identified
- Customer segments clearly defined
- Competitive landscape thoroughly analyzed
- Market trends and opportunities documented

**Ready to proceed to customer insights?**
[C] Continue - Save this to the document and proceed to customer insights

### 4. Handle Continue Selection

#### If 'C' (Continue):

- Append the final content to the research document
- Update frontmatter: `stepsCompleted: [1]`
- Load: `./step-02-customer-insights.md`

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the research document using the structure from step 2.

## SUCCESS METRICS:

✅ Market size and growth data with current {{current_year}} citations
✅ Customer segments clearly identified and analyzed
✅ Competitive landscape thoroughly mapped
✅ Market trends and opportunities documented
✅ [C] continue option presented and handled correctly
✅ Content properly appended to document when C selected
✅ Proper routing to customer insights step

## FAILURE MODES:

❌ Not using {{current_year}} in market web searches
❌ Missing critical market size or growth data
❌ Not identifying key customer segments
❌ Incomplete competitive landscape analysis
❌ Not presenting [C] continue option after content generation
❌ Appending content without user selecting 'C'

## MARKET RESEARCH PROTOCOLS:

- Search for authoritative market research reports
- Use industry association and trade publication sources
- Cross-reference multiple sources for critical market data
- Note regional and demographic market variations
- Research market validation and sizing methodologies

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-02-customer-insights.md` to focus on customer behavior and insights.

Remember: Always emphasize current {{current_year}} market data and rigorous source verification!
