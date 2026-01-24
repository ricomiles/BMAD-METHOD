const path = require('node:path');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');
const { customAgentColonName } = require('./shared/path-utils');

/**
 * Cursor IDE setup handler
 *
 * Uses the UnifiedInstaller - all the complex artifact collection
 * and writing logic is now centralized.
 */
class CursorSetup extends BaseIdeSetup {
  constructor() {
    super('cursor', 'Cursor', true);
    this.configDir = '.cursor';
    this.rulesDir = 'rules';
    this.commandsDir = 'commands';
  }

  /**
   * Setup Cursor IDE configuration
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Clean up old BMAD installation first
    await this.cleanup(projectDir);

    // Create .cursor/commands directory
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);
    await this.ensureDir(commandsDir);

    // Use the unified installer
    const installer = new UnifiedInstaller(this.bmadFolderName);
    const counts = await installer.install(
      projectDir,
      bmadDir,
      {
        targetDir: commandsDir,
        namingStyle: NamingStyle.FLAT_COLON,
        templateType: TemplateType.CURSOR,
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents installed`));
    if (counts.workflows > 0) {
      console.log(chalk.dim(`  - ${counts.workflows} workflow commands generated`));
    }
    if (counts.tasks + counts.tools > 0) {
      console.log(
        chalk.dim(`  - ${counts.tasks + counts.tools} task/tool commands generated (${counts.tasks} tasks, ${counts.tools} tools)`),
      );
    }
    console.log(chalk.dim(`  - Commands directory: ${path.relative(projectDir, commandsDir)}`));

    return {
      success: true,
      agents: counts.agents,
      tasks: counts.tasks,
      tools: counts.tools,
      workflows: counts.workflows,
    };
  }

  /**
   * Cleanup old BMAD installation
   */
  async cleanup(projectDir) {
    const fs = require('fs-extra');
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    if (await fs.pathExists(commandsDir)) {
      const entries = await fs.readdir(commandsDir);
      for (const entry of entries) {
        if (entry.startsWith('bmad')) {
          await fs.remove(path.join(commandsDir, entry));
        }
      }
    }
    // Also remove legacy bmad folder if it exists
    const bmadFolder = path.join(commandsDir, 'bmad');
    if (await fs.pathExists(bmadFolder)) {
      await fs.remove(bmadFolder);
      console.log(chalk.dim(`  Removed old BMAD commands from ${this.name}`));
    }
  }

  /**
   * Install a custom agent launcher for Cursor
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    if (!(await this.exists(path.join(projectDir, this.configDir)))) {
      return null;
    }

    await this.ensureDir(commandsDir);

    const launcherContent = `---
name: '${agentName}'
description: '${agentName} agent'
---

You must fully embody this agent's persona and follow all activation instructions exactly as specified. NEVER break character until given an exit command.

<agent-activation CRITICAL="TRUE">
1. LOAD the FULL agent file from @${agentPath}
2. READ its entire contents - this contains the complete agent persona, menu, and instructions
3. FOLLOW every step in the <activation> section precisely
4. DISPLAY the welcome/greeting as instructed
5. PRESENT the numbered menu
6. WAIT for user input before proceeding
</agent-activation>
`;

    const launcherName = customAgentColonName(agentName);
    const launcherPath = path.join(commandsDir, launcherName);
    await this.writeFile(launcherPath, launcherContent);

    return {
      path: launcherPath,
      command: `/${launcherName.replace('.md', '')}`,
    };
  }
}

module.exports = { CursorSetup };
