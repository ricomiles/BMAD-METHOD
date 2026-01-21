# IDE Installer Standardization Plan

## Overview

Standardize IDE installers to use **flat file naming** and centralize duplicated code in shared utilities.

**Key Rule: Only folder-based IDEs convert to colon format. IDEs already using dashes keep using dashes.**

## Current State Analysis

### File Structure Patterns

| IDE | Current Pattern | Path Format |
|-----|-----------------|-------------|
| **claude-code** | Hierarchical | `.claude/commands/bmad/{module}/agents/{name}.md` |
| **cursor** | Hierarchical | `.cursor/commands/bmad/{module}/agents/{name}.md` |
| **crush** | Hierarchical | `.crush/commands/bmad/{module}/agents/{name}.md` |
| **antigravity** | Flattened (dashes) | `.agent/workflows/bmad-module-agents-name.md` |
| **codex** | Flattened (dashes) | `~/.codex/prompts/bmad-module-agents-name.md` |
| **cline** | Flattened (dashes) | `.clinerules/workflows/bmad-module-type-name.md` |
| **roo** | Flattened (dashes) | `.roo/commands/bmad-{module}-agent-{name}.md` |
| **auggie** | Hybrid | `.augment/commands/bmad/agents/{module}-{name}.md` |
| **iflow** | Hybrid | `.iflow/commands/bmad/agents/{module}-{name}.md` |
| **trae** | Different (rules) | `.trae/rules/bmad-agent-{module}-{name}.md` |
| **github-copilot** | Different (agents) | `.github/agents/bmd-custom-{module}-{name}.agent.md` |

### Shared Generators (in `/shared`)

1. `agent-command-generator.js` - generates agent launchers
2. `task-tool-command-generator.js` - generates task/tool commands
3. `workflow-command-generator.js` - generates workflow commands

All currently create artifacts with **nested relative paths** like `{module}/agents/{name}.md`

### Code Duplication Issues

1. **Flattening logic** duplicated in multiple IDEs
2. **Agent launcher content creation** duplicated
3. **Path transformation** duplicated

## Target Standardization

### For Folder-Based IDEs (convert to colon format)

**IDEs affected:** claude-code, cursor, crush

```
Format: bmad:{module}:{type}:{name}.md

Examples:
- Agent:      bmad:bmm:agents:pm.md
- Agent:      bmad:core:agents:dev.md
- Workflow:   bmad:bmm:workflows:correct-course.md
- Task:       bmad:bmm:tasks:whats-after.md
- Tool:       bmad:core:tools:code-review.md
- Custom:     bmad:custom:agents:fred-commit-poet.md
```

### For Already-Flat IDEs (keep using dashes)

**IDEs affected:** antigravity, codex, cline, roo

```
Format: bmad-{module}-{type}-{name}.md

Examples:
- Agent:      bmad-bmm-agents-pm.md
- Workflow:   bmad-bmm-workflows-correct-course.md
- Task:       bmad-bmm-tasks-whats-after.md
- Custom:     bmad-custom-agents-fred-commit-poet.md
```

### For Hybrid IDEs (keep as-is)

**IDEs affected:** auggie, iflow

These use `{module}-{name}.md` format within subdirectories - keep as-is.

### Skip (drastically different)

**IDEs affected:** trae, github-copilot

## Implementation Plan

### Phase 1: Create Shared Utility

**File:** `shared/path-utils.js`

```javascript
/**
 * Convert hierarchical path to flat colon-separated name (for folder-based IDEs)
 * @param {string} module - Module name (e.g., 'bmm', 'core')
 * @param {string} type - Artifact type ('agents', 'workflows', 'tasks', 'tools')
 * @param {string} name - Artifact name (e.g., 'pm', 'correct-course')
 * @returns {string} Flat filename like 'bmad:bmm:agents:pm.md'
 */
function toColonName(module, type, name) {
  return `bmad:${module}:${type}:${name}.md`;
}

/**
 * Convert relative path to flat colon-separated name (for folder-based IDEs)
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @returns {string} Flat filename like 'bmad:bmm:agents:pm.md'
 */
function toColonPath(relativePath) {
  const withoutExt = relativePath.replace('.md', '');
  const parts = withoutExt.split(/[\/\\]/);
  return `bmad:${parts.join(':')}.md`;
}

/**
 * Convert hierarchical path to flat dash-separated name (for flat IDEs)
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @returns {string} Flat filename like 'bmad-bmm-agents-pm.md'
 */
function toDashPath(relativePath) {
  const withoutExt = relativePath.replace('.md', '');
  const parts = withoutExt.split(/[\/\\]/);
  return `bmad-${parts.join('-')}.md`;
}

/**
 * Create custom agent colon name
 * @param {string} agentName - Custom agent name
 * @returns {string} Flat filename like 'bmad:custom:agents:fred-commit-poet.md'
 */
function customAgentColonName(agentName) {
  return `bmad:custom:agents:${agentName}.md`;
}

/**
 * Create custom agent dash name
 * @param {string} agentName - Custom agent name
 * @returns {string} Flat filename like 'bmad-custom-agents-fred-commit-poet.md'
 */
function customAgentDashName(agentName) {
  return `bmad-custom-agents-${agentName}.md`;
}

module.exports = {
  toColonName,
  toColonPath,
  toDashPath,
  customAgentColonName,
  customAgentDashName,
};
```

### Phase 2: Update Shared Generators

**Files to modify:**
- `shared/agent-command-generator.js`
- `shared/task-tool-command-generator.js`
- `shared/workflow-command-generator.js`

**Changes:**
1. Import path utilities
2. Change `relativePath` to use flat format
3. Add method `writeColonArtifacts()` for folder-based IDEs
4. Add method `writeDashArtifacts()` for flat IDEs

### Phase 3: Update Folder-Based IDEs

**Files to modify:**
- `claude-code.js`
- `cursor.js`
- `crush.js`

**Changes:**
1. Import `toColonPath`, `customAgentColonName` from path-utils
2. Change from hierarchical to flat colon naming
3. Update cleanup to handle flat structure

### Phase 4: Update Flat IDEs

**Files to modify:**
- `antigravity.js`
- `codex.js`
- `cline.js`
- `roo.js`

**Changes:**
1. Import `toDashPath`, `customAgentDashName` from path-utils
2. Replace local `flattenFilename()` with shared `toDashPath()`

### Phase 5: Update Base Class

**File:** `_base-ide.js`

**Changes:**
1. Mark `flattenFilename()` as `@deprecated`
2. Add comment pointing to new path-utils

## Migration Checklist

### New Files
- [ ] Create `shared/path-utils.js`

### Folder-Based IDEs (convert to colon format)
- [ ] Update `shared/agent-command-generator.js` - add `writeColonArtifacts()`
- [ ] Update `shared/task-tool-command-generator.js` - add `writeColonArtifacts()`
- [ ] Update `shared/workflow-command-generator.js` - add `writeColonArtifacts()`
- [ ] Update `claude-code.js` - convert to colon format
- [ ] Update `cursor.js` - convert to colon format
- [ ] Update `crush.js` - convert to colon format

### Flat IDEs (standardize dash format)
- [ ] Update `shared/agent-command-generator.js` - add `writeDashArtifacts()`
- [ ] Update `shared/task-tool-command-generator.js` - add `writeDashArtifacts()`
- [ ] Update `shared/workflow-command-generator.js` - add `writeDashArtifacts()`
- [ ] Update `antigravity.js` - use shared `toDashPath()`
- [ ] Update `codex.js` - use shared `toDashPath()`
- [ ] Update `cline.js` - use shared `toDashPath()`
- [ ] Update `roo.js` - use shared `toDashPath()`

### Base Class
- [ ] Update `_base-ide.js` - add deprecation notice

### Testing
- [ ] Test claude-code installation
- [ ] Test cursor installation
- [ ] Test crush installation
- [ ] Test antigravity installation
- [ ] Test codex installation
- [ ] Test cline installation
- [ ] Test roo installation

## Notes

1. **Keep segments**: agents, workflows, tasks, tools all become part of the flat name
2. **Colon vs Dash**: Colons for folder-based IDEs converting to flat, dashes for already-flat IDEs
3. **Custom agents**: Follow the same pattern as regular agents
4. **Backward compatibility**: Cleanup will remove old folder structure
