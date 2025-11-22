# Custom Agent Installation

## Quick Install

```bash
# Interactive
npx bmad-method agent-install

# Non-interactive
npx bmad-method agent-install --defaults
```

## Install Specific Agent

```bash
# From specific source file
npx bmad-method agent-install --source ./my-agent.agent.yaml

# With default config (no prompts)
npx bmad-method agent-install --source ./my-agent.agent.yaml --defaults

# To specific destination
npx bmad-method agent-install --source ./my-agent.agent.yaml --destination ./my-project
```

## Batch Install

1. Copy agent YAML to `.bmad/custom/src/agents/`
2. Run installer and select "Compile Agents"

## What Happens

1. Source YAML compiled to .md
2. Installed to `custom/agents/{agent-name}/`
3. Added to agent manifest
4. Backup saved to `_cfg/custom/agents/`
