# Custom Agent Installation

BMAD agents and workflows are now installed through the main CLI installer using a `custom.yaml` configuration file or by having an installer file.

## Quick Start

Create a `custom.yaml` file in the root of your agent/workflow folder:

```yaml
code: my-custom-agent
name: 'My Custom Agent'
default_selected: true
```

Then run the BMAD installer from your project directory:

```bash
npx bmad-method install
```

Or if you have bmad-cli installed globally:

```bash
bmad install
```

## Installation Methods

### Method 1: Stand-alone Folder with custom.yaml

Place your agent or workflow in a folder with a `custom.yaml` file at the root:

```
my-agent/
├── custom.yaml      # Required configuration file
├── my-agent.agent.yaml
└── sidecar/         # Optional
    └── instructions.md
```

### Method 2: Installer File

For more complex installations, include an `installer.js` or `installer.yaml` file in your agent/workflow folder:

```
my-workflow/
├── workflow.md
└── installer.yaml   # Custom installation logic
```

## What It Does

1. **Discovers** available agents and workflows from folders with `custom.yaml`
2. **Installs** to your project's `.bmad/custom/` directory
3. **Creates** IDE commands for all your configured IDEs (Claude Code, Codex, Cursor, etc.)
4. **Registers** the agent/workflow in the BMAD system

## Example custom.yaml

```yaml
code: my-custom-agent
name: 'My Custom Agent'
default_selected: true
```

## Installing Reference Agents

The BMAD source includes example agents you can install. **You must copy them to your project first.**

### Step 1: Copy the Agent Template

**For simple agents** (single file):

```bash
# From your project root
mkdir -p .bmad/custom/agents/my-agent
cp node_modules/bmad-method/src/modules/bmb/reference/agents/stand-alone/commit-poet.agent.yaml \
   .bmad/custom/agents/my-agent/
```

**For expert agents** (folder with sidecar files):

```bash
# Copy the entire folder
cp -r node_modules/bmad-method/src/modules/bmb/reference/agents/agent-with-memory/journal-keeper \
   .bmad/custom/agents/
```

### Step 2: Create custom.yaml

```bash
# In the agent folder, create custom.yaml
cat > .bmad/custom/agents/my-agent/custom.yaml << EOF
code: my-agent
name: "My Custom Agent"
default_selected: true
EOF
```

### Step 3: Install

```bash
npx bmad-method install
# or: bmad install (if BMAD installed locally)
```

The installer will:

1. Find the agent with its `custom.yaml`
2. Install it to the appropriate location
3. Create IDE commands for immediate use

### Available Reference Agents

**Simple (standalone file):**

- `commit-poet.agent.yaml` - Commit message artisan with style preferences

**Expert (folder with sidecar):**

- `journal-keeper/` - Personal journal companion with memory and pattern recognition

Find these in the BMAD source:

```
src/modules/bmb/reference/agents/
├── stand-alone/
│   └── commit-poet.agent.yaml
└── agent-with-memory/
    └── journal-keeper/
        ├── journal-keeper.agent.yaml
        └── journal-keeper-sidecar/
```

## Creating Your Own

Use the BMB agent builder to craft your agents. Once ready to use, place your `.agent.yaml` files or folders with `custom.yaml` in `.bmad/custom/agents/` or `.bmad/custom/workflows/`.
