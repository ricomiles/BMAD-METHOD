# Installing Your Custom Agent

Your agent YAML file is a template that gets compiled to a runnable Markdown (.md) file with XML.

**Good news**: You can install agents without cloning the BMAD repository using `npx bmad-method`!

## Installation Options

### Option 1: Interactive Install (Recommended)

```bash
# From your BMAD project directory
# Option A: If you have BMAD installed locally
bmad agent-install

# Option B: If you don't have BMAD cloned (works anywhere!)
npx bmad-method agent-install

# Follow the prompts to select and install your agent
```

**Best for**: Installing individual agents with custom naming and target selection

### Option 2: Batch Install

1. **Copy** your agent YAML to `{project}/.bmad/custom/src/agents/`
2. **Run** the installer and select "Compile Agents (Quick rebuild of all agent .md files)"

**Best for**: Installing multiple agents at once or rebuilding all custom agents

## What Happens During Installation

1. **Source**: Your agent YAML (from `custom/src/agents/`)
2. **Compile**: Gets converted to executable .md format
3. **Install**: Copied to `custom/agents/{agent-name}/`
4. **Register**: Added to agent manifest and IDE commands
5. **Backup**: Source saved to `_cfg/custom/agents/` for updates

## Automatic Updates

**For individual agents**:

```bash
bmad agent-install              # If BMAD installed locally
npx bmad-method agent-install    # Works anywhere without cloning
```

**For all agents (including custom ones)**:

- `bmad install` → "Compile Agents" (rebuild all agents)
- `bmad install` → "Quick Update" (during upgrades)

**When to use which**:

- **Option 1**: Best for new agents or when you want custom persona names
- **Option 2**: Best for bulk updates or when you've modified YAML files directly

## File Structure

```
custom/
├── src/agents/          # Your source YAMLs (BMB builder output)
└── agents/              # Installed compiled agents
    └── my-agent/
        └── my-agent.md  # Runnable agent

_cfg/custom/agents/      # Backup copies for updates
```

## Target Projects

You can install agents to:

- Current project (default)
- Any other BMAD project on your system
- Custom directory (for sharing agents)
