# Agent Compilation: YAML to XML

While your goal is to create a agent in the proper yaml format, its useful for you to understand that the YAML file will be compiled to a markdown file with XML in the file. This is the final format that the user will use the agents with an LLM.

What is outlined here is what additional information is added to the agent so it will blend well with what you will create in the yaml file.

## Auto-Injected Components

### 1. Frontmatter

**Injected automatically to compiled markdown file:**

```
---
name: '{agent name from filename}'
description: '{title from metadata}'
---

You must fully embody this agent's persona...
```

**DO NOT add** frontmatter to your YAML source.

### 2. Activation Block

**Entire activation section is auto-generated:**
**DO NOT create** activation sections - compiler builds it from your critical_actions in the place where it is indicated with a comment in the next xml block.

```xml
<activation critical="MANDATORY">
  <step n="1">Load persona from this current agent file</step>
  <step n="2">Load config to get {user_name}, {communication_language}</step>
  <step n="3">Remember: user's name is {user_name}</step>
  <!-- YOUR critical_actions inserted here as numbered steps -->
  <step n="N">ALWAYS communicate in {communication_language}</step>
  <step n="N+1">Show greeting + numbered menu</step>
  <step n="N+2">STOP and WAIT for user input</step>
  <step n="N+3">Input resolution rules</step>
</activation>
```

### 4. Rules Section

**Auto-injected rules:**
**DO NOT add any of these rules to the yaml** - compiler handles it when building the markdown:

- Always communicate in {communication_language}
- Stay in character until exit
- Menu triggers use asterisk (*) - NOT markdown
- Number all lists, use letters for sub-options
- Load files ONLY when executing menu items
- Written output follows communication style

## Key Takeaways

1. **Compiler handles boilerplate** - Focus on persona and logic
2. **Critical_actions become activation steps** - Just list your agent-specific needs
3. **These Menu items are auto included with every agent** - Every agent will have 4 menu items automatically added, so do not duplicate them with other menu items:
   1. <item cmd="MH or fuzzy match on menu or help">[MH] Redisplay Menu Help</item>
   2. <item cmd="CH or fuzzy match on chat">[CH] Chat with the Agent about anything</item>
   3. <item cmd="PM or fuzzy match on party-mode" exec="{project-root}/_bmad/core/workflows/party-mode/workflow.md">[PM] Start Party Mode</item>
   4. <item cmd="DA or fuzzy match on exit, leave, goodbye or dismiss agent">[DA] Dismiss Agent</item>
4. **Handlers auto-detected** - Only what you use is included
5. **Rules standardized** - Consistent behavior across agents

**Your job:** Define persona, prompts, menu actions
**Compiler's job:** Activation, handlers, rules, help/exit, prefixes
