/**
 * File: tools/cli/lib/ui.js
 *
 * BMAD Method - Business Model Agile Development Method
 * Repository: https://github.com/paulpreibisch/BMAD-METHOD
 *
 * Copyright (c) 2025 Paul Preibisch
 * Licensed under the Apache License, Version 2.0
 *
 * ---
 *
 * @fileoverview Interactive installation prompts and user input collection for BMAD CLI
 * @context Guides users through installation configuration including core settings, modules, IDEs, and optional AgentVibes TTS
 * @architecture Facade pattern - presents unified installation flow, delegates to Detector/ConfigCollector/IdeManager for specifics
 * @dependencies inquirer (prompts), chalk (formatting), detector.js (existing installation detection)
 * @entrypoints Called by install.js command via ui.promptInstall(), returns complete configuration object
 * @patterns Progressive disclosure (prompts in order), early IDE selection (Windows compat), AgentVibes auto-detection
 * @related installer.js (consumes config), AgentVibes#34 (TTS integration), promptAgentVibes()
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('node:path');
const os = require('node:os');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { CLIUtils } = require('./cli-utils');

/**
 * UI utilities for the installer
 */
class UI {
  constructor() {}

  /**
   * Prompt for installation configuration
   * @returns {Object} Installation configuration
   */
  async promptInstall() {
    CLIUtils.displayLogo();
    const version = CLIUtils.getVersion();
    CLIUtils.displaySection('BMAD™ Setup', `Build More, Architect Dreams v${version}`);

    const confirmedDirectory = await this.getConfirmedDirectory();

    // Preflight: Check for legacy BMAD v4 footprints immediately after getting directory
    const { Detector } = require('../installers/lib/core/detector');
    const { Installer } = require('../installers/lib/core/installer');
    const detector = new Detector();
    const installer = new Installer();
    const legacyV4 = await detector.detectLegacyV4(confirmedDirectory);
    if (legacyV4.hasLegacyV4) {
      await installer.handleLegacyV4Migration(confirmedDirectory, legacyV4);
    }

    // Check if there's an existing BMAD installation
    const fs = require('fs-extra');
    const path = require('node:path');
    // Use findBmadDir to detect any custom folder names (V6+)
    const bmadDir = await installer.findBmadDir(confirmedDirectory);
    const hasExistingInstall = await fs.pathExists(bmadDir);

    // Track action type (only set if there's an existing installation)
    let actionType;

    // Only show action menu if there's an existing installation
    if (hasExistingInstall) {
      const promptResult = await inquirer.prompt([
        {
          type: 'list',
          name: 'actionType',
          message: 'What would you like to do?',
          choices: [
            { name: 'Quick Update (Settings Preserved)', value: 'quick-update' },
            { name: 'Modify BMAD Installation (Confirm or change each setting)', value: 'update' },
            { name: 'Remove BMad Folder and Reinstall (Full clean install - BMad Customization Will Be Lost)', value: 'reinstall' },
            { name: 'Compile Agents (Quick rebuild of all agent .md files)', value: 'compile' },
            { name: 'Cancel', value: 'cancel' },
          ],
          default: 'quick-update',
        },
      ]);

      // Extract actionType from prompt result
      actionType = promptResult.actionType;

      // Handle quick update separately
      if (actionType === 'quick-update') {
        return {
          actionType: 'quick-update',
          directory: confirmedDirectory,
        };
      }

      // Handle agent compilation separately
      if (actionType === 'compile') {
        return {
          actionType: 'compile',
          directory: confirmedDirectory,
        };
      }

      // Handle cancel
      if (actionType === 'cancel') {
        return {
          actionType: 'cancel',
          directory: confirmedDirectory,
        };
      }

      // Handle reinstall - DON'T return early, let it flow through configuration collection
      // The installer will handle deletion when it sees actionType === 'reinstall'
      // For now, just note that we're in reinstall mode and continue below

      // If actionType === 'update' or 'reinstall', continue with normal flow below
    }

    const { installedModuleIds } = await this.getExistingInstallation(confirmedDirectory);
    const coreConfig = await this.collectCoreConfig(confirmedDirectory);
    const moduleChoices = await this.getModuleChoices(installedModuleIds);
    const selectedModules = await this.selectModules(moduleChoices);

    // Check if custom module was selected
    let customContent = null;
    if (selectedModules.includes('custom')) {
      // Remove 'custom' from selectedModules since it's not a real module
      const customIndex = selectedModules.indexOf('custom');
      selectedModules.splice(customIndex, 1);

      // Handle custom content selection
      customContent = await this.handleCustomContentSelection(confirmedDirectory);

      // Add custom modules to the selected modules list for proper installation
      if (customContent && customContent.selectedItems && customContent.selectedItems.modules) {
        for (const customModule of customContent.selectedItems.modules) {
          selectedModules.push(`custom-${customModule.name}`);
        }
      }
    }

    // NOW collect module configurations (including custom modules that were just added)
    const moduleConfig = await this.collectModuleConfigs(confirmedDirectory, selectedModules, coreConfig);

    // Prompt for AgentVibes TTS integration
    const agentVibesConfig = await this.promptAgentVibes(confirmedDirectory);

    // Collect IDE tool selection AFTER configuration prompts (fixes Windows/PowerShell hang)
    // This allows text-based prompts to complete before the checkbox prompt
    const toolSelection = await this.promptToolSelection(confirmedDirectory, selectedModules);

    // No more screen clearing - keep output flowing

    return {
      actionType: actionType || 'update', // Preserve reinstall or update action
      directory: confirmedDirectory,
      installCore: true, // Always install core
      modules: selectedModules,
      // IDE selection collected after config, will be configured later
      ides: toolSelection.ides,
      skipIde: toolSelection.skipIde,
      coreConfig: coreConfig, // Pass collected core config to installer
      moduleConfig: moduleConfig, // Pass collected module configs (including custom modules)
      enableAgentVibes: agentVibesConfig.enabled, // AgentVibes TTS integration
      agentVibesInstalled: agentVibesConfig.alreadyInstalled,
      customContent: customContent, // Custom content to install
    };
  }

  /**
   * Handle custom content selection in module phase
   * @param {string} projectDir - Project directory
   * @returns {Object} Custom content info with selected items
   */
  async handleCustomContentSelection(projectDir) {
    const defaultPath = path.join(projectDir, 'bmad-custom-src');
    const hasDefaultFolder = await fs.pathExists(defaultPath);

    let customPath;

    if (hasDefaultFolder) {
      console.log(chalk.cyan('\n📁 Custom Content Detected'));
      console.log(chalk.dim(`Found custom folder at: ${defaultPath}`));

      const { useDetected } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useDetected',
          message: 'Install from detected custom folder?',
          default: true,
        },
      ]);

      if (useDetected) {
        customPath = defaultPath;
      }
    }

    if (!customPath) {
      console.log(chalk.cyan('\n📁 Custom Content Selection'));

      const { specifiedPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'specifiedPath',
          message: 'Enter path to custom content folder:',
          default: './bmad-custom-src',
          validate: async (input) => {
            if (!input.trim()) {
              return 'Path is required';
            }
            const resolvedPath = path.resolve(input.trim());
            if (!(await fs.pathExists(resolvedPath))) {
              return `Path does not exist: ${resolvedPath}`;
            }
            return true;
          },
        },
      ]);

      customPath = path.resolve(specifiedPath.trim());
    }

    // Discover and categorize custom content
    const customContent = await this.discoverAndSelectCustomContent(customPath);

    return {
      path: customPath,
      selectedItems: customContent,
    };
  }

  /**
   * Discover and allow selection of custom content
   * @param {string} customPath - Path to custom content
   * @returns {Object} Selected items by type
   */
  async discoverAndSelectCustomContent(customPath) {
    CLIUtils.displaySection('Custom Content', 'Discovering agents, workflows, and modules');

    // Discover each type
    const agents = await this.discoverCustomAgents(path.join(customPath, 'agents'));
    const workflows = await this.discoverCustomWorkflows(path.join(customPath, 'workflows'));
    const modules = await this.discoverCustomModules(path.join(customPath, 'modules'));

    // Build choices for selection
    const choices = [];

    if (agents.length > 0) {
      choices.push({ name: '--- 👥 Custom Agents ---', value: 'sep-agents', disabled: true });
      for (const agent of agents) {
        const shortDesc = agent.description.length > 50 ? agent.description.slice(0, 47) + '...' : agent.description;
        choices.push({
          name: `  ${agent.name} - ${shortDesc}`,
          value: { type: 'agent', ...agent },
          checked: true,
        });
      }
    }

    if (workflows.length > 0) {
      choices.push({ name: '--- 📋 Custom Workflows ---', value: 'sep-workflows', disabled: true });
      for (const workflow of workflows) {
        const shortDesc = workflow.description.length > 50 ? workflow.description.slice(0, 47) + '...' : workflow.description;
        choices.push({
          name: `  ${workflow.name} - ${shortDesc}`,
          value: { type: 'workflow', ...workflow },
          checked: true,
        });
      }
    }

    if (modules.length > 0) {
      choices.push({ name: '--- 🔧 Custom Modules ---', value: 'sep-modules', disabled: true });
      for (const module of modules) {
        const shortDesc = module.description.length > 50 ? module.description.slice(0, 47) + '...' : module.description;
        choices.push({
          name: `  ${module.name} - ${shortDesc}`,
          value: { type: 'module', ...module },
          checked: true,
        });
      }
    }

    if (choices.length === 0) {
      console.log(chalk.yellow('⚠️  No custom content found'));
      return { agents: [], workflows: [], modules: [] };
    }

    // Ask for selection
    const { selectedItems } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedItems',
        message: 'Select custom items to install:',
        choices: choices,
        pageSize: 15,
      },
    ]);

    // Organize by type
    const result = { agents: [], workflows: [], modules: [] };
    for (const item of selectedItems) {
      switch (item.type) {
        case 'agent': {
          result.agents.push(item);
          break;
        }
        case 'workflow': {
          result.workflows.push(item);
          break;
        }
        case 'module': {
          result.modules.push(item);
          break;
        }
      }
    }

    console.log(
      chalk.green(`\n✓ Selected: ${result.agents.length} agents, ${result.workflows.length} workflows, ${result.modules.length} modules`),
    );

    return result;
  }

  /**
   * Discover custom agents
   */
  async discoverCustomAgents(agentsPath) {
    const agents = [];
    if (!(await fs.pathExists(agentsPath))) return agents;

    const entries = await fs.readdir(agentsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const agentPath = path.join(agentsPath, entry.name);
        const yamlFiles = await fs.readdir(agentPath).then((files) => files.filter((f) => f.endsWith('.agent.yaml')));

        if (yamlFiles.length > 0) {
          const yamlPath = path.join(agentPath, yamlFiles[0]);
          const yamlData = yaml.load(await fs.readFile(yamlPath, 'utf8'));
          agents.push({
            name: entry.name,
            path: agentPath,
            yamlPath: yamlPath,
            description: yamlData.metadata?.description || yamlData.description || 'Custom agent',
            hasSidecar: true,
          });
        }
      } else if (entry.isFile() && entry.name.endsWith('.agent.yaml')) {
        const yamlData = yaml.load(await fs.readFile(path.join(agentsPath, entry.name), 'utf8'));
        agents.push({
          name: path.basename(entry.name, '.agent.yaml'),
          path: agentsPath,
          yamlPath: path.join(agentsPath, entry.name),
          description: yamlData.metadata?.description || yamlData.description || 'Custom agent',
          hasSidecar: false,
        });
      }
    }

    return agents;
  }

  /**
   * Discover custom workflows
   */
  async discoverCustomWorkflows(workflowsPath) {
    const workflows = [];
    if (!(await fs.pathExists(workflowsPath))) return workflows;

    const entries = await fs.readdir(workflowsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = path.join(workflowsPath, entry.name);
        const content = await fs.readFile(filePath, 'utf8');

        // Extract YAML frontmatter
        let title = path.basename(entry.name, '.md');
        let description = '';
        let yamlMetadata = {};

        // Check for YAML frontmatter
        if (content.startsWith('---\n')) {
          const frontmatterEnd = content.indexOf('\n---\n', 4);
          if (frontmatterEnd !== -1) {
            const yamlContent = content.slice(4, frontmatterEnd);
            try {
              yamlMetadata = yaml.load(yamlContent);
              title = yamlMetadata.name || yamlMetadata.title || title;
              description = yamlMetadata.description || yamlMetadata.summary || '';
            } catch {
              // If YAML parsing fails, fall back to markdown parsing
            }
          }
        }

        // If no YAML frontmatter or no metadata, parse from markdown
        if (!title || !description) {
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.startsWith('# ')) {
              title = line.slice(2).trim();
            } else if (line.startsWith('## Description:')) {
              description = line.replace('## Description:', '').trim();
            }
            if (title && description) break;
          }
        }

        workflows.push({
          name: title,
          path: filePath,
          description: description || 'Custom workflow',
          metadata: yamlMetadata,
        });
      } else if (entry.isDirectory()) {
        // Check for workflow.md in subdirectories
        const workflowMdPath = path.join(workflowsPath, entry.name, 'workflow.md');
        if (await fs.pathExists(workflowMdPath)) {
          const content = await fs.readFile(workflowMdPath, 'utf8');

          // Extract YAML frontmatter
          let title = entry.name;
          let description = '';
          let yamlMetadata = {};

          // Check for YAML frontmatter
          if (content.startsWith('---\n')) {
            const frontmatterEnd = content.indexOf('\n---\n', 4);
            if (frontmatterEnd !== -1) {
              const yamlContent = content.slice(4, frontmatterEnd);
              try {
                yamlMetadata = yaml.load(yamlContent);
                title = yamlMetadata.name || yamlMetadata.title || title;
                description = yamlMetadata.description || yamlMetadata.summary || '';
              } catch {
                // If YAML parsing fails, fall back to markdown parsing
              }
            }
          }

          // If no YAML frontmatter or no metadata, parse from markdown
          if (!title || !description) {
            const lines = content.split('\n');
            for (const line of lines) {
              if (line.startsWith('# ')) {
                title = line.slice(2).trim();
              } else if (line.startsWith('## Description:')) {
                description = line.replace('## Description:', '').trim();
              }
              if (title && description) break;
            }
          }

          workflows.push({
            name: title,
            path: path.join(workflowsPath, entry.name), // Store the DIRECTORY path, not the file
            description: description || 'Custom workflow',
            metadata: yamlMetadata,
          });
        }
      }
    }

    return workflows;
  }

  /**
   * Discover custom modules
   */
  async discoverCustomModules(modulesPath) {
    const modules = [];
    if (!(await fs.pathExists(modulesPath))) return modules;

    const entries = await fs.readdir(modulesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const modulePath = path.join(modulesPath, entry.name);
        const installerPath = path.join(modulePath, '_module-installer');

        if (await fs.pathExists(installerPath)) {
          // Check for install-config.yaml
          const configPath = path.join(installerPath, 'install-config.yaml');
          let description = 'Custom module';

          if (await fs.pathExists(configPath)) {
            const configData = yaml.load(await fs.readFile(configPath, 'utf8'));
            description = configData.header || configData.description || description;
          }

          modules.push({
            name: entry.name,
            path: modulePath,
            description: description,
          });
        }
      }
    }

    return modules;
  }

  /**
   * Handle custom content installation
   * @param {string} projectDir - Project directory
   */
  async handleCustomContent(projectDir) {
    const defaultPath = path.join(projectDir, 'bmad-custom-src');
    const hasDefaultFolder = await fs.pathExists(defaultPath);

    let customPath;

    if (hasDefaultFolder) {
      console.log(chalk.cyan('\n📁 Custom Content Detected'));
      console.log(chalk.dim(`Found custom folder at: ${defaultPath}`));

      const { useDetected } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useDetected',
          message: 'Install from detected custom folder?',
          default: true,
        },
      ]);

      if (useDetected) {
        customPath = defaultPath;
      }
    }

    if (!customPath) {
      console.log(chalk.cyan('\n📁 Custom Content Installation'));

      const { specifiedPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'specifiedPath',
          message: 'Enter path to custom content folder:',
          default: './bmad-custom-src',
          validate: async (input) => {
            if (!input.trim()) {
              return 'Path is required';
            }
            const resolvedPath = path.resolve(input.trim());
            if (!(await fs.pathExists(resolvedPath))) {
              return `Path does not exist: ${resolvedPath}`;
            }
            return true;
          },
        },
      ]);

      customPath = path.resolve(specifiedPath.trim());
    }

    // Discover custom content
    const customContent = {
      agents: await this.discoverCustomAgents(path.join(customPath, 'agents')),
      modules: await this.discoverCustomModules(path.join(customPath, 'modules')),
      workflows: await this.discoverCustomWorkflows(path.join(customPath, 'workflows')),
    };

    // Show discovery results
    console.log(chalk.cyan('\n🔍 Custom Content Discovery'));
    console.log(chalk.dim(`Scanning: ${customPath}`));

    if (customContent.agents.length > 0) {
      console.log(chalk.green(`  ✓ Found ${customContent.agents.length} custom agent(s)`));
    }
    if (customContent.modules.length > 0) {
      console.log(chalk.green(`  ✓ Found ${customContent.modules.length} custom module(s)`));
    }
    if (customContent.workflows.length > 0) {
      console.log(chalk.green(`  ✓ Found ${customContent.workflows.length} custom workflow(s)`));
    }

    if (customContent.agents.length === 0 && customContent.modules.length === 0 && customContent.workflows.length === 0) {
      console.log(chalk.yellow('  ⚠️  No custom content found in the specified folder'));
      return;
    }

    // Confirm installation
    const { confirmInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmInstall',
        message: 'Install discovered custom content?',
        default: true,
      },
    ]);

    if (confirmInstall) {
      console.log(chalk.green('\n🚀 Installing Custom Content...'));
      // Store custom content for later installation
      this._customContent = {
        path: customPath,
        items: customContent,
      };
      console.log(chalk.dim(`   Custom content queued for installation`));
    }
  }

  /**
   * Discover custom content in a directory
   * @param {string} dirPath - Directory path to scan
   * @returns {Promise<Array>} List of discovered items
   */
  async discoverCustomContent(dirPath) {
    const items = [];

    if (!(await fs.pathExists(dirPath))) {
      return items;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            type: 'directory',
          });
        } else if (entry.isFile() && (entry.name.endsWith('.agent.yaml') || entry.name.endsWith('.md'))) {
          items.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            type: 'file',
          });
        }
      }
    } catch {
      // Silently ignore errors during discovery
    }

    return items;
  }

  /**
   * Prompt for tool/IDE selection (called after module configuration)
   * @param {string} projectDir - Project directory to check for existing IDEs
   * @param {Array} selectedModules - Selected modules from configuration
   * @returns {Object} Tool configuration
   */
  async promptToolSelection(projectDir, selectedModules) {
    // Check for existing configured IDEs - use findBmadDir to detect custom folder names
    const { Detector } = require('../installers/lib/core/detector');
    const { Installer } = require('../installers/lib/core/installer');
    const detector = new Detector();
    const installer = new Installer();
    const bmadDir = await installer.findBmadDir(projectDir || process.cwd());
    const existingInstall = await detector.detect(bmadDir);
    const configuredIdes = existingInstall.ides || [];

    // Get IDE manager to fetch available IDEs dynamically
    const { IdeManager } = require('../installers/lib/ide/manager');
    const ideManager = new IdeManager();

    const preferredIdes = ideManager.getPreferredIdes();
    const otherIdes = ideManager.getOtherIdes();

    // Build IDE choices array with separators
    const ideChoices = [];
    const processedIdes = new Set();

    // First, add previously configured IDEs at the top, marked with ✅
    if (configuredIdes.length > 0) {
      ideChoices.push(new inquirer.Separator('── Previously Configured ──'));
      for (const ideValue of configuredIdes) {
        // Skip empty or invalid IDE values
        if (!ideValue || typeof ideValue !== 'string') {
          continue;
        }

        // Find the IDE in either preferred or other lists
        const preferredIde = preferredIdes.find((ide) => ide.value === ideValue);
        const otherIde = otherIdes.find((ide) => ide.value === ideValue);
        const ide = preferredIde || otherIde;

        if (ide) {
          ideChoices.push({
            name: `${ide.name} ✅`,
            value: ide.value,
            checked: true, // Previously configured IDEs are checked by default
          });
          processedIdes.add(ide.value);
        } else {
          // Warn about unrecognized IDE (but don't fail)
          console.log(chalk.yellow(`⚠️  Previously configured IDE '${ideValue}' is no longer available`));
        }
      }
    }

    // Add preferred tools (excluding already processed)
    const remainingPreferred = preferredIdes.filter((ide) => !processedIdes.has(ide.value));
    if (remainingPreferred.length > 0) {
      ideChoices.push(new inquirer.Separator('── Recommended Tools ──'));
      for (const ide of remainingPreferred) {
        ideChoices.push({
          name: `${ide.name} ⭐`,
          value: ide.value,
          checked: false,
        });
        processedIdes.add(ide.value);
      }
    }

    // Add other tools (excluding already processed)
    const remainingOther = otherIdes.filter((ide) => !processedIdes.has(ide.value));
    if (remainingOther.length > 0) {
      ideChoices.push(new inquirer.Separator('── Additional Tools ──'));
      for (const ide of remainingOther) {
        ideChoices.push({
          name: ide.name,
          value: ide.value,
          checked: false,
        });
      }
    }

    // Custom option moved to module selection

    CLIUtils.displaySection('Tool Integration', 'Select AI coding assistants and IDEs to configure');

    let answers;
    let userConfirmedNoTools = false;

    // Loop until user selects at least one tool OR explicitly confirms no tools
    while (!userConfirmedNoTools) {
      answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'ides',
          message: 'Select tools to configure:',
          choices: ideChoices,
          pageSize: 15,
        },
      ]);

      // Custom selection moved to module phase

      // If tools were selected, we're done
      if (answers.ides && answers.ides.length > 0) {
        break;
      }

      // Warn that no tools were selected - users often miss the spacebar requirement
      console.log();
      console.log(chalk.red.bold('⚠️  WARNING: No tools were selected!'));
      console.log(chalk.red('   You must press SPACEBAR to select items, then ENTER to confirm.'));
      console.log(chalk.red('   Simply highlighting an item does NOT select it.'));
      console.log();

      const { goBack } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'goBack',
          message: chalk.yellow('Would you like to go back and select at least one tool?'),
          default: true,
        },
      ]);

      if (goBack) {
        // Re-display the section header before looping back
        console.log();
        CLIUtils.displaySection('Tool Integration', 'Select AI coding assistants and IDEs to configure');
      } else {
        // User explicitly chose to proceed without tools
        userConfirmedNoTools = true;
      }
    }

    return {
      ides: answers.ides || [],
      skipIde: !answers.ides || answers.ides.length === 0,
      customContent: this._customContent || null,
    };
  }

  /**
   * Prompt for update configuration
   * @returns {Object} Update configuration
   */
  async promptUpdate() {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'backupFirst',
        message: 'Create backup before updating?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'preserveCustomizations',
        message: 'Preserve local customizations?',
        default: true,
      },
    ]);

    return answers;
  }

  /**
   * Prompt for module selection
   * @param {Array} modules - Available modules
   * @returns {Array} Selected modules
   */
  async promptModules(modules) {
    const choices = modules.map((mod) => ({
      name: `${mod.name} - ${mod.description}`,
      value: mod.id,
      checked: false,
    }));

    const { selectedModules } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedModules',
        message: 'Select modules to add:',
        choices,
        validate: (answer) => {
          if (answer.length === 0) {
            return 'You must choose at least one module.';
          }
          return true;
        },
      },
    ]);

    return selectedModules;
  }

  /**
   * Confirm action
   * @param {string} message - Confirmation message
   * @param {boolean} defaultValue - Default value
   * @returns {boolean} User confirmation
   */
  async confirm(message, defaultValue = false) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);

    return confirmed;
  }

  /**
   * Display installation summary
   * @param {Object} result - Installation result
   */
  showInstallSummary(result) {
    CLIUtils.displaySection('Installation Complete', 'BMAD™ has been successfully installed');

    const summary = [
      `📁 Installation Path: ${result.path}`,
      `📦 Modules Installed: ${result.modules?.length > 0 ? result.modules.join(', ') : 'core only'}`,
      `🔧 Tools Configured: ${result.ides?.length > 0 ? result.ides.join(', ') : 'none'}`,
    ];

    // Add AgentVibes TTS info if enabled
    if (result.agentVibesEnabled) {
      summary.push(`🎤 AgentVibes TTS: Enabled`);
    }

    CLIUtils.displayBox(summary.join('\n\n'), {
      borderColor: 'green',
      borderStyle: 'round',
    });

    // Display TTS injection details if present
    if (result.ttsInjectedFiles && result.ttsInjectedFiles.length > 0) {
      console.log('\n' + chalk.cyan.bold('═══════════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('            AgentVibes TTS Injection Summary'));
      console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));

      // Explain what TTS injection is
      console.log(chalk.white.bold('What is TTS Injection?\n'));
      console.log(chalk.dim('  TTS (Text-to-Speech) injection adds voice instructions to BMAD agents,'));
      console.log(chalk.dim('  enabling them to speak their responses aloud using AgentVibes.\n'));
      console.log(chalk.dim('  Example: When you activate the PM agent, it will greet you with'));
      console.log(chalk.dim('  spoken audio like "Hey! I\'m your Project Manager. How can I help?"\n'));

      console.log(chalk.green(`✅ TTS injection applied to ${result.ttsInjectedFiles.length} file(s):\n`));

      // Group by type
      const partyModeFiles = result.ttsInjectedFiles.filter((f) => f.type === 'party-mode');
      const agentTTSFiles = result.ttsInjectedFiles.filter((f) => f.type === 'agent-tts');

      if (partyModeFiles.length > 0) {
        console.log(chalk.yellow('  Party Mode (multi-agent conversations):'));
        for (const file of partyModeFiles) {
          console.log(chalk.dim(`    • ${file.path}`));
        }
      }

      if (agentTTSFiles.length > 0) {
        console.log(chalk.yellow('  Agent TTS (individual agent voices):'));
        for (const file of agentTTSFiles) {
          console.log(chalk.dim(`    • ${file.path}`));
        }
      }

      // Show backup info and restore command
      console.log('\n' + chalk.white.bold('Backups & Recovery:\n'));
      console.log(chalk.dim('  Pre-injection backups are stored in:'));
      console.log(chalk.cyan('    ~/.bmad-tts-backups/\n'));
      console.log(chalk.dim('  To restore original files (removes TTS instructions):'));
      console.log(chalk.cyan(`    bmad-tts-injector.sh --restore ${result.path}\n`));

      console.log(chalk.cyan('💡 BMAD agents will now speak when activated!'));
      console.log(chalk.dim('   Ensure AgentVibes is installed: https://agentvibes.org'));
    }

    console.log('\n' + chalk.green.bold('✨ BMAD is ready to use!'));
  }

  /**
   * Get confirmed directory from user
   * @returns {string} Confirmed directory path
   */
  async getConfirmedDirectory() {
    let confirmedDirectory = null;
    while (!confirmedDirectory) {
      const directoryAnswer = await this.promptForDirectory();
      await this.displayDirectoryInfo(directoryAnswer.directory);

      if (await this.confirmDirectory(directoryAnswer.directory)) {
        confirmedDirectory = directoryAnswer.directory;
      }
    }
    return confirmedDirectory;
  }

  /**
   * Get existing installation info and installed modules
   * @param {string} directory - Installation directory
   * @returns {Object} Object with existingInstall and installedModuleIds
   */
  async getExistingInstallation(directory) {
    const { Detector } = require('../installers/lib/core/detector');
    const { Installer } = require('../installers/lib/core/installer');
    const detector = new Detector();
    const installer = new Installer();
    const bmadDir = await installer.findBmadDir(directory);
    const existingInstall = await detector.detect(bmadDir);
    const installedModuleIds = new Set(existingInstall.modules.map((mod) => mod.id));

    return { existingInstall, installedModuleIds };
  }

  /**
   * Collect core configuration
   * @param {string} directory - Installation directory
   * @returns {Object} Core configuration
   */
  async collectCoreConfig(directory) {
    const { ConfigCollector } = require('../installers/lib/core/config-collector');
    const configCollector = new ConfigCollector();
    // Load existing configs first if they exist
    await configCollector.loadExistingConfig(directory);
    // Now collect with existing values as defaults (false = don't skip loading, true = skip completion message)
    await configCollector.collectModuleConfig('core', directory, false, true);

    return configCollector.collectedConfig.core;
  }

  /**
   * Collect module configurations
   * @param {string} directory - Installation directory
   * @param {Array} modules - Selected modules
   * @param {Object} existingCoreConfig - Core config already collected
   * @returns {Object} Module configurations
   */
  async collectModuleConfigs(directory, modules, existingCoreConfig = null) {
    const { ConfigCollector } = require('../installers/lib/core/config-collector');
    const configCollector = new ConfigCollector();

    // Load existing configs first if they exist
    await configCollector.loadExistingConfig(directory);

    // If core config was already collected, use it
    if (existingCoreConfig) {
      configCollector.collectedConfig.core = existingCoreConfig;
    }

    // Collect configurations for all modules except core (already collected earlier)
    // ConfigCollector now handles custom modules properly
    const modulesWithoutCore = modules.filter((m) => m !== 'core');
    if (modulesWithoutCore.length > 0) {
      await configCollector.collectAllConfigurations(modulesWithoutCore, directory);
    }

    return configCollector.collectedConfig;
  }

  /**
   * Get module choices for selection
   * @param {Set} installedModuleIds - Currently installed module IDs
   * @returns {Array} Module choices for inquirer
   */
  async getModuleChoices(installedModuleIds) {
    const { ModuleManager } = require('../installers/lib/modules/manager');
    const moduleManager = new ModuleManager();
    const availableModules = await moduleManager.listAvailable();

    const isNewInstallation = installedModuleIds.size === 0;
    const moduleChoices = availableModules.map((mod) => ({
      name: mod.name,
      value: mod.id,
      checked: isNewInstallation ? mod.defaultSelected || false : installedModuleIds.has(mod.id),
    }));

    // Check for custom source folder
    const customPath = path.join(process.cwd(), 'bmad-custom-src');
    const hasCustomFolder = await fs.pathExists(customPath);

    // Add custom option at the beginning
    if (hasCustomFolder) {
      moduleChoices.unshift({
        name: '📁 Custom: Agents, Workflows, Modules',
        value: 'custom',
        checked: false,
      });
    } else {
      moduleChoices.unshift({
        name: '📁 Custom: Agents, Workflows, Modules (specify path)',
        value: 'custom',
        checked: false,
      });
    }

    return moduleChoices;
  }

  /**
   * Prompt for module selection
   * @param {Array} moduleChoices - Available module choices
   * @returns {Array} Selected module IDs
   */
  async selectModules(moduleChoices) {
    CLIUtils.displaySection('Module Selection', 'Choose the BMAD modules to install');

    const moduleAnswer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'modules',
        message: 'Select modules to install:',
        choices: moduleChoices,
      },
    ]);

    return moduleAnswer.modules || [];
  }

  /**
   * Prompt for directory selection
   * @returns {Object} Directory answer from inquirer
   */
  async promptForDirectory() {
    return await inquirer.prompt([
      {
        type: 'input',
        name: 'directory',
        message: `Installation directory:`,
        default: process.cwd(),
        validate: async (input) => this.validateDirectory(input),
        filter: (input) => {
          // If empty, use the default
          if (!input || input.trim() === '') {
            return process.cwd();
          }
          return this.expandUserPath(input);
        },
      },
    ]);
  }

  /**
   * Display directory information
   * @param {string} directory - The directory path
   */
  async displayDirectoryInfo(directory) {
    console.log(chalk.cyan('\nResolved installation path:'), chalk.bold(directory));

    const dirExists = await fs.pathExists(directory);
    if (dirExists) {
      // Show helpful context about the existing path
      const stats = await fs.stat(directory);
      if (stats.isDirectory()) {
        const files = await fs.readdir(directory);
        if (files.length > 0) {
          // Check for any bmad installation (any folder with _cfg/manifest.yaml)
          const { Installer } = require('../installers/lib/core/installer');
          const installer = new Installer();
          const bmadDir = await installer.findBmadDir(directory);
          const hasBmadInstall = (await fs.pathExists(bmadDir)) && (await fs.pathExists(path.join(bmadDir, '_cfg', 'manifest.yaml')));

          console.log(
            chalk.gray(`Directory exists and contains ${files.length} item(s)`) +
              (hasBmadInstall ? chalk.yellow(` including existing BMAD installation (${path.basename(bmadDir)})`) : ''),
          );
        } else {
          console.log(chalk.gray('Directory exists and is empty'));
        }
      }
    }
  }

  /**
   * Confirm directory selection
   * @param {string} directory - The directory path
   * @returns {boolean} Whether user confirmed
   */
  async confirmDirectory(directory) {
    const dirExists = await fs.pathExists(directory);

    if (dirExists) {
      const confirmAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Install to this directory?`,
          default: true,
        },
      ]);

      if (!confirmAnswer.proceed) {
        console.log(chalk.yellow("\nLet's try again with a different path.\n"));
      }

      return confirmAnswer.proceed;
    } else {
      // Ask for confirmation to create the directory
      const createConfirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: `The directory '${directory}' doesn't exist. Would you like to create it?`,
          default: false,
        },
      ]);

      if (!createConfirm.create) {
        console.log(chalk.yellow("\nLet's try again with a different path.\n"));
      }

      return createConfirm.create;
    }
  }

  /**
   * Validate directory path for installation
   * @param {string} input - User input path
   * @returns {string|true} Error message or true if valid
   */
  async validateDirectory(input) {
    // Allow empty input to use the default
    if (!input || input.trim() === '') {
      return true; // Empty means use default
    }

    let expandedPath;
    try {
      expandedPath = this.expandUserPath(input.trim());
    } catch (error) {
      return error.message;
    }

    // Check if the path exists
    const pathExists = await fs.pathExists(expandedPath);

    if (!pathExists) {
      // Find the first existing parent directory
      const existingParent = await this.findExistingParent(expandedPath);

      if (!existingParent) {
        return 'Cannot create directory: no existing parent directory found';
      }

      // Check if the existing parent is writable
      try {
        await fs.access(existingParent, fs.constants.W_OK);
        // Path doesn't exist but can be created - will prompt for confirmation later
        return true;
      } catch {
        // Provide a detailed error message explaining both issues
        return `Directory '${expandedPath}' does not exist and cannot be created: parent directory '${existingParent}' is not writable`;
      }
    }

    // If it exists, validate it's a directory and writable
    const stat = await fs.stat(expandedPath);
    if (!stat.isDirectory()) {
      return `Path exists but is not a directory: ${expandedPath}`;
    }

    // Check write permissions
    try {
      await fs.access(expandedPath, fs.constants.W_OK);
    } catch {
      return `Directory is not writable: ${expandedPath}`;
    }

    return true;
  }

  /**
   * Find the first existing parent directory
   * @param {string} targetPath - The path to check
   * @returns {string|null} The first existing parent directory, or null if none found
   */
  async findExistingParent(targetPath) {
    let currentPath = path.resolve(targetPath);

    // Walk up the directory tree until we find an existing directory
    while (currentPath !== path.dirname(currentPath)) {
      // Stop at root
      const parent = path.dirname(currentPath);
      if (await fs.pathExists(parent)) {
        return parent;
      }
      currentPath = parent;
    }

    return null; // No existing parent found (shouldn't happen in practice)
  }

  /**
   * Expands the user-provided path: handles ~ and resolves to absolute.
   * @param {string} inputPath - User input path.
   * @returns {string} Absolute expanded path.
   */
  expandUserPath(inputPath) {
    if (typeof inputPath !== 'string') {
      throw new TypeError('Path must be a string.');
    }

    let expanded = inputPath.trim();

    // Handle tilde expansion
    if (expanded.startsWith('~')) {
      if (expanded === '~') {
        expanded = os.homedir();
      } else if (expanded.startsWith('~' + path.sep)) {
        const pathAfterHome = expanded.slice(2); // Remove ~/ or ~\
        expanded = path.join(os.homedir(), pathAfterHome);
      } else {
        const restOfPath = expanded.slice(1);
        const separatorIndex = restOfPath.indexOf(path.sep);
        const username = separatorIndex === -1 ? restOfPath : restOfPath.slice(0, separatorIndex);
        if (username) {
          throw new Error(`Path expansion for ~${username} is not supported. Please use an absolute path or ~${path.sep}`);
        }
      }
    }

    // Resolve to the absolute path relative to the current working directory
    return path.resolve(expanded);
  }

  /**
   * @function promptAgentVibes
   * @intent Ask user if they want AgentVibes TTS integration during BMAD installation
   * @why Enables optional voice features without forcing TTS on users who don't want it
   * @param {string} projectDir - Absolute path to user's project directory
   * @returns {Promise<Object>} Configuration object: { enabled: boolean, alreadyInstalled: boolean }
   * @sideeffects None - pure user input collection, no files written
   * @edgecases Shows warning if user enables TTS but AgentVibes not detected
   * @calledby promptInstall() during installation flow, after core config, before IDE selection
   * @calls checkAgentVibesInstalled(), inquirer.prompt(), chalk.green/yellow/dim()
   *
   * AI NOTE: This prompt is strategically positioned in installation flow:
   * - AFTER core config (bmad_folder, user_name, etc)
   * - BEFORE IDE selection (which can hang on Windows/PowerShell)
   *
   * Flow Logic:
   * 1. Auto-detect if AgentVibes already installed (checks for hook files)
   * 2. Show detection status to user (green checkmark or gray "not detected")
   * 3. Prompt: "Enable AgentVibes TTS?" (defaults to true if detected)
   * 4. If user says YES but AgentVibes NOT installed:
   *    → Show warning with installation link (graceful degradation)
   * 5. Return config to promptInstall(), which passes to installer.install()
   *
   * State Flow:
   * promptAgentVibes() → { enabled, alreadyInstalled }
   *                    ↓
   * promptInstall() → config.enableAgentVibes
   *                    ↓
   * installer.install() → this.enableAgentVibes
   *                    ↓
   * processTTSInjectionPoints() → injects OR strips markers
   *
   * RELATED:
   * ========
   * - Detection: checkAgentVibesInstalled() - looks for bmad-speak.sh and play-tts.sh
   * - Processing: installer.js::processTTSInjectionPoints()
   * - Markers: src/core/workflows/party-mode/instructions.md:101, src/modules/bmm/agents/*.md
   * - GitHub Issue: paulpreibisch/AgentVibes#36
   */
  async promptAgentVibes(projectDir) {
    CLIUtils.displaySection('🎤 Voice Features', 'Enable TTS for multi-agent conversations');

    // Check if AgentVibes is already installed
    const agentVibesInstalled = await this.checkAgentVibesInstalled(projectDir);

    if (agentVibesInstalled) {
      console.log(chalk.green('  ✓ AgentVibes detected'));
    } else {
      console.log(chalk.dim('  AgentVibes not detected'));
    }

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableTts',
        message: 'Enable Agents to Speak Out loud (powered by Agent Vibes? Claude Code only currently)',
        default: false, // Default to yes - recommended for best experience
      },
    ]);

    if (answers.enableTts && !agentVibesInstalled) {
      console.log(chalk.yellow('\n  ⚠️  AgentVibes not installed'));
      console.log(chalk.dim('  Install AgentVibes separately to enable TTS:'));
      console.log(chalk.dim('  https://github.com/paulpreibisch/AgentVibes\n'));
    }

    return {
      enabled: answers.enableTts,
      alreadyInstalled: agentVibesInstalled,
    };
  }

  /**
   * @function checkAgentVibesInstalled
   * @intent Detect if AgentVibes TTS hooks are present in user's project
   * @why Allows auto-enabling TTS and showing helpful installation guidance
   * @param {string} projectDir - Absolute path to user's project directory
   * @returns {Promise<boolean>} true if both required AgentVibes hooks exist, false otherwise
   * @sideeffects None - read-only file existence checks
   * @edgecases Returns false if either hook missing (both required for functional TTS)
   * @calledby promptAgentVibes() to determine default value and show detection status
   * @calls fs.pathExists() twice (bmad-speak.sh, play-tts.sh)
   *
   * AI NOTE: This checks for the MINIMUM viable AgentVibes installation.
   *
   * Required Files:
   * ===============
   * 1. .claude/hooks/bmad-speak.sh
   *    - Maps agent display names → agent IDs → voice profiles
   *    - Calls play-tts.sh with agent's assigned voice
   *    - Created by AgentVibes installer
   *
   * 2. .claude/hooks/play-tts.sh
   *    - Core TTS router (ElevenLabs or Piper)
   *    - Provider-agnostic interface
   *    - Required by bmad-speak.sh
   *
   * Why Both Required:
   * ==================
   * - bmad-speak.sh alone: No TTS backend
   * - play-tts.sh alone: No BMAD agent voice mapping
   * - Both together: Full party mode TTS integration
   *
   * Detection Strategy:
   * ===================
   * We use simple file existence (not version checks) because:
   * - Fast and reliable
   * - Works across all AgentVibes versions
   * - User will discover version issues when TTS runs (fail-fast)
   *
   * PATTERN: Adding New Detection Criteria
   * =======================================
   * If future AgentVibes features require additional files:
   * 1. Add new pathExists check to this function
   * 2. Update documentation in promptAgentVibes()
   * 3. Consider: should missing file prevent detection or just log warning?
   *
   * RELATED:
   * ========
   * - AgentVibes Installer: creates these hooks
   * - bmad-speak.sh: calls play-tts.sh with agent voices
   * - Party Mode: uses bmad-speak.sh for agent dialogue
   */
  async checkAgentVibesInstalled(projectDir) {
    const fs = require('fs-extra');
    const path = require('node:path');

    // Check for AgentVibes hook files
    const hookPath = path.join(projectDir, '.claude', 'hooks', 'bmad-speak.sh');
    const playTtsPath = path.join(projectDir, '.claude', 'hooks', 'play-tts.sh');

    return (await fs.pathExists(hookPath)) && (await fs.pathExists(playTtsPath));
  }
}

module.exports = { UI };
