const path = require('node:path');
const fs = require('fs-extra');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const { AgentCommandGenerator } = require('./shared/agent-command-generator');
const { WorkflowCommandGenerator } = require('./shared/workflow-command-generator');

/**
 * iFlow CLI setup handler
 * Creates commands in .iflow/commands/ directory structure
 */
class IFlowSetup extends BaseIdeSetup {
  constructor() {
    super('iflow', 'iFlow CLI');
    this.configDir = '.iflow';
    this.commandsDir = 'commands';
  }

  /**
   * Setup iFlow CLI configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Clean up old BMAD installation first
    await this.cleanup(projectDir);

    // Create .iflow/commands directory structure (flat files, no bmad subfolder)
    const iflowDir = path.join(projectDir, this.configDir);
    const commandsDir = path.join(iflowDir, this.commandsDir);

    await this.ensureDir(commandsDir);

    // Generate agent launchers
    const agentGen = new AgentCommandGenerator(this.bmadFolderName);
    const { artifacts: agentArtifacts } = await agentGen.collectAgentArtifacts(bmadDir, options.selectedModules || []);

    // Setup agents as commands (flat files with dash naming)
    const agentCount = await agentGen.writeDashArtifacts(commandsDir, agentArtifacts);

    // Get tasks and workflows (ALL workflows now generate commands)
    const tasks = await this.getTasks(bmadDir);

    // Get ALL workflows using the new workflow command generator
    const workflowGenerator = new WorkflowCommandGenerator(this.bmadFolderName);
    const { artifacts: workflowArtifacts, counts: workflowCounts } = await workflowGenerator.collectWorkflowArtifacts(bmadDir);

    // Setup workflows as commands (flat files with dash naming)
    const workflowCount = await workflowGenerator.writeDashArtifacts(commandsDir, workflowArtifacts);

    // TODO: tasks not yet implemented with flat naming
    const taskCount = 0;

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${agentCount} agent commands created`));
    console.log(chalk.dim(`  - ${taskCount} task commands created`));
    console.log(chalk.dim(`  - ${workflowCount} workflow commands created`));
    console.log(chalk.dim(`  - Commands directory: ${path.relative(projectDir, commandsDir)}`));

    return {
      success: true,
      agents: agentCount,
      tasks: taskCount,
      workflows: workflowCount,
    };
  }

  /**
   * Create agent command content
   */
  async createAgentCommand(artifact) {
    // The launcher content is already complete - just return it as-is
    return artifact.content;
  }

  /**
   * Create task command content
   */
  createTaskCommand(task, content) {
    // Extract task name
    const nameMatch = content.match(/<name>([^<]+)<\/name>/);
    const taskName = nameMatch ? nameMatch[1] : this.formatTitle(task.name);

    let commandContent = `# /task-${task.name} Command

When this command is used, execute the following task:

## ${taskName} Task

${content}

## Usage

This command executes the ${taskName} task from the BMAD ${task.module.toUpperCase()} module.

## Module

Part of the BMAD ${task.module.toUpperCase()} module.
`;

    return commandContent;
  }

  /**
   * Cleanup iFlow configuration
   */
  async cleanup(projectDir) {
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);
    const bmadFolder = path.join(commandsDir, 'bmad');

    // Remove old bmad subfolder if it exists
    if (await fs.pathExists(bmadFolder)) {
      await fs.remove(bmadFolder);
    }

    // Also remove any bmad* files at commands root
    if (await fs.pathExists(commandsDir)) {
      const bmadFiles = (await fs.readdir(commandsDir)).filter((f) => f.startsWith('bmad'));
      for (const f of bmadFiles) {
        await fs.remove(path.join(commandsDir, f));
      }
      console.log(chalk.dim(`Removed BMAD commands from iFlow CLI`));
    }
  }

  /**
   * Install a custom agent launcher for iFlow
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    // Create .iflow/commands directory if it doesn't exist
    await fs.ensureDir(commandsDir);

    // Create custom agent launcher
    const launcherContent = `# ${agentName} Custom Agent

**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this command to activate ${agentName}

The agent will follow the persona and instructions from the main agent file.

---

*Generated by BMAD Method*`;

    const { customAgentDashName } = require('./shared/path-utils');
    const fileName = customAgentDashName(agentName);
    const launcherPath = path.join(commandsDir, fileName);

    // Write the launcher file
    await fs.writeFile(launcherPath, launcherContent, 'utf8');

    return {
      ide: 'iflow',
      path: path.relative(projectDir, launcherPath),
      command: agentName,
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { IFlowSetup };
