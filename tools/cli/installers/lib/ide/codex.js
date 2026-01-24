const path = require('node:path');
const fs = require('fs-extra');
const os = require('node:os');
const chalk = require('chalk');
const { BaseIdeSetup } = require('./_base-ide');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');
const { customAgentDashName } = require('./shared/path-utils');
const prompts = require('../../../lib/prompts');

/**
 * Codex setup handler (CLI mode)
 *
 * Uses UnifiedInstaller for all artifact installation.
 */
class CodexSetup extends BaseIdeSetup {
  constructor() {
    super('codex', 'Codex', true);
  }

  /**
   * Collect configuration choices before installation
   */
  async collectConfiguration(options = {}) {
    let confirmed = false;
    let installLocation = 'global';

    while (!confirmed) {
      installLocation = await prompts.select({
        message: 'Where would you like to install Codex CLI prompts?',
        choices: [
          {
            name: 'Global - Simple for single project ' + '(~/.codex/prompts, but references THIS project only)',
            value: 'global',
          },
          {
            name: `Project-specific - Recommended for real work (requires CODEX_HOME=<project-dir>${path.sep}.codex)`,
            value: 'project',
          },
        ],
        default: 'global',
      });

      console.log('');
      if (installLocation === 'project') {
        console.log(this.getProjectSpecificInstructions());
      } else {
        console.log(this.getGlobalInstructions());
      }

      confirmed = await prompts.confirm({
        message: 'Proceed with this installation option?',
        default: true,
      });

      if (!confirmed) {
        console.log(chalk.yellow("\n  Let's choose a different installation option.\n"));
      }
    }

    return { installLocation };
  }

  /**
   * Setup Codex configuration
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    const installLocation = options.preCollectedConfig?.installLocation || 'global';
    const destDir = this.getCodexPromptDir(projectDir, installLocation);

    await fs.ensureDir(destDir);
    await this.clearOldBmadFiles(destDir);

    // Use the unified installer - so much simpler!
    const installer = new UnifiedInstaller(this.bmadFolderName);
    const counts = await installer.install(
      projectDir,
      bmadDir,
      {
        targetDir: destDir,
        namingStyle: NamingStyle.FLAT_DASH,
        templateType: TemplateType.CODEX,
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - Mode: CLI`));
    console.log(chalk.dim(`  - ${counts.agents} agents installed`));
    if (counts.workflows > 0) {
      console.log(chalk.dim(`  - ${counts.workflows} workflow commands generated`));
    }
    if (counts.tasks + counts.tools > 0) {
      console.log(
        chalk.dim(`  - ${counts.tasks + counts.tools} task/tool commands generated (${counts.tasks} tasks, ${counts.tools} tools)`),
      );
    }
    console.log(chalk.dim(`  - ${counts.total} Codex prompt files written`));
    console.log(chalk.dim(`  - Destination: ${destDir}`));

    return {
      success: true,
      mode: 'cli',
      ...counts,
      destination: destDir,
      installLocation,
    };
  }

  /**
   * Detect Codex installation by checking for BMAD prompt exports
   */
  async detect(projectDir) {
    const globalDir = this.getCodexPromptDir(null, 'global');
    const projectDir_local = projectDir || process.cwd();
    const projectSpecificDir = this.getCodexPromptDir(projectDir_local, 'project');

    // Check global location
    if (await fs.pathExists(globalDir)) {
      const entries = await fs.readdir(globalDir);
      if (entries.some((entry) => entry.startsWith('bmad'))) {
        return true;
      }
    }

    // Check project-specific location
    if (await fs.pathExists(projectSpecificDir)) {
      const entries = await fs.readdir(projectSpecificDir);
      if (entries.some((entry) => entry.startsWith('bmad'))) {
        return true;
      }
    }

    return false;
  }

  getCodexPromptDir(projectDir = null, location = 'global') {
    if (location === 'project' && projectDir) {
      return path.join(projectDir, '.codex', 'prompts');
    }
    return path.join(os.homedir(), '.codex', 'prompts');
  }

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
   * Get instructions for global installation
   */
  getGlobalInstructions() {
    const lines = [
      '',
      chalk.bold.cyan('═'.repeat(70)),
      chalk.bold.yellow('  IMPORTANT: Codex Configuration'),
      chalk.bold.cyan('═'.repeat(70)),
      '',
      chalk.white('  /prompts installed globally to your HOME DIRECTORY.'),
      '',
      chalk.yellow('  ⚠️  These prompts reference a specific _bmad path'),
      chalk.dim("  To use with other projects, you'd need to copy the _bmad dir"),
      '',
      chalk.green('  ✓ You can now use /commands in Codex CLI'),
      chalk.dim('    Example: /bmad-bmm-pm'),
      chalk.dim('    Type / to see all available commands'),
      '',
      chalk.bold.cyan('═'.repeat(70)),
      '',
    ];
    return lines.join('\n');
  }

  /**
   * Get instructions for project-specific installation
   */
  getProjectSpecificInstructions() {
    const isWindows = os.platform() === 'win32';

    const commonLines = [
      '',
      chalk.bold.cyan('═'.repeat(70)),
      chalk.bold.yellow('  Project-Specific Codex Configuration'),
      chalk.bold.cyan('═'.repeat(70)),
      '',
      chalk.white('  Prompts will be installed to: ') + chalk.cyan('<project>/.codex/prompts'),
      '',
      chalk.bold.yellow('  ⚠️  REQUIRED: You must set CODEX_HOME to use these prompts'),
      '',
    ];

    const windowsLines = [
      chalk.bold('  Create a codex.cmd file in your project root:'),
      '',
      chalk.green('    @echo off'),
      chalk.green('    set CODEX_HOME=%~dp0.codex'),
      chalk.green('    codex %*'),
      '',
      chalk.dim(String.raw`  Then run: .\codex instead of codex`),
      chalk.dim('  (The %~dp0 gets the directory of the .cmd file)'),
    ];

    const unixLines = [
      chalk.bold('  Add this alias to your ~/.bashrc or ~/.zshrc:'),
      '',
      chalk.green('    alias codex=\'CODEX_HOME="$PWD/.codex" codex\''),
      '',
      chalk.dim('  After adding, run: source ~/.bashrc  (or source ~/.zshrc)'),
      chalk.dim('  (The $PWD uses your current working directory)'),
    ];
    const closingLines = [
      '',
      chalk.dim('  This tells Codex CLI to use prompts from this project instead of ~/.codex'),
      '',
      chalk.bold.cyan('═'.repeat(70)),
      '',
    ];

    const lines = [...commonLines, ...(isWindows ? windowsLines : unixLines), ...closingLines];
    return lines.join('\n');
  }

  /**
   * Cleanup Codex configuration
   */
  async cleanup(projectDir = null) {
    const globalDir = this.getCodexPromptDir(null, 'global');
    await this.clearOldBmadFiles(globalDir);

    if (projectDir) {
      const projectSpecificDir = this.getCodexPromptDir(projectDir, 'project');
      await this.clearOldBmadFiles(projectSpecificDir);
    }
  }

  /**
   * Install a custom agent launcher for Codex
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const destDir = this.getCodexPromptDir(projectDir, 'project');
    await fs.ensureDir(destDir);

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

    const fileName = customAgentDashName(agentName);
    const launcherPath = path.join(destDir, fileName);
    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      path: path.relative(projectDir, launcherPath),
      command: `/${fileName.replace('.md', '')}`,
    };
  }
}

module.exports = { CodexSetup };
