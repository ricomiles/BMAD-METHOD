const path = require('node:path');
const fs = require('fs-extra');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');

/**
 * Auggie CLI setup handler
 * Installs to project directory (.augment/commands)
 */
class AuggieSetup extends BaseIdeSetup {
  constructor() {
    super('auggie', 'Auggie CLI');
    this.detectionPaths = ['.augment'];
    this.installer = new UnifiedInstaller(this.bmadFolderName);
  }

  /**
   * Setup Auggie CLI configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Use flat file structure in .augment/commands/
    const targetDir = path.join(projectDir, '.augment', 'commands');

    // Install using UnifiedInstaller
    const counts = await this.installer.install(
      projectDir,
      bmadDir,
      {
        targetDir,
        namingStyle: NamingStyle.FLAT_COLON,
        templateType: TemplateType.AUGMENT,
        includeNestedStructure: false,
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents installed`));
    console.log(chalk.dim(`  - ${counts.tasks} tasks installed`));
    console.log(chalk.dim(`  - ${counts.tools} tools installed`));
    console.log(chalk.dim(`  - ${counts.workflows} workflows installed`));
    console.log(chalk.dim(`  - Location: ${path.relative(projectDir, targetDir)}`));
    console.log(chalk.yellow(`\n  💡 Tip: Add 'model: gpt-4o' to command frontmatter to specify AI model`));

    return {
      success: true,
      ...counts,
    };
  }

  /**
   * Cleanup Auggie configuration
   * Removes bmad* files from .augment/commands/
   */
  async cleanup(projectDir) {
    const targetDir = path.join(projectDir, '.augment', 'commands');
    await this.installer.cleanupBmadFiles(targetDir);
    console.log(chalk.dim(`  Removed old BMAD commands`));
  }

  /**
   * Install a custom agent launcher for Auggie
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    // Auggie uses .augment/commands directory with flat structure
    const targetDir = path.join(projectDir, '.augment', 'commands');

    // Create .augment/commands directory if it doesn't exist
    await fs.ensureDir(targetDir);

    // Create custom agent launcher with flat naming: bmad_custom_agent_{name}.md
    const launcherContent = `---
description: "Use the ${agentName} custom agent"
---

# ${agentName} Custom Agent

**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this command to activate ${agentName}

The agent will follow the persona and instructions from the main agent file.

## Module
BMAD Custom agent
`;

    // Use flat naming convention consistent with UnifiedInstaller
    const fileName = `bmad_custom_agent_${agentName.toLowerCase()}.md`;
    const launcherPath = path.join(targetDir, fileName);

    // Write the launcher file
    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      ide: 'auggie',
      path: path.relative(projectDir, launcherPath),
      command: agentName,
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { AuggieSetup };
