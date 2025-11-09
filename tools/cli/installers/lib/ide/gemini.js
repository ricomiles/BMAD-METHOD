const path = require('node:path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');

/**
 * Gemini CLI setup handler
 * Creates TOML files in .gemini/commands/ structure
 */
class GeminiSetup extends BaseIdeSetup {
  constructor() {
    super('gemini', 'Gemini CLI', false);
    this.configDir = '.gemini';
    this.commandsDir = 'commands';
    this.agentTemplatePath = path.join(__dirname, 'templates', 'gemini-agent-command.toml');
    this.taskTemplatePath = path.join(__dirname, 'templates', 'gemini-task-command.toml');
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
        const config = yaml.load(configContent);

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

    // Clean up any existing BMAD files before reinstalling
    await this.cleanup(projectDir);

    // Get agents and tasks
    const agents = await this.getAgents(bmadDir);
    const tasks = await this.getTasks(bmadDir);

    // Install agents as TOML files with bmad- prefix (flat structure)
    let agentCount = 0;
    for (const agent of agents) {
      const content = await this.readFile(agent.path);
      const tomlContent = await this.createAgentToml(agent, content);

      // Flat structure: bmad-agent-{module}-{name}.toml
      const tomlPath = path.join(commandsDir, `bmad-agent-${agent.module}-${agent.name}.toml`);
      await this.writeFile(tomlPath, tomlContent);
      agentCount++;

      console.log(chalk.green(`  ✓ Added agent: /bmad:agents:${agent.module}:${agent.name}`));
    }

    // Install tasks as TOML files with bmad- prefix (flat structure)
    let taskCount = 0;
    for (const task of tasks) {
      const content = await this.readFile(task.path);
      const tomlContent = await this.createTaskToml(task, content);

      // Flat structure: bmad-task-{module}-{name}.toml
      const tomlPath = path.join(commandsDir, `bmad-task-${task.module}-${task.name}.toml`);
      await this.writeFile(tomlPath, tomlContent);
      taskCount++;

      console.log(chalk.green(`  ✓ Added task: /bmad:tasks:${task.module}:${task.name}`));
    }

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${agentCount} agents configured`));
    console.log(chalk.dim(`  - ${taskCount} tasks configured`));
    console.log(chalk.dim(`  - Commands directory: ${path.relative(projectDir, commandsDir)}`));
    console.log(chalk.dim(`  - Agent activation: /bmad:agents:{agent-name}`));
    console.log(chalk.dim(`  - Task activation: /bmad:tasks:{task-name}`));

    return {
      success: true,
      agents: agentCount,
      tasks: taskCount,
    };
  }

  /**
   * Create agent TOML content using template
   */
  async createAgentToml(agent, content) {
    // Extract metadata
    const titleMatch = content.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : this.formatTitle(agent.name);

    // Load template
    const template = await fs.readFile(this.agentTemplatePath, 'utf8');

    // Replace template variables
    // Note: {user_name} and other {config_values} are left as-is for runtime substitution by Gemini
    const tomlContent = template
      .replaceAll('{{title}}', title)
      .replaceAll('{{bmad_folder}}', this.bmadFolderName)
      .replaceAll('{{module}}', agent.module)
      .replaceAll('{{name}}', agent.name);

    return tomlContent;
  }

  /**
   * Create task TOML content using template
   */
  async createTaskToml(task, content) {
    // Extract task name from XML if available
    const nameMatch = content.match(/<name>([^<]+)<\/name>/);
    const taskName = nameMatch ? nameMatch[1] : this.formatTitle(task.name);

    // Load template
    const template = await fs.readFile(this.taskTemplatePath, 'utf8');

    // Replace template variables
    const tomlContent = template
      .replaceAll('{{taskName}}', taskName)
      .replaceAll('{{bmad_folder}}', this.bmadFolderName)
      .replaceAll('{{module}}', task.module)
      .replaceAll('{{filename}}', task.filename);

    return tomlContent;
  }

  /**
   * Cleanup Gemini configuration - surgically remove only BMAD files
   */
  async cleanup(projectDir) {
    const fs = require('fs-extra');
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    if (await fs.pathExists(commandsDir)) {
      // Only remove files that start with bmad- prefix
      const files = await fs.readdir(commandsDir);
      let removed = 0;

      for (const file of files) {
        if (file.startsWith('bmad-') && file.endsWith('.toml')) {
          await fs.remove(path.join(commandsDir, file));
          removed++;
        }
      }

      if (removed > 0) {
        console.log(chalk.dim(`  Cleaned up ${removed} existing BMAD files`));
      }
    }
  }
}

module.exports = { GeminiSetup };
