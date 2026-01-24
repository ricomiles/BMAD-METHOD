const path = require('node:path');
const fs = require('fs-extra');
const yaml = require('yaml');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');

/**
 * Gemini CLI setup handler
 * Creates TOML files in .gemini/commands/ structure
 */
class GeminiSetup extends BaseIdeSetup {
  constructor() {
    super('gemini', 'Gemini CLI', false);
    this.configDir = '.gemini';
    this.commandsDir = 'commands';
  }

  /**
   * Load config values from bmad installation
   * @param {string} bmadDir - BMAD installation directory
   * @returns {Object} Config values
   */
  async loadConfigValues(bmadDir) {
    const configValues = {
      user_name: 'User', // Default fallback
    };

    // Try to load core config.yaml
    const coreConfigPath = path.join(bmadDir, 'core', 'config.yaml');
    if (await fs.pathExists(coreConfigPath)) {
      try {
        const configContent = await fs.readFile(coreConfigPath, 'utf8');
        const config = yaml.parse(configContent);

        if (config.user_name) {
          configValues.user_name = config.user_name;
        }
      } catch (error) {
        console.warn(chalk.yellow(`  Warning: Could not load config values: ${error.message}`));
      }
    }

    return configValues;
  }

  /**
   * Setup Gemini CLI configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Create .gemini/commands directory (flat structure with bmad- prefix)
    const geminiDir = path.join(projectDir, this.configDir);
    const commandsDir = path.join(geminiDir, this.commandsDir);

    await this.ensureDir(commandsDir);

    // Use UnifiedInstaller for agents and workflows
    const installer = new UnifiedInstaller(this.bmadFolderName);

    const config = {
      targetDir: commandsDir,
      namingStyle: NamingStyle.FLAT_DASH,
      templateType: TemplateType.GEMINI,
      fileExtension: '.toml',
    };

    const counts = await installer.install(projectDir, bmadDir, config, options.selectedModules || []);

    // Generate activation names for display
    const agentActivation = `/bmad_agents_{agent-name}`;
    const workflowActivation = `/bmad_workflows_{workflow-name}`;
    const taskActivation = `/bmad_tasks_{task-name}`;

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents configured`));
    console.log(chalk.dim(`  - ${counts.workflows} workflows configured`));
    console.log(chalk.dim(`  - ${counts.tasks} tasks configured`));
    console.log(chalk.dim(`  - ${counts.tools} tools configured`));
    console.log(chalk.dim(`  - Commands directory: ${path.relative(projectDir, commandsDir)}`));
    console.log(chalk.dim(`  - Agent activation: ${agentActivation}`));
    console.log(chalk.dim(`  - Workflow activation: ${workflowActivation}`));
    console.log(chalk.dim(`  - Task activation: ${taskActivation}`));

    return {
      success: true,
      ...counts,
    };
  }

  /**
   * Cleanup Gemini configuration - surgically remove only BMAD files
   */
  async cleanup(projectDir) {
    const fs = require('fs-extra');
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    if (await fs.pathExists(commandsDir)) {
      // Remove any bmad* files (cleans up old bmad- and bmad: formats)
      const files = await fs.readdir(commandsDir);
      let removed = 0;

      for (const file of files) {
        if (file.startsWith('bmad') && file.endsWith('.toml')) {
          await fs.remove(path.join(commandsDir, file));
          removed++;
        }
      }

      if (removed > 0) {
        console.log(chalk.dim(`  Cleaned up ${removed} existing BMAD files`));
      }
    }
  }

  /**
   * Install a custom agent launcher for Gemini
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const geminiDir = path.join(projectDir, this.configDir);
    const commandsDir = path.join(geminiDir, this.commandsDir);

    // Create .gemini/commands directory if it doesn't exist
    await fs.ensureDir(commandsDir);

    // Create custom agent launcher in TOML format
    const launcherContent = `description = "Custom BMAD Agent: ${agentName}"
prompt = """
**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this command to activate ${agentName}

The agent will follow the persona and instructions from the main agent file.

---

*Generated by BMAD Method*
"""`;

    const fileName = `bmad-custom-${agentName.toLowerCase()}.toml`;
    const launcherPath = path.join(commandsDir, fileName);

    // Write the launcher file
    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      ide: 'gemini',
      path: path.relative(projectDir, launcherPath),
      command: agentName,
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { GeminiSetup };
