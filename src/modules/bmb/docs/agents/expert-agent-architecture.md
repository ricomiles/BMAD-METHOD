# Expert Agent Architecture

Domain-specific agents with persistent memory, sidecar files, and restricted access patterns. The main difference between a simple agent and an Expert agent, is the expert has its own collection of external files in a sidecar folder that can include files to record memories, and it can have files for prompts, skills and workflows specific to the agent that manus can reference to load and exec on demand.

## When to Use

- Personal assistants (journal keeper, diary companion)
- Specialized domain experts (legal advisor, medical reference)
- Agents that need to remember past interactions
- Agents with restricted file system access (privacy/security)
- Long-term relationship agents that learn about users

## File Structure

```
{agent-name}/
├── {agent-name}.agent.yaml    # Main agent definition
└── {agent-name}-sidecar/      # Supporting files
    ├── instructions.md        # Private directives
    ├── memories.md            # Persistent memory
    ├── knowledge/             # Domain-specific resources
    │   └── README.md
    └── [custom files]         # Agent-specific resources
```

## YAML Structure

The YAML structure of the agent file itself is the same as every other agent, but generally will have something like these 3 items added to the critical_actions:
  - 'Load COMPLETE file ./{agent-name}-sidecar/memories.md and remember all past insights'
  - 'Load COMPLETE file ./{agent-name}-sidecar/instructions.md and follow ALL protocols'
  - 'ONLY read/write files in ./{agent-name}-sidecar/ - this is our private space'

## Key Components

### Sidecar Files (CRITICAL)

Expert agents use companion files for persistence and domain knowledge:

**memories.md** - Persistent user context will be set up similar to as follows, of course with relevant sections that make sense.

```markdown
# Agent Memory Bank

## User Preferences

<!-- Learned from interactions -->

## Session History

<!-- Important moments and insights -->

## Personal Notes

<!-- Agent observations -->
```

**instructions.md** - Private directives

```markdown
# Agent Private Instructions

## Core Directives

- Maintain character consistency
- Domain boundaries: {specific domain}
- Access restrictions: Only sidecar folder

## Special Rules

<!-- Agent-specific protocols -->
```

**knowledge/** - Domain resources

```markdown
# Agent Knowledge Base

Add domain-specific documentation here.
```

### Critical Actions

**MANDATORY for expert agents** - These load sidecar files at activation:

```yaml
critical_actions:
  - 'Load COMPLETE file ./{sidecar}/memories.md and remember all past insights'
  - 'Load COMPLETE file ./{sidecar}/instructions.md and follow ALL protocols'
  - 'ONLY read/write files in ./{sidecar}/ - this is our private space'
```

**Key patterns:**

- **COMPLETE file loading** - Forces full file read, not partial
- **Domain restrictions** - Limits file access for privacy/security
- **Memory integration** - Past context becomes part of current session
- **Protocol adherence** - Ensures consistent behavior

## What Gets Injected at Compile Time

Same as simple agents, PLUS:

1. **Critical actions become numbered activation steps**

   ```xml
   <step n="4">Load COMPLETE file ./memories.md...</step>
   <step n="5">Load COMPLETE file ./instructions.md...</step>
   <step n="6">ONLY read/write files in ./...</step>
   ```

2. **Sidecar files copied during installation**
   - Entire sidecar folder structure preserved
   - Relative paths maintained
   - Files ready for agent use

## Reference Example

See: [journal-keeper/](https://github.com/bmad-code-org/BMAD-METHOD/tree/main/src/modules/bmb/reference/agents/expert-examples/journal-keeper)

Features demonstrated:

- Complete sidecar structure (memories, instructions, breakthroughs)
- Critical actions for loading persistent context
- Domain restrictions for privacy
- Pattern recognition and memory recall
- Handlebars-based personalization
- Menu actions that update sidecar files

## Installation

```bash
# Copy entire folder to your project
cp -r /path/to/journal-keeper/ _bmad/custom/agents/

# Install with personalization
bmad agent-install
```

The installer:

1. Detects expert agent (folder with .agent.yaml)
2. Prompts for personalization
3. Compiles agent YAML to XML-in-markdown
4. **Copies sidecar files to installation target**
5. Creates IDE slash commands
6. Saves source for reinstallation

## Memory Patterns

### Accumulative Memory

```yaml
menu:
  - trigger: save
    action: "Update ./sidecar/memories.md with today's session insights"
    description: 'Save session to memory'
```

### Reference Memory

```yaml
prompts:
  - id: recall
    content: |
      <instructions>
      Reference memories.md naturally:
      "Last week you mentioned..." or "I notice a pattern..."
      </instructions>
```

### Structured Insights

```yaml
menu:
  - trigger: insight
    action: 'Document in ./sidecar/breakthroughs.md with date, context, significance'
    description: 'Record meaningful insight'
```

## Domain Restriction Patterns that can be applied

### Single Folder Access

```yaml
critical_actions:
  - 'ONLY read/write files in ./sidecar/ - NO OTHER FOLDERS'
```

### User Space Access

If there were a private journal agent, you might want it to have something like this:
```yaml
critical_actions:
  - 'ONLY access files in {user-folder}/journals/ - private space'
```

### Read-Only Access

```yaml
critical_actions:
  - 'Load knowledge from ./knowledge/ but NEVER modify'
  - 'Write ONLY to ./sessions/'
```

## Best Practices

1. **Load sidecar files in critical_actions** - Must be explicit and MANDATORY
2. **Enforce domain restrictions** - Clear boundaries prevent scope creep=
3. **Design for memory growth** - Structure sidecar files for accumulation
4. **Reference past naturally** - Don't dump memory, weave it into conversation
5. **Separate concerns** - Memories, instructions, knowledge in distinct files
6. **Include privacy features** - Users trust expert agents with personal data
