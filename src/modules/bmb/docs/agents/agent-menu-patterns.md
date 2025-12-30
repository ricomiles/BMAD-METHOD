# BMAD Agent Menu Patterns

Design patterns for agent menus in YAML source files.

## Menu Structure

Agents define menus in YAML, with triggers to know when to fire, a handler that knows the path or instruction of what the menu item does, and a description which is a display field for the agent. exec

### Menu Item Rules

- At a minimum, every menu item will have in the yaml the keys `trigger`, [handler], and `description`. A menu can also have an optional `data` key.
  - the handler key will be either `action` or `exec`.
- The Description value always starts with a unique (for this agent) 2 letter code in brackets along with the display text for the menu item.
  - The 2 letter code CANNOT be the following reserved codes: [MH], [CH], [PM], [DA]
- the trigger is always in the format `XY or fuzzy match on action-name` - XY being the items 2 letter code and action-name being what user will generally request by reading the description

```yaml
menu:
  - trigger: AN or fuzzy match on action-name
    [handler]: [value]
    data: optional field reference to a file to pass to the handlers workflow, some workflows take data inputs
    description: '[AN] Menu display for Action Name'
```

## Handler Types

### 1. Action Handler (Prompts & Inline)

For agents that are not part of a module or its a very simple operation that can be defined within the agent file, action is used.

<example>
**Reference to Prompt ID:**

```yaml
prompts:
  - id: analyze-code
    content: |
      <instructions>
      Analyze the provided code for patterns and issues.
      </instructions>

      <process>
      1. Identify code structure
      2. Check for anti-patterns
      3. Suggest improvements
      </process>

menu:
  - trigger: analyze
    action: '#analyze-code'
    description: 'Analyze code patterns'
```
</example>

**Inline Instruction:**

```yaml
menu:
  - trigger: quick-check
    action: |
      <instructions>
      Analyze the provided code for patterns and issues.
      </instructions>

      <process>
      1. Identify code structure
      2. Check for anti-patterns
      3. Suggest improvements
      </process>
    description: 'Quick syntax check'
```

**When to Use:**

- Simple/Expert agents with self-contained operations
- `#id` for complex, multi-step prompts
- Inline text for simple, one-line instructions

### 2. Workflow Handler

For module agents referencing module workflows (muti-step complex workflows loaded on demand).

```yaml
menu:
  - trigger: CP or fuzzy match on create-prd
    exec: '{project-root}/_bmad/bmm/workflows/prd/workflow.md'
    description: '[CP] Create Product Requirements Document (PRD)'

  - trigger: GB or fuzzy match on guided-brainstorming
    exec: '{project-root}/_bmad/core/workflows/brainstorming/workflow.yaml'
    description: '[GB] Guided brainstorming session'

  # Placeholder for unimplemented workflows
  - trigger: FF or fuzzy match on future-feature
    exec: 'todo'
    description: '[FF] Coming soon Future Feature'
```

**When to Use:**

- Module agents with workflow integration
- Multi-step document generation
- Complex interactive processes
- Use "todo" for planned but unimplemented features

### 3. Exec Handler

For executing tasks directly.

```yaml
menu:
  - trigger: validate
    exec: '{project-root}/_bmad/core/tasks/validate-workflow.xml'
    description: 'Validate document structure'

  - trigger: advanced-elicitation
    exec: '{project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml'
    description: 'Advanced elicitation techniques'
```

**When to Use:**

- Single-operation tasks
- Core system operations
- Utility functions

### 5. Data Handler

Universal attribute for supplementary information.

```yaml
menu:
  - trigger: TS or fuzzy match team-standup or daily standup
    exec: '{project-root}/_bmad/bmm/tasks/team-standup.md'
    data: '{project-root}/_bmad/_config/agent-manifest.csv'
    description: '[TS] Run team standup'

  - trigger: AM or fuzzy match on analyze-metrics
    action: 'Analyze these metrics and identify trends'
    data: '{project-root}/_data/metrics.json'
    description: '[AM] Analyze performance metrics'
```

**When to Use:**

- Add to ANY handler type
- Reference data files (CSV, JSON, YAML)
- Provide context for operations

## Platform-Specific Menus

Control visibility based on deployment target:

```yaml
menu:
  - trigger: git-flow
    exec: '{project-root}/_bmad/bmm/tasks/git-flow.xml'
    description: 'Git workflow operations'
    ide-only: true # Only in IDE environments

  - trigger: advanced-elicitation
    exec: '{project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml'
    description: 'Advanced elicitation'
    web-only: true # Only in web bundles
```

## Prompts Section (generally for agents that are not using external workflows)

### Prompt Structure

```yaml
prompts:
  - id: unique-identifier
    content: |
      <goal> What the prompt achieves </goal>
      <instructions>
        Step 1: Foo
        Step 2: Bar
        ...
      </instructions>
      <example> </example>
      etc...
```

### Semantic XML Tags in Prompts

Use XML tags to structure prompt content such as:

- `<goal>` - What to do
- `<instructions>` - Step-by-step approach
- `<output_format>` - Expected results
- `<example>` - Sample outputs

## Path Variables

### Always Use Variables

```yaml
# GOOD - Portable paths
exec: "{project-root}/_bmad/core/tasks/validate.xml"
data: "{project-root}/_data/metrics.csv"

# BAD - Hardcoded paths
exec: "../../../core/tasks/validate.xml"
```

### Available Variables

- `{project-root}` - Project root directory
- `{output_folder}` - Document output location
- `{user_name}` - User's name from config
- `{communication_language}` - Language preference

## Complete Examples

### Simple Agent Menu

```yaml
prompts:
  - id: format-code
    content: |
      <instructions>
      Format the provided code according to style guidelines.
      </instructions>

      Apply:
      - Consistent indentation
      - Proper spacing
      - Clear naming conventions

menu:
  - trigger: format
    action: '#format-code'
    description: 'Format code to style guidelines'

  - trigger: lint
    action: 'Check code for common issues and anti-patterns'
    description: 'Lint code for issues'

  - trigger: suggest-improvements
    action: >
      Suggest improvements for code that is not yet comitted:
        - style improvements
        - deviations from **/project-context.md
    description: 'Suggest improvements'
```

### Expert Agent Menu

```yaml
critical_actions:
  - 'Load ./memories.md'
  - 'Follow ./instructions.md'
  - 'ONLY access ./'

prompts:
  - id: reflect
    content: |
      Guide {{user_name}} through reflection on recent entries.
      Reference patterns from memories.md naturally.

menu:
  - trigger: write
    action: '#reflect'
    description: 'Write journal entry'

  - trigger: save
    action: 'Update ./memories.md with session insights'
    description: "Save today's session"

  - trigger: patterns
    action: 'Analyze recent entries for recurring themes'
    description: 'View patterns'
```

### Module Agent Menu

```yaml
menu:
  - trigger: workflow-init
    exec: '{project-root}/_bmad/bmm/workflows/workflow-status/init/workflow.md'
    description: 'Initialize workflow path (START HERE)'

  - trigger: brainstorm
    exec: '{project-root}/_bmad/bmm/workflows/1-analysis/brainstorm/workflow.md'
    description: 'Guided brainstorming'

  - trigger: prd
    exec: '{project-root}/_bmad/bmm/workflows/2-planning/prd/workflow.md'
    description: 'Create PRD'

  - trigger: architecture
    exec: '{project-root}/_bmad/bmm/workflows/2-planning/architecture/workflow.md'
    description: 'Design architecture'
```
