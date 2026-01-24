const path = require('node:path');
const fs = require('fs-extra');
const csv = require('csv-parse/sync');
const chalk = require('chalk');
const { toColonName, toColonPath, toDashPath } = require('./path-utils');

/**
 * Generates command files for standalone tasks and tools
 */
class TaskToolCommandGenerator {
  /**
   * REMOVED: Old generateTaskToolCommands method that created nested structure.
   * This was causing bugs where files were written to wrong directories.
   * Use generateColonTaskToolCommands() or generateDashTaskToolCommands() instead.
   */

  /**
   * Generate command content for a task or tool
   */
  generateCommandContent(item, type) {
    const description = item.description || `Execute ${item.displayName || item.name}`;

    // Convert path to use {project-root} placeholder
    let itemPath = item.path;
    if (itemPath.startsWith('bmad/')) {
      itemPath = `{project-root}/${itemPath}`;
    }

    return `---
description: '${description.replaceAll("'", "''")}'
---

# ${item.displayName || item.name}

LOAD and execute the ${type} at: ${itemPath}

Follow all instructions in the ${type} file exactly as written.
`;
  }

  /**
   * Load task manifest CSV
   */
  async loadTaskManifest(bmadDir) {
    const manifestPath = path.join(bmadDir, '_config', 'task-manifest.csv');

    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }

    const csvContent = await fs.readFile(manifestPath, 'utf8');
    const tasks = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    // Filter out README files
    return tasks.filter((task) => {
      const nameLower = task.name.toLowerCase();
      return !nameLower.includes('readme') && task.name !== 'README';
    });
  }

  /**
   * Load tool manifest CSV
   */
  async loadToolManifest(bmadDir) {
    const manifestPath = path.join(bmadDir, '_config', 'tool-manifest.csv');

    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }

    const csvContent = await fs.readFile(manifestPath, 'utf8');
    const tools = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    // Filter out README files
    return tools.filter((tool) => {
      const nameLower = tool.name.toLowerCase();
      return !nameLower.includes('readme') && tool.name !== 'README';
    });
  }

  /**
   * Generate task and tool commands using underscore format (Windows-compatible)
   * Creates flat files like: bmad_bmm_bmad-help.md
   *
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {string} baseCommandsDir - Base commands directory for the IDE
   * @returns {Object} Generation results
   */
  async generateColonTaskToolCommands(projectDir, bmadDir, baseCommandsDir) {
    const tasks = await this.loadTaskManifest(bmadDir);
    const tools = await this.loadToolManifest(bmadDir);

    // Filter to only standalone items
    const standaloneTasks = tasks ? tasks.filter((t) => t.standalone === 'true' || t.standalone === true) : [];
    const standaloneTools = tools ? tools.filter((t) => t.standalone === 'true' || t.standalone === true) : [];

    let generatedCount = 0;

    // DEBUG: Log parameters
    console.log(`[DEBUG generateColonTaskToolCommands] baseCommandsDir: ${baseCommandsDir}`);

    // Generate command files for tasks
    for (const task of standaloneTasks) {
      const commandContent = this.generateCommandContent(task, 'task');
      // Use underscore format: bmad_bmm_name.md
      const flatName = toColonName(task.module, 'tasks', task.name);
      const commandPath = path.join(baseCommandsDir, flatName);
      console.log(`[DEBUG generateColonTaskToolCommands] Writing task ${task.name} to: ${commandPath}`);
      await fs.ensureDir(path.dirname(commandPath));
      await fs.writeFile(commandPath, commandContent);
      generatedCount++;
    }

    // Generate command files for tools
    for (const tool of standaloneTools) {
      const commandContent = this.generateCommandContent(tool, 'tool');
      // Use underscore format: bmad_bmm_name.md
      const flatName = toColonName(tool.module, 'tools', tool.name);
      const commandPath = path.join(baseCommandsDir, flatName);
      await fs.ensureDir(path.dirname(commandPath));
      await fs.writeFile(commandPath, commandContent);
      generatedCount++;
    }

    return {
      generated: generatedCount,
      tasks: standaloneTasks.length,
      tools: standaloneTools.length,
    };
  }

  /**
   * Generate task and tool commands using underscore format (Windows-compatible)
   * Creates flat files like: bmad_bmm_bmad-help.md
   *
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {string} baseCommandsDir - Base commands directory for the IDE
   * @returns {Object} Generation results
   */
  async generateDashTaskToolCommands(projectDir, bmadDir, baseCommandsDir) {
    const tasks = await this.loadTaskManifest(bmadDir);
    const tools = await this.loadToolManifest(bmadDir);

    // Filter to only standalone items
    const standaloneTasks = tasks ? tasks.filter((t) => t.standalone === 'true' || t.standalone === true) : [];
    const standaloneTools = tools ? tools.filter((t) => t.standalone === 'true' || t.standalone === true) : [];

    let generatedCount = 0;

    // Generate command files for tasks
    for (const task of standaloneTasks) {
      const commandContent = this.generateCommandContent(task, 'task');
      // Use underscore format: bmad_bmm_name.md (toDashPath aliases toColonPath)
      const flatName = toDashPath(`${task.module}/tasks/${task.name}.md`);
      const commandPath = path.join(baseCommandsDir, flatName);
      await fs.ensureDir(path.dirname(commandPath));
      await fs.writeFile(commandPath, commandContent);
      generatedCount++;
    }

    // Generate command files for tools
    for (const tool of standaloneTools) {
      const commandContent = this.generateCommandContent(tool, 'tool');
      // Use underscore format: bmad_bmm_name.md (toDashPath aliases toColonPath)
      const flatName = toDashPath(`${tool.module}/tools/${tool.name}.md`);
      const commandPath = path.join(baseCommandsDir, flatName);
      await fs.ensureDir(path.dirname(commandPath));
      await fs.writeFile(commandPath, commandContent);
      generatedCount++;
    }

    return {
      generated: generatedCount,
      tasks: standaloneTasks.length,
      tools: standaloneTools.length,
    };
  }

  /**
   * Write task/tool artifacts using underscore format (Windows-compatible)
   * Creates flat files like: bmad_bmm_bmad-help.md
   *
   * @param {string} baseCommandsDir - Base commands directory for the IDE
   * @param {Array} artifacts - Task/tool artifacts with relativePath
   * @returns {number} Count of commands written
   */
  async writeColonArtifacts(baseCommandsDir, artifacts) {
    let writtenCount = 0;

    for (const artifact of artifacts) {
      if (artifact.type === 'task' || artifact.type === 'tool') {
        const commandContent = this.generateCommandContent(artifact, artifact.type);
        // Use underscore format: bmad_module_name.md
        const flatName = toColonPath(artifact.relativePath);
        const commandPath = path.join(baseCommandsDir, flatName);
        await fs.ensureDir(path.dirname(commandPath));
        await fs.writeFile(commandPath, commandContent);
        writtenCount++;
      }
    }

    return writtenCount;
  }

  /**
   * Write task/tool artifacts using underscore format (Windows-compatible)
   * Creates flat files like: bmad_bmm_bmad-help.md
   *
   * @param {string} baseCommandsDir - Base commands directory for the IDE
   * @param {Array} artifacts - Task/tool artifacts with relativePath
   * @returns {number} Count of commands written
   */
  async writeDashArtifacts(baseCommandsDir, artifacts) {
    let writtenCount = 0;

    for (const artifact of artifacts) {
      if (artifact.type === 'task' || artifact.type === 'tool') {
        const commandContent = this.generateCommandContent(artifact, artifact.type);
        // Use underscore format: bmad_module_name.md
        const flatName = toDashPath(artifact.relativePath);
        const commandPath = path.join(baseCommandsDir, flatName);
        await fs.ensureDir(path.dirname(commandPath));
        await fs.writeFile(commandPath, commandContent);
        writtenCount++;
      }
    }

    return writtenCount;
  }
}

module.exports = { TaskToolCommandGenerator };
