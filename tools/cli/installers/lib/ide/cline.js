const path = require('node:path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { BaseIdeSetup } = require('./_base-ide');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');
const { customAgentDashName } = require('./shared/path-utils');

/**
 * Cline IDE setup handler
 *
 * Uses UnifiedInstaller for all artifact installation.
 * Installs BMAD artifacts to .clinerules/workflows with flattened naming.
 */
class ClineSetup extends BaseIdeSetup {
  constructor() {
    super('cline', 'Cline', false);
    this.configDir = '.clinerules';
    this.workflowsDir = 'workflows';
  }

  /**
   * Setup Cline IDE configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Create .clinerules/workflows directory
    const clineDir = path.join(projectDir, this.configDir);
    const workflowsDir = path.join(clineDir, this.workflowsDir);

    await fs.ensureDir(workflowsDir);

    // Clear old BMAD files
    await this.clearOldBmadFiles(workflowsDir);

    // Use the unified installer - much simpler!
    const installer = new UnifiedInstaller(this.bmadFolderName);
    const counts = await installer.install(
      projectDir,
      bmadDir,
      {
        targetDir: workflowsDir,
        namingStyle: NamingStyle.FLAT_DASH,
        templateType: TemplateType.CLINE,
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents installed`));
    console.log(chalk.dim(`  - ${counts.tasks} tasks installed`));
    console.log(chalk.dim(`  - ${counts.workflows} workflow commands installed`));
    if (counts.tools > 0) {
      console.log(chalk.dim(`  - ${counts.tools} tools installed`));
    }
    console.log(chalk.dim(`  - ${counts.total} files written to ${path.relative(projectDir, workflowsDir)}`));

    // Usage instructions
    console.log(chalk.yellow('\n  ⚠️  How to Use Cline Workflows'));
    console.log(chalk.cyan('  BMAD workflows are available as slash commands in Cline'));
    console.log(chalk.dim('  Usage:'));
    console.log(chalk.dim('    - Type / to see available commands'));
    console.log(chalk.dim('    - All BMAD items start with "bmad-"'));
    console.log(chalk.dim('    - Example: /bmad-bmm-pm'));

    return {
      success: true,
      ...counts,
      destination: workflowsDir,
    };
  }

  /**
   * Detect Cline installation by checking for .clinerules/workflows directory
   */
  async detect(projectDir) {
    const workflowsDir = path.join(projectDir, this.configDir, this.workflowsDir);

    if (!(await fs.pathExists(workflowsDir))) {
      return false;
    }

    const entries = await fs.readdir(workflowsDir);
    return entries.some((entry) => entry.startsWith('bmad'));
  }

  /**
   * Clear old BMAD files from the workflows directory
   */
  async clearOldBmadFiles(destDir) {
    if (!(await fs.pathExists(destDir))) {
      return;
    }

    const entries = await fs.readdir(destDir);

    for (const entry of entries) {
      if (!entry.startsWith('bmad')) {
        continue;
      }

      const entryPath = path.join(destDir, entry);
      const stat = await fs.stat(entryPath);
      if (stat.isFile()) {
        await fs.remove(entryPath);
      } else if (stat.isDirectory()) {
        await fs.remove(entryPath);
      }
    }
  }

  /**
   * Cleanup Cline configuration
   */
  async cleanup(projectDir) {
    const workflowsDir = path.join(projectDir, this.configDir, this.workflowsDir);
    await this.clearOldBmadFiles(workflowsDir);
    console.log(chalk.dim(`Removed ${this.name} BMAD configuration`));
  }

  /**
   * Install a custom agent launcher for Cline
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const clineDir = path.join(projectDir, this.configDir);
    const workflowsDir = path.join(clineDir, this.workflowsDir);

    // Create .clinerules/workflows directory if it doesn't exist
    await fs.ensureDir(workflowsDir);

    // Create custom agent launcher workflow
    const launcherContent = `name: ${agentName}
description: Custom BMAD agent: ${agentName}

# ${agentName} Custom Agent

**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this workflow as ${agentName}

The agent will follow the persona and instructions from the main agent file.

---

*Generated by BMAD Method*`;

    // Use underscore format: bmad_custom_fred-commit-poet.md
    const fileName = customAgentDashName(agentName);
    const launcherPath = path.join(workflowsDir, fileName);

    // Write the launcher file
    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      ide: 'cline',
      path: path.relative(projectDir, launcherPath),
      command: fileName.replace('.md', ''),
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { ClineSetup };
