/**
 * Unified BMAD Installer for all IDEs
 *
 * Replaces the fractured, duplicated setup logic across all IDE handlers.
 * All IDEs do the same thing:
 *   1. Collect agents, workflows, tasks, tools from the same sources
 *   2. Write them to a target directory
 *   3. Use a naming convention (flat-colon, flat-dash, or nested)
 *
 * The only differences between IDEs are:
 *   - target directory (e.g., .claude/commands/, .cursor/rules/)
 *   - naming style (underscore vs dash vs nested)
 *   - template/frontmatter (some need YAML, some need custom frontmatter)
 */

const path = require('node:path');
const fs = require('fs-extra');
const { AgentCommandGenerator } = require('./agent-command-generator');
const { WorkflowCommandGenerator } = require('./workflow-command-generator');
const { TaskToolCommandGenerator } = require('./task-tool-command-generator');
const { toColonPath, toDashPath } = require('./path-utils');

/**
 * Naming styles
 */
const NamingStyle = {
  FLAT_COLON: 'flat-colon', // bmad_bmm_agent_pm.md (Windows-compatible)
  FLAT_DASH: 'flat-dash', // bmad-bmm-agent-pm.md
  NESTED: 'nested', // bmad/bmm/agents/pm.md (OLD, deprecated)
};

/**
 * Template types for different IDE frontmatter/formatting
 */
const TemplateType = {
  CLAUDE: 'claude', // YAML frontmatter with name/description
  CURSOR: 'cursor', // Same as Claude
  CODEX: 'codex', // No frontmatter, direct content
  CLINE: 'cline', // No frontmatter, direct content
  WINDSURF: 'windsurf', // YAML with auto_execution_mode
  AUGMENT: 'augment', // YAML frontmatter
  GEMINI: 'gemini', // TOML frontmatter with description/prompt
  QWEN: 'qwen', // TOML frontmatter with description/prompt (same as Gemini)
  COPILOT: 'copilot', // YAML with tools array for GitHub Copilot
};

/**
 * Unified installer configuration
 * @typedef {Object} UnifiedInstallConfig
 * @property {string} targetDir - Full path to target directory
 * @property {NamingStyle} namingStyle - How to name files
 * @property {TemplateType} templateType - What template format to use
 * @property {string} [fileExtension='.md'] - File extension including dot (e.g., '.md', '.toml')
 * @property {boolean} includeNestedStructure - For NESTED style, create subdirectories
 * @property {Function} [customTemplateFn] - Optional custom template function
 */

/**
 * Unified BMAD Installer
 */
class UnifiedInstaller {
  constructor(bmadFolderName = 'bmad') {
    this.bmadFolderName = bmadFolderName;
  }

  /**
   * Install BMAD artifacts for an IDE
   *
   * @param {string} projectDir - Project root directory
   * @param {string} bmadDir - BMAD installation directory (_bmad)
   * @param {UnifiedInstallConfig} config - Installation configuration
   * @param {Array<string>} selectedModules - Modules to install
   * @returns {Promise<Object>} Installation result with counts
   */
  async install(projectDir, bmadDir, config, selectedModules = []) {
    const {
      targetDir,
      namingStyle = NamingStyle.FLAT_COLON,
      templateType = TemplateType.CLAUDE,
      fileExtension = '.md',
      includeNestedStructure = false,
      customTemplateFn = null,
    } = config;

    // Clean up any existing BMAD files in target directory
    await this.cleanupBmadFiles(targetDir, fileExtension);

    // Ensure target directory exists
    await fs.ensureDir(targetDir);

    // Count results
    const counts = {
      agents: 0,
      workflows: 0,
      tasks: 0,
      tools: 0,
      total: 0,
    };

    // 1. Install Agents
    const agentGen = new AgentCommandGenerator(this.bmadFolderName);
    const { artifacts: agentArtifacts } = await agentGen.collectAgentArtifacts(bmadDir, selectedModules);
    counts.agents = await this.writeArtifacts(
      agentArtifacts,
      targetDir,
      namingStyle,
      templateType,
      fileExtension,
      customTemplateFn,
      'agent',
    );

    // 2. Install Workflows (filter out README artifacts)
    const workflowGen = new WorkflowCommandGenerator(this.bmadFolderName);
    const { artifacts: workflowArtifacts } = await workflowGen.collectWorkflowArtifacts(bmadDir);
    const workflowArtifactsFiltered = workflowArtifacts.filter((a) => {
      const name = path.basename(a.relativePath || '');
      return name.toLowerCase() !== 'readme.md' && !name.toLowerCase().startsWith('readme-');
    });
    counts.workflows = await this.writeArtifacts(
      workflowArtifactsFiltered,
      targetDir,
      namingStyle,
      templateType,
      fileExtension,
      customTemplateFn,
      'workflow',
    );

    // 3. Install Tasks and Tools from manifest CSV (standalone items)
    const ttGen = new TaskToolCommandGenerator();
    console.log(`[DEBUG] About to call TaskToolCommandGenerator, namingStyle=${namingStyle}, targetDir=${targetDir}`);

    // For now, ALWAYS use flat structure - nested is deprecated
    // TODO: Remove nested branch entirely after verification
    const taskToolResult =
      namingStyle === NamingStyle.FLAT_DASH
        ? await ttGen.generateDashTaskToolCommands(projectDir, bmadDir, targetDir, fileExtension)
        : await ttGen.generateColonTaskToolCommands(projectDir, bmadDir, targetDir, fileExtension);

    counts.tasks = taskToolResult.tasks || 0;
    counts.tools = taskToolResult.tools || 0;

    counts.total = counts.agents + counts.workflows + counts.tasks + counts.tools;

    return counts;
  }

  /**
   * Clean up any existing BMAD files in target directory
   * @param {string} targetDir - Target directory to clean
   * @param {string} [fileExtension='.md'] - File extension to match
   */
  async cleanupBmadFiles(targetDir, fileExtension = '.md') {
    if (!(await fs.pathExists(targetDir))) {
      return;
    }

    // Recursively find and remove any bmad* files or directories
    const entries = await fs.readdir(targetDir, { withFileTypes: true });

    for (const entry of entries) {
      // Only remove files with the matching extension
      if (entry.name.startsWith('bmad') && entry.name.endsWith(fileExtension)) {
        const entryPath = path.join(targetDir, entry.name);
        await fs.remove(entryPath);
      }
    }
  }

  /**
   * Write artifacts with specified naming style and template
   * @param {Array} artifacts - Artifacts to write
   * @param {string} targetDir - Target directory
   * @param {NamingStyle} namingStyle - Naming style to use
   * @param {TemplateType} templateType - Template type to use
   * @param {string} fileExtension - File extension including dot
   * @param {Function} customTemplateFn - Optional custom template function
   * @param {string} artifactType - Type of artifact for logging
   * @returns {Promise<number>} Number of artifacts written
   */
  async writeArtifacts(artifacts, targetDir, namingStyle, templateType, fileExtension, customTemplateFn, artifactType) {
    console.log(
      `[DEBUG] writeArtifacts: artifactType=${artifactType}, count=${artifacts.length}, targetDir=${targetDir}, fileExtension=${fileExtension}`,
    );
    let written = 0;

    for (const artifact of artifacts) {
      // Determine target path based on naming style
      let targetPath;
      let content = artifact.content;
      console.log(`[DEBUG] writeArtifacts processing: relativePath=${artifact.relativePath}, name=${artifact.name}`);

      if (namingStyle === NamingStyle.FLAT_COLON) {
        const flatName = toColonPath(artifact.relativePath, fileExtension);
        targetPath = path.join(targetDir, flatName);
      } else if (namingStyle === NamingStyle.FLAT_DASH) {
        const flatName = toDashPath(artifact.relativePath, fileExtension);
        targetPath = path.join(targetDir, flatName);
      } else {
        // Fallback: treat as flat even if NESTED specified
        const flatName = toColonPath(artifact.relativePath, fileExtension);
        targetPath = path.join(targetDir, flatName);
      }

      // Apply template transformations if needed
      if (customTemplateFn) {
        content = customTemplateFn(artifact, content, templateType);
      } else {
        content = this.applyTemplate(artifact, content, templateType);
      }

      // For flat files, just ensure targetDir exists (no nested dirs needed)
      await fs.ensureDir(targetDir);
      await fs.writeFile(targetPath, content, 'utf8');
      written++;
    }

    return written;
  }

  /**
   * Apply template/frontmatter based on type
   */
  applyTemplate(artifact, content, templateType) {
    switch (templateType) {
      case TemplateType.CLAUDE:
      case TemplateType.CURSOR: {
        // Already has YAML frontmatter from generator
        return content;
      }

      case TemplateType.CODEX:
      case TemplateType.CLINE: {
        // No frontmatter needed, content as-is
        return content;
      }

      case TemplateType.WINDSURF: {
        // Add Windsurf-specific frontmatter
        return this.addWindsurfFrontmatter(artifact, content);
      }

      case TemplateType.AUGMENT: {
        // Add Augment frontmatter
        return this.addAugmentFrontmatter(artifact, content);
      }

      case TemplateType.GEMINI: {
        // Add Gemini TOML frontmatter
        return this.addGeminiFrontmatter(artifact, content);
      }

      case TemplateType.COPILOT: {
        // Add Copilot frontmatter with tools array
        return this.addCopilotFrontmatter(artifact, content);
      }

      case TemplateType.QWEN: {
        // Add Qwen TOML frontmatter (same as Gemini)
        return this.addGeminiFrontmatter(artifact, content);
      }

      default: {
        return content;
      }
    }
  }

  /**
   * Add Windsurf frontmatter with auto_execution_mode
   */
  addWindsurfFrontmatter(artifact, content) {
    // Remove existing frontmatter if present
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    const contentWithoutFrontmatter = content.replace(frontmatterRegex, '');

    // Determine auto_execution_mode based on type
    let autoExecMode = '1'; // default for workflows
    if (artifact.type === 'agent') {
      autoExecMode = '3';
    } else if (artifact.type === 'task' || artifact.type === 'tool') {
      autoExecMode = '2';
    }

    const name = artifact.name || artifact.displayName || 'workflow';
    const frontmatter = `---
description: ${name}
auto_execution_mode: ${autoExecMode}
---

`;

    return frontmatter + contentWithoutFrontmatter;
  }

  /**
   * Add Augment frontmatter
   */
  addAugmentFrontmatter(artifact, content) {
    // Augment uses simple YAML frontmatter
    const name = artifact.name || artifact.displayName || 'workflow';
    const frontmatter = `---
description: ${name}
---

`;
    // Only add if not already present
    if (!content.startsWith('---')) {
      return frontmatter + content;
    }
    return content;
  }

  /**
   * Add Gemini TOML frontmatter
   * Converts content to TOML format with description and prompt fields
   */
  addGeminiFrontmatter(artifact, content) {
    // Remove existing YAML frontmatter if present
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    const contentWithoutFrontmatter = content.replace(frontmatterRegex, '').trim();

    // Extract description from artifact or content
    let description = artifact.name || artifact.displayName || 'BMAD Command';
    if (artifact.module) {
      description = `BMAD ${artifact.module.toUpperCase()} ${artifact.type || 'Command'}: ${description}`;
    }

    // Escape any triple quotes in content
    const escapedContent = contentWithoutFrontmatter.replaceAll('"""', String.raw`\"\"\"`);

    return `description = "${description}"
prompt = """
${escapedContent}
"""
`;
  }

  /**
   * Add GitHub Copilot frontmatter with tools array
   */
  addCopilotFrontmatter(artifact, content) {
    // Remove existing frontmatter if present
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    const contentWithoutFrontmatter = content.replace(frontmatterRegex, '');

    // GitHub Copilot tools array (as specified)
    const tools = [
      'changes',
      'edit',
      'fetch',
      'githubRepo',
      'problems',
      'runCommands',
      'runTasks',
      'runTests',
      'search',
      'runSubagent',
      'testFailure',
      'todos',
      'usages',
    ];

    const name = artifact.name || artifact.displayName || 'prompt';
    const description = `Activates the ${name} ${artifact.type || 'workflow'}.`;

    const frontmatter = `---
description: "${description}"
tools: ${JSON.stringify(tools)}
---

`;

    return frontmatter + contentWithoutFrontmatter;
  }

  /**
   * Get tasks from manifest CSV
   */
  async getTasksFromManifest(bmadDir) {
    const csv = require('csv-parse/sync');
    const manifestPath = path.join(bmadDir, '_config', 'task-manifest.csv');

    if (!(await fs.pathExists(manifestPath))) {
      return [];
    }

    const csvContent = await fs.readFile(manifestPath, 'utf8');
    const tasks = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    // Filter for standalone only
    return tasks
      .filter((t) => t.standalone === 'true' || t.standalone === true)
      .map((t) => ({
        ...t,
        content: null, // Will be read from path when writing
      }));
  }

  /**
   * Get tools from manifest CSV
   */
  async getToolsFromManifest(bmadDir) {
    const csv = require('csv-parse/sync');
    const manifestPath = path.join(bmadDir, '_config', 'tool-manifest.csv');

    if (!(await fs.pathExists(manifestPath))) {
      return [];
    }

    const csvContent = await fs.readFile(manifestPath, 'utf8');
    const tools = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    // Filter for standalone only
    return tools
      .filter((t) => t.standalone === 'true' || t.standalone === true)
      .map((t) => ({
        ...t,
        content: null, // Will be read from path when writing
      }));
  }
}

module.exports = {
  UnifiedInstaller,
  NamingStyle,
  TemplateType,
};
