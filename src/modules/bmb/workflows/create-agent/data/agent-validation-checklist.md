# BMAD Agent Validation Checklist

Use this checklist to validate agents meet BMAD quality standards, whether creating new agents or editing existing ones.

## YAML Structure Validation (Source Files)

- [ ] YAML parses without errors
- [ ] `agent.metadata` includes: `id`, `name`, `title`, `icon`, `module`
- [ ] `agent.metadata.module` can me a module code (e.g., `bmm`, `bmgd`, `cis`) or listed as stand-alone
- [ ] `agent.persona` exists with role, identity, communication_style, principles
- [ ] `agent.menu` exists with at least one item
- [ ] Filename is kebab-case and is named like `<role>.agent.yaml`

## Agent Structure Validation

- [ ] Agent file format is valid (.agent.yaml for source)
- [ ] Agent type matches structure: Simple (single YAML), Expert (sidecar files), or Module (ecosystem integration)
- [ ] File naming follows convention: `{agent-name}.agent.yaml`
- [ ] If Expert: folder structure with .agent.yaml + sidecar files
- [ ] If Module: includes header comment explaining WHY Module Agent (design intent)

## Persona Validation (CRITICAL - #1 Quality Issue)

**Field Separation Check:**

- [ ] **role** contains ONLY knowledge/skills/capabilities (what agent does)
- [ ] **identity** contains ONLY background/experience/context (who agent is)
- [ ] **communication_style** contains ONLY verbal patterns - NO behaviors, NO role statements, NO principles
- [ ] **principles** contains operating philosophy and behavioral guidelines

**Communication Style Purity Check:**

- [ ] Communication style does NOT contain red flag words: "ensures", "makes sure", "always", "never"
- [ ] Communication style does NOT contain identity words: "experienced", "expert who", "senior", "seasoned"
- [ ] Communication style does NOT contain philosophy words: "believes in", "focused on", "committed to"
- [ ] Communication style does NOT contain behavioral descriptions: "who does X", "that does Y"
- [ ] Communication style is 1-2 sentences describing HOW they talk and emote (word choice, quirks, verbal patterns)

**Quality Benchmarking:**

- [ ] Compare communication style against {communication_presets} - similarly pure?
- [ ] Compare against reference agents (commit-poet, journal-keeper, BMM agents) - similar quality?
- [ ] Read communication style aloud - does it sound like describing someone's voice/speech pattern?

## Menu Validation

- [ ] All menu items have `trigger` field
- [ ] Each item has `description` field
- [ ] Each menu item has at least one handler attribute: `exec` or `action`
- [ ] Workflow paths are correct (if workflow attribute present)
- [ ] Workflow paths start with `{project-root}/_bmad/<module-name>/...` variable for portability
- [ ] **Sidecar file paths are correct (if tmpl or data attributes present - Expert agents)**
- [ ] No duplicate triggers within same agent
- [ ] Menu items are in logical order

## Prompts Validation (if present)

- [ ] Each prompt has `id` field
- [ ] Each prompt has `content` field
- [ ] Prompt IDs are unique within agent
- [ ] If using `action="#prompt-id"` in menu, corresponding prompt exists

## Critical Actions Validation (if present)

- [ ] Critical actions array contains non-empty strings
- [ ] Critical actions describe steps that MUST happen during activation
- [ ] No placeholder text in critical actions
- [ ] Does not have any of the following that are injected at build time:
  - Load persona from this current agent file
  - Load config to get {user_name}, {communication_language}
  - Remember: user's name is {user_name}
  - ALWAYS communicate in {communication_language}
  - Show greeting + numbered menu
  - STOP and WAIT for user input

## Type-Specific Validation

### Simple Agent (Self-Contained)

- [ ] Single .agent.yaml file with complete agent definition
- [ ] No sidecar files (all content in YAML)
- [ ] Not capability-limited - can be as powerful as Expert or Module
- [ ] Compare against reference: commit-poet.agent.yaml

### Expert Agent (With Sidecar Files)

- [ ] Folder structure: .agent.yaml + sidecar files
- [ ] Sidecar files properly referenced in menu items or prompts (tmpl="path", data="path")
- [ ] Folder name matches agent purpose
- [ ] **All sidecar references in YAML resolve to actual files**
- [ ] **All sidecar files are actually used (no orphaned/unused files, unless intentional for future use)**
- [ ] Sidecar files are valid format (YAML parses, CSV has headers, markdown is well-formed)
- [ ] Sidecar file paths use relative paths from agent folder
- [ ] Templates contain valid template variables if applicable
- [ ] Knowledge base files contain current/accurate information
- [ ] Compare against reference: journal-keeper (Expert example)

### Module Agent (Ecosystem Integration)

- [ ] Designed FOR specific module (BMM, BMGD, CIS, etc.)
- [ ] Integrates with module workflows (referenced in menu items)
- [ ] Coordinates with other module agents (if applicable)
- [ ] Included in module's default bundle (if applicable)
- [ ] Header comment explains WHY Module Agent (design intent, not just location)
- [ ] Can be Simple OR Expert structurally (Module is about intent, not structure)
- [ ] Compare against references: security-engineer, dev, analyst (Module examples)

## Quality Checks

- [ ] No broken references or missing files
- [ ] Syntax is valid yaml
- [ ] Indentation is consistent
- [ ] Agent purpose is clear from reading persona alone
- [ ] Agent name/title are descriptive and clear
- [ ] Icon emoji is appropriate and represents agent purpose

## Reference Standards

Your agent should meet these quality standards:

✓ Persona fields properly separated (communication_style is pure verbal patterns)
✓ Agent type matches structure (Simple/Expert/Module)
✓ All workflow/sidecar paths resolve correctly
✓ Menu structure is clear and logical
✓ No legacy terminology (full/hybrid/standalone)
✓ Comparable quality to reference agents (commit-poet, journal-keeper, BMM agents)
✓ Communication style has ZERO red flag words
✓ Compiles cleanly to XML without errors

## Common Issues and Fixes

### Issue: Communication Style Has Behaviors

**Problem:** "Experienced analyst who ensures all stakeholders are heard"
**Fix:** Extract to proper fields:

- identity: "Senior analyst with 8+ years..."
- communication_style: "Speaks like a treasure hunter"
- principles: "Ensure all stakeholder voices heard"

### Issue: Broken Sidecar References (Expert agents)

**Problem:** Menu item references `tmpl="templates/daily.md"` but file doesn't exist
**Fix:** Either create the file or fix the path to point to actual file
