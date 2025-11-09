const path = require('node:path');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');

/**
 * Auggie CLI setup handler
 * Installs to project directory (.augment/commands)
 */
class AuggieSetup extends BaseIdeSetup {
  constructor() {
    super('auggie', 'Auggie CLI');
    this.detectionPaths = ['.augment'];
  }

  /**
   * Setup Auggie CLI configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Always use project directory
    const location = path.join(projectDir, '.augment', 'commands');

    // Clean up old BMAD installation first
    await this.cleanup(projectDir);

    // Get agents, tasks, tools, and workflows (standalone only)
    const agents = await this.getAgents(bmadDir);
    const tasks = await this.getTasks(bmadDir, true);
    const tools = await this.getTools(bmadDir, true);
    const workflows = await this.getWorkflows(bmadDir, true);

    const bmadCommandsDir = path.join(location, 'bmad');
    const agentsDir = path.join(bmadCommandsDir, 'agents');
    const tasksDir = path.join(bmadCommandsDir, 'tasks');
    const toolsDir = path.join(bmadCommandsDir, 'tools');
    const workflowsDir = path.join(bmadCommandsDir, 'workflows');

    await this.ensureDir(agentsDir);
    await this.ensureDir(tasksDir);
    await this.ensureDir(toolsDir);
    await this.ensureDir(workflowsDir);

    // Install agents
    for (const agent of agents) {
      const content = await this.readFile(agent.path);
      const commandContent = await this.createAgentCommand(agent, content);

      const targetPath = path.join(agentsDir, `${agent.module}-${agent.name}.md`);
      await this.writeFile(targetPath, commandContent);
    }

    // Install tasks
    for (const task of tasks) {
      const content = await this.readFile(task.path);
      const commandContent = this.createTaskCommand(task, content);

      const targetPath = path.join(tasksDir, `${task.module}-${task.name}.md`);
      await this.writeFile(targetPath, commandContent);
    }

    // Install tools
    for (const tool of tools) {
      const content = await this.readFile(tool.path);
      const commandContent = this.createToolCommand(tool, content);

      const targetPath = path.join(toolsDir, `${tool.module}-${tool.name}.md`);
      await this.writeFile(targetPath, commandContent);
    }

    // Install workflows
    for (const workflow of workflows) {
      const content = await this.readFile(workflow.path);
      const commandContent = this.createWorkflowCommand(workflow, content);

      const targetPath = path.join(workflowsDir, `${workflow.module}-${workflow.name}.md`);
      await this.writeFile(targetPath, commandContent);
    }

    const totalInstalled = agents.length + tasks.length + tools.length + workflows.length;

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${agents.length} agents installed`));
    console.log(chalk.dim(`  - ${tasks.length} tasks installed`));
    console.log(chalk.dim(`  - ${tools.length} tools installed`));
    console.log(chalk.dim(`  - ${workflows.length} workflows installed`));
    console.log(chalk.dim(`  - Location: ${path.relative(projectDir, location)}`));
    console.log(chalk.yellow(`\n  💡 Tip: Add 'model: gpt-4o' to command frontmatter to specify AI model`));

    return {
      success: true,
      agents: agents.length,
      tasks: tasks.length,
      tools: tools.length,
      workflows: workflows.length,
    };
  }

  /**
   * Create agent command content
   */
  async createAgentCommand(agent, content) {
    const titleMatch = content.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : this.formatTitle(agent.name);

    // Extract description from agent if available
    const whenToUseMatch = content.match(/whenToUse="([^"]+)"/);
    const description = whenToUseMatch ? whenToUseMatch[1] : `Activate the ${title} agent`;

    // Get the activation header from central template
    const activationHeader = await this.getAgentCommandHeader();

    return `---
description: "${description}"
---

# ${title} Agent

${activationHeader}

${content}

## Module
BMAD ${agent.module.toUpperCase()} module
`;
  }

  /**
   * Create task command content
   */
  createTaskCommand(task, content) {
    const nameMatch = content.match(/name="([^"]+)"/);
    const taskName = nameMatch ? nameMatch[1] : this.formatTitle(task.name);

    return `---
description: "Execute the ${taskName} task"
---

# ${taskName} Task

${content}

## Module
BMAD ${task.module.toUpperCase()} module
`;
  }

  /**
   * Create tool command content
   */
  createToolCommand(tool, content) {
    const nameMatch = content.match(/name="([^"]+)"/);
    const toolName = nameMatch ? nameMatch[1] : this.formatTitle(tool.name);

    return `---
description: "Use the ${toolName} tool"
---

# ${toolName} Tool

${content}

## Module
BMAD ${tool.module.toUpperCase()} module
`;
  }

  /**
   * Create workflow command content
   */
  createWorkflowCommand(workflow, content) {
    const description = workflow.description || `Execute the ${workflow.name} workflow`;

    return `---
description: "${description}"
---

# ${workflow.name} Workflow

${content}

## Module
BMAD ${workflow.module.toUpperCase()} module
`;
  }

  /**
   * Cleanup Auggie configuration
   */
  async cleanup(projectDir) {
    const fs = require('fs-extra');

    // Only clean up project directory
    const location = path.join(projectDir, '.augment', 'commands');
    const bmadDir = path.join(location, 'bmad');

    if (await fs.pathExists(bmadDir)) {
      await fs.remove(bmadDir);
      console.log(chalk.dim(`  Removed old BMAD commands`));
    }
  }
}

module.exports = { AuggieSetup };
