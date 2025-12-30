# Understanding Agent Types: Simple VS Expert VS Module

## ALL agent types can:

- Read, Use and Write to loaded variables destinations
  - Example module variables {output_folder}, {communication_language}, {user_preference_foo}, etc..
- Update created artifacts and files
   Execute commands and take actions
- Invoke external tools
- Optionally restrict what the agent can and cannot read or modify.
  - Example, a performance review agent may only have access to read from a employee data folder and write to a performance eval folder
- All Agent types can use anything available in the core module and their menu items will offer them as option upon build automatically, including party-mode (group agent chat), agent chat mode and the ability to integrate advanced elicitation and brainstorming.

## The Difference Between the 3 types

### Simple Agent

- Everything the agent needs to know to be useful is in the single file
  - No External Skills or Workflows
  - No persistent memory
  - Specialized Knowledge needed will not change frequently
  - each agent menu item handler can be described in a few sentence prompt or a short 5-15 line prompt loaded in the same file.
  - Generally rely on minimal specification of actions it can take, relying on the LLM agent to fill in the blanks.
  - All specialized knowledge can be self contained in the agent file, still keeping the overall size of the file less than about 250 lines.

<examples type=simple-agent>
- Comedian Joke Agent - has a funny or interesting persona, stays in character, offers some menu options for telling jokes or helping user craft jokes, all with prompts for those items being small, with the whole file being less than 250 lines.
- Specific Type of Document Creation and Review Agent - persona matches the features you would like in this real. Much of the knowledge about the types of documents you will create and review are common LLM knowledge, document creation and review guardrails you would like to add will not change frequently and can be expressed in under 30-40 lines.
- ./reference/simple-examples/commit-poet.agent.yaml
</examples>

### Expert Agent

- Includes all capabilities and features of Simple Agent, but adds a sidecar folder to allow for:
  - Custom Workflow, Prompts and Skill available to load on demand.
    - This allows for potentially very large multi step multi file workflows that can be only loaded when the user requests them. This keeps the agent and context overhead lean.
  - Persistent memory - agent can load a log every time on startup to know what has transpired or has been learned from past sessions
    - Persistent Memory can allow for agents to grown, evolve and even change personality or capabilities over time
  - Custom Data and Knowledge files that can be accessed and loaded on demand.

<examples type=complex-agent>
- Journal Keeper Agent
  - ./data/reference/expert-examples/journal-keeper/journal-keeper.agent.yaml
  - ./data/reference/expert-examples/journal-keeper/journal-keeper-sidecar/*.*
  - When starting the Journal Keeper, it greets you, remembers past sessions offering to continue one, discuss the past, or start new.
  - When working with you on new journals, will offer insights based on previous discussions, memories and journal entries.

- Tax Expert
  - Agent is specialized to your specific tax needs
  - Has a sidecar folder of specific tax forms
  - Retains records of past guidance or rules you have given it to further augment its capabilities

- Your Specific Job Augmentation Expert
  - Known the many aspects of your specific job and can help with many functions and asks to augment your day and responsibilities
  - Knows about your past meetings and highlights
  - Knows about who you work with and interact with, offering suggestions
  - Has workflows that help automate or help with very specific job functions you have
  - Can help with research while already having context about your role, company, specific product or job function
  - Can track and help you compile year end or quarterly achievements to help with year end reviews, promotions etc...

- Therapy Agent
  - Can be similar to the Journal Keeper, but have menu items for various techniques or areas to cover - data and output memories are all retained in local files so you can have access to and analyze past sessions.
</examples>

### Module Agent

- As teh capabilities and what a single agent can do grows - it might make sense to consider instead creating a module with the bmad builders module workflow and split up multiple agents instead of 1 massive agent that tries to be every role and persona and do it all. Another option is that an existing module has a gap, and it makes sense to allow a new agent to be integrated with that module.
- Module agents are able to do EVERYTHING the prior agent types had, including side cars and memory - but additionally can utilize global module workflows. This basically means that there are workflows or skills that can be used that the user might also choose to just run on their own, or other agents might use them.

<examples>
- ./data/reference/module-examples/security-engineer.agent.yaml
  - This is a module agent a user might create to add on to the existing BMad Method Module (bmm) - the bmad method module is all about agents and workflows working together dedicated to ideating and building software solutions through agile processes. There is already an Analyst, PM, Architect and Dev Agent. But the user might identify the need for a security-engineer.agent.yaml. So by creating this as a module agent for an existing module, a user can choose to install this and gain all capabilities of the bmad method itself - and also build this agent to user or even require inputs to or output from other agents. For example, this agent might require as input to produce a security review report, an architecture document produced by the bmm architecture agent.
</examples>

## The Same Agent, Three Ways

**Scenario:** Code Generator Agent

### As Simple Agent

```yaml
agent:
  metadata:
    id: +_bmad/my-custom-agents/code-gen.agent.md"
    name: Randy Moss
    title: "Code Gen Expert"
    icon: "📔"
    module: stand-alone

  prompts:
    - id: code-generate
      content: |
        Ask user for spec details. Generate code.
        Write to {output_folder}/generated/

  menu:
    - trigger: GC or fuzzy match on code-generate
      action: '#code-generate'
      description: "[GC] Generate code from spec"
```

### As Expert Agent

```yaml
agent:
  metadata:
    id: "_bmad/my-custom-agents/code-gen.agent.md"
    name: Randy Moss
    title: "Code Gen Expert"
    icon: "📔"
    module: stand-alone
    hasSidecar: true

  critical_actions:
    - Load my coding standards from ./code-gen-sidecar/knowledge/
    - Load memories from ./code-gen-sidecar/memories.md
    - RESTRICT: Only operate within sidecar folder
  
  menu:
    - trigger: GC or fuzzy match on code-generate
      exec: './code-gen-sidecar/workflows/code-gen/workflow.md'
      description: "[GC] Generate code from spec"
```

### As Module Agent (Architecture: Team integration)

```yaml
agent:
  metadata:
    id: "_bmad/bmm/code-gen.agent.md"
    name: Randy Moss
    title: "Code Gen Expert"
    icon: "📔"
    module: bmm
    hasSidecar: true

  menu:
    - trigger: implement-story
      workflow: '_bmad/bmm/workflows/dev-story/workflow.yaml'
      description: Implement user story

    - trigger: refactor
      workflow: '_bmad/bmm/workflows/refactor/workflow.yaml'
      description: Refactor codebase
```

## Choosing Your Agent Type

### Choose Simple when:

- Single-purpose utility (no memory needed)
- Stateless operations (each run is independent)
- Self-contained logic (everything in YAML and total file size < )
- No persistent context required

### Choose Expert when:

- Need to remember things across sessions
- Personal knowledge base (user preferences, domain data)
- Domain-specific expertise with restricted scope
- Learning/adapting over time
- Complex multi-step workflows and actions that need to be explicitly set

### Choose Module when:

- Designed FOR a specific module ecosystem (BMM, CIS, etc.)
- Uses or contributes that module's workflows
- Coordinates with other module agents
- Will be included in module's default bundle
- Part of professional team infrastructure

## Final Selection Tips.

- If user is unsure between Simple or Expert - User the Expert Agent, its more performant.
- If an agent sounds like it would benefit from multiple personas, skill sets and many workflows - suggest the user create a module - if not though, most likely an expert agent.
- If any capabilities of an agent rely on details sequenced skills or workflows, use an expert instead of simple.
- If the agent has capabilities that rely on inputs or outputs to and from agents or workflows in another module, suggest an expert-module or simple-module agent.
- When adding to a module, the distinction of using simple for expert for the agent being added or used with a module is will it need private memory and learning/evolving capabilities.

All three types are equally powerful. The difference is how they manage state, where they store data, and how they integrate with your system.
