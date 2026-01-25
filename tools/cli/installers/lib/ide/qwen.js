const path = require('node:path');
const fs = require('fs-extra');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');
const { UnifiedInstaller, NamingStyle, TemplateType } = require('./shared/unified-installer');

/**
 * Qwen Code setup handler
 * Creates TOML command files in .qwen/commands/
 */
class QwenSetup extends BaseIdeSetup {
  constructor() {
    super('qwen', 'Qwen Code');
    this.configDir = '.qwen';
    this.commandsDir = 'commands';
  }

  /**
   * Setup Qwen Code configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Create .qwen/commands directory (flat structure, no bmad subfolder)
    const qwenDir = path.join(projectDir, this.configDir);
    const commandsDir = path.join(qwenDir, this.commandsDir);

    await this.ensureDir(commandsDir);

    // Update existing settings.json if present
    await this.updateSettings(qwenDir);

    // Clean up old configuration
    await this.cleanupOldConfig(qwenDir);
    await this.cleanup(projectDir);

    // Use the unified installer with QWEN template for TOML format
    const installer = new UnifiedInstaller(this.bmadFolderName);
    const counts = await installer.install(
      projectDir,
      bmadDir,
      {
        targetDir: commandsDir,
        namingStyle: NamingStyle.FLAT_DASH,
        templateType: TemplateType.QWEN,
        fileExtension: '.toml',
      },
      options.selectedModules || [],
    );

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${counts.agents} agents configured`));
    console.log(chalk.dim(`  - ${counts.tasks} tasks configured`));
    console.log(chalk.dim(`  - ${counts.tools} tools configured`));
    console.log(chalk.dim(`  - ${counts.workflows} workflows configured`));
    console.log(chalk.dim(`  - ${counts.total} TOML files written to ${path.relative(projectDir, commandsDir)}`));

    return {
      success: true,
      ...counts,
    };
  }

  /**
   * Update settings.json to remove old agent references
   */
  async updateSettings(qwenDir) {
    const settingsPath = path.join(qwenDir, 'settings.json');

    if (await fs.pathExists(settingsPath)) {
      try {
        const settingsContent = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsContent);
        let updated = false;

        // Remove agent file references from contextFileName
        if (settings.contextFileName && Array.isArray(settings.contextFileName)) {
          const originalLength = settings.contextFileName.length;
          settings.contextFileName = settings.contextFileName.filter(
            (fileName) => !fileName.startsWith('agents/') && !fileName.startsWith('bmad-method/'),
          );

          if (settings.contextFileName.length !== originalLength) {
            updated = true;
          }
        }

        if (updated) {
          await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
          console.log(chalk.green('  ✓ Updated .qwen/settings.json'));
        }
      } catch (error) {
        console.warn(chalk.yellow('  ⚠ Could not update settings.json:'), error.message);
      }
    }
  }

  /**
   * Clean up old configuration directories
   */
  async cleanupOldConfig(qwenDir) {
    const agentsDir = path.join(qwenDir, 'agents');
    const bmadMethodDir = path.join(qwenDir, 'bmad-method');
    const bmadDir = path.join(qwenDir, 'bmadDir');

    if (await fs.pathExists(agentsDir)) {
      await fs.remove(agentsDir);
      console.log(chalk.green('  ✓ Removed old agents directory'));
    }

    if (await fs.pathExists(bmadMethodDir)) {
      await fs.remove(bmadMethodDir);
      console.log(chalk.green('  ✓ Removed old bmad-method directory'));
    }

    if (await fs.pathExists(bmadDir)) {
      await fs.remove(bmadDir);
      console.log(chalk.green('  ✓ Removed old BMad directory'));
    }
  }

  /**
   * Cleanup Qwen configuration
   */
  async cleanup(projectDir) {
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    if (await fs.pathExists(commandsDir)) {
      // Remove any bmad* files from the commands directory
      const entries = await fs.readdir(commandsDir);
      for (const entry of entries) {
        if (entry.startsWith('bmad')) {
          await fs.remove(path.join(commandsDir, entry));
        }
      }
    }

    // Also remove legacy bmad subfolder if it exists
    const bmadCommandsDir = path.join(projectDir, this.configDir, this.commandsDir, 'bmad');
    if (await fs.pathExists(bmadCommandsDir)) {
      await fs.remove(bmadCommandsDir);
      console.log(chalk.dim(`  Cleaned up existing BMAD configuration from Qwen Code`));
    }

    const oldBmadMethodDir = path.join(projectDir, this.configDir, 'bmad-method');
    if (await fs.pathExists(oldBmadMethodDir)) {
      await fs.remove(oldBmadMethodDir);
      console.log(chalk.dim(`  Removed old BMAD configuration from Qwen Code`));
    }

    const oldBMadDir = path.join(projectDir, this.configDir, 'BMad');
    if (await fs.pathExists(oldBMadDir)) {
      await fs.remove(oldBMadDir);
      console.log(chalk.dim(`  Removed old BMAD configuration from Qwen Code`));
    }
  }

  /**
   * Install a custom agent launcher for Qwen
   * @param {string} projectDir - Project directory
   * @param {string} agentName - Agent name (e.g., "fred-commit-poet")
   * @param {string} agentPath - Path to compiled agent (relative to project root)
   * @param {Object} metadata - Agent metadata
   * @returns {Object} Installation result
   */
  async installCustomAgentLauncher(projectDir, agentName, agentPath, metadata) {
    const commandsDir = path.join(projectDir, this.configDir, this.commandsDir);

    // Create .qwen/commands directory if it doesn't exist
    await fs.ensureDir(commandsDir);

    // Create custom agent launcher content
    const launcherContent = `# ${agentName} Custom Agent

**⚠️ IMPORTANT**: Run @${agentPath} first to load the complete agent!

This is a launcher for the custom BMAD agent "${agentName}".

## Usage
1. First run: \`${agentPath}\` to load the complete agent
2. Then use this command to activate ${agentName}

The agent will follow the persona and instructions from the main agent file.

---

*Generated by BMAD Method*`;

    // Convert to TOML format using the same method as UnifiedInstaller
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    const contentWithoutFrontmatter = launcherContent.replace(frontmatterRegex, '').trim();
    const escapedContent = contentWithoutFrontmatter.replaceAll('"""', String.raw`\"\"\"`);

    const tomlContent = `description = "BMAD Custom Agent: ${agentName}"
prompt = """
${escapedContent}
"""
`;

    // Use flat naming: bmad-custom-agent-agentname.toml
    const fileName = `bmad-custom-agent-${agentName.toLowerCase()}.toml`;
    const launcherPath = path.join(commandsDir, fileName);

    // Write the launcher file
    await fs.writeFile(launcherPath, tomlContent, 'utf8');

    return {
      ide: 'qwen',
      path: path.relative(projectDir, launcherPath),
      command: fileName.replace('.toml', ''),
      type: 'custom-agent-launcher',
    };
  }
}

module.exports = { QwenSetup };
