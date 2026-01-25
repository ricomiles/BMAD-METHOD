const path = require('node:path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { BaseIdeSetup } = require('./_base-ide');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');

/**
 * Rovo Dev IDE setup handler
 *
 * Uses UnifiedInstaller for all artifact installation with flat file structure.
 * All BMAD artifacts are installed to .rovodev/workflows/ as flat files.
 */
class RovoDevSetup extends BaseIdeSetup {
  constructor() {
    super('rovo-dev', 'Atlassian Rovo Dev', false);
    this.configDir = '.rovodev';
    this.workflowsDir = 'workflows';
  }

  /**
   * Setup Rovo Dev configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Clean up old BMAD installation first
    await this.cleanup(projectDir);

    // Create .rovodev directory structure
    const rovoDevDir = path.join(projectDir, this.configDir);
    const workflowsDir = path.join(rovoDevDir, this.workflowsDir);

    await this.ensureDir(workflowsDir);

    // Use the unified installer - all artifacts go to workflows folder as flat files
    const installer = new UnifiedInstaller(this.bmadFolderName);
    const counts = await installer.install(
      projectDir,
      bmadDir,
      {
        targetDir: workflowsDir,
        namingStyle: NamingStyle.FLAT_DASH,
        templateType: TemplateType.CLAUDE,
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents installed`));
    if (counts.workflows > 0) {
      console.log(chalk.dim(`  - ${counts.workflows} workflows installed`));
    }
    if (counts.tasks + counts.tools > 0) {
      console.log(chalk.dim(`  - ${counts.tasks + counts.tools} tasks/tools installed (${counts.tasks} tasks, ${counts.tools} tools)`));
    }
    console.log(chalk.dim(`  - ${counts.total} files written to ${path.relative(projectDir, workflowsDir)}`));
    console.log(chalk.yellow(`\n  Note: All BMAD items are available in .rovodev/workflows/`));
    console.log(chalk.dim(`  - Access items by typing @ in Rovo Dev to see available files`));

    return {
      success: true,
      ...counts,
    };
  }

  /**
   * Cleanup old BMAD installation before reinstalling
   * @param {string} projectDir - Project directory
   */
  async cleanup(projectDir) {
    const rovoDevDir = path.join(projectDir, this.configDir);

    if (!(await fs.pathExists(rovoDevDir))) {
      return;
    }

    // Clean BMAD files from workflows directory
    const workflowsDir = path.join(rovoDevDir, this.workflowsDir);
    if (await fs.pathExists(workflowsDir)) {
      const entries = await fs.readdir(workflowsDir);
      const bmadFiles = entries.filter((file) => file.startsWith('bmad') && file.endsWith('.md'));

      for (const file of bmadFiles) {
        await fs.remove(path.join(workflowsDir, file));
      }
    }

    // Remove legacy subagents directory
    const subagentsDir = path.join(rovoDevDir, 'subagents');
    if (await fs.pathExists(subagentsDir)) {
      await fs.remove(subagentsDir);
      console.log(chalk.dim(`  Removed legacy subagents directory`));
    }

    // Remove legacy references directory
    const referencesDir = path.join(rovoDevDir, 'references');
    if (await fs.pathExists(referencesDir)) {
      await fs.remove(referencesDir);
      console.log(chalk.dim(`  Removed legacy references directory`));
    }
  }

  /**
   * Detect whether Rovo Dev is already configured in the project
   * @param {string} projectDir - Project directory
   * @returns {boolean}
   */
  async detect(projectDir) {
    const rovoDevDir = path.join(projectDir, this.configDir);

    if (!(await fs.pathExists(rovoDevDir))) {
      return false;
    }

    // Check for BMAD files in workflows directory
    const workflowsDir = path.join(rovoDevDir, this.workflowsDir);
    if (await fs.pathExists(workflowsDir)) {
      try {
        const entries = await fs.readdir(workflowsDir);
        if (entries.some((entry) => entry.startsWith('bmad') && entry.endsWith('.md'))) {
          return true;
        }
      } catch {
        // Continue checking
      }
    }

    return false;
  }

  /**
   * Install a custom agent launcher for Rovo Dev
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object|null} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const workflowsDir = path.join(projectDir, this.configDir, this.workflowsDir);

    if (!(await this.exists(path.join(projectDir, this.configDir)))) {
      return null;
    }

    await this.ensureDir(workflowsDir);

    const launcherContent = `---
name: ${agentName}
description: Custom BMAD agent: ${agentName}
---

# ${agentName} Custom Agent

**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this workflow as ${agentName}

The agent will follow the persona and instructions from the main agent file.

---

*Generated by BMAD Method*`;

    // Use flat naming: bmad-custom-agent-agentname.md
    const fileName = `bmad-custom-agent-${agentName.toLowerCase()}.md`;
    const launcherPath = path.join(workflowsDir, fileName);

    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      ide: 'rovo-dev',
      path: path.relative(projectDir, launcherPath),
      command: fileName.replace('.md', ''),
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { RovoDevSetup };
