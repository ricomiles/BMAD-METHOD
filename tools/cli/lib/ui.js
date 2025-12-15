const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('node:path');
const os = require('node:os');
const fs = require('fs-extra');
const { CLIUtils } = require('./cli-utils');
const { CustomHandler } = require('../installers/lib/custom/handler');

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

    // Check for legacy folders and prompt for rename before showing any menus
    let hasLegacyCfg = false;
    let hasLegacyBmadFolder = false;
    let bmadDir = null;
    let legacyBmadPath = null;

    // First check for legacy .bmad folder (instead of _bmad)
    // Only check if directory exists
    if (await fs.pathExists(confirmedDirectory)) {
      const entries = await fs.readdir(confirmedDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name === '.bmad') {
          hasLegacyBmadFolder = true;
          legacyBmadPath = path.join(confirmedDirectory, '.bmad');
          bmadDir = legacyBmadPath;

          // Check if it has _cfg folder
          const cfgPath = path.join(legacyBmadPath, '_cfg');
          if (await fs.pathExists(cfgPath)) {
            hasLegacyCfg = true;
          }
          break;
        }
      }
    }

    // If no .bmad found, check for current installations
    if (!hasLegacyBmadFolder) {
      const bmadResult = await installer.findBmadDir(confirmedDirectory);
      bmadDir = bmadResult.bmadDir;
      hasLegacyCfg = bmadResult.hasLegacyCfg;
    }

    if (hasLegacyBmadFolder || hasLegacyCfg) {
      console.log(chalk.yellow('\n⚠️  Legacy folder structure detected'));

      let message = 'The following folders need to be renamed:\n';
      if (hasLegacyBmadFolder) {
        message += chalk.dim(`  • ".bmad" → "_bmad"\n`);
      }
      if (hasLegacyCfg) {
        message += chalk.dim(`  • "_cfg" → "_config"\n`);
      }
      console.log(message);

      const { shouldRename } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldRename',
          message: 'Would you like the installer to rename these folders for you?',
          default: true,
        },
      ]);

      if (!shouldRename) {
        console.log(chalk.red('\n❌ Installation cancelled'));
        console.log(chalk.dim('You must manually rename the folders before proceeding:'));
        if (hasLegacyBmadFolder) {
          console.log(chalk.dim(`  • Rename ".bmad" to "_bmad"`));
        }
        if (hasLegacyCfg) {
          console.log(chalk.dim(`  • Rename "_cfg" to "_config"`));
        }
        process.exit(0);
        return;
      }

      // Perform the renames
      const ora = require('ora');
      const spinner = ora('Updating folder structure...').start();

      try {
        // First rename .bmad to _bmad if needed
        if (hasLegacyBmadFolder) {
          const newBmadPath = path.join(confirmedDirectory, '_bmad');
          await fs.move(legacyBmadPath, newBmadPath);
          bmadDir = newBmadPath;
          spinner.succeed('Renamed ".bmad" to "_bmad"');
        }

        // Then rename _cfg to _config if needed
        if (hasLegacyCfg) {
          spinner.start('Renaming configuration folder...');
          const oldCfgPath = path.join(bmadDir, '_cfg');
          const newCfgPath = path.join(bmadDir, '_config');
          await fs.move(oldCfgPath, newCfgPath);
          spinner.succeed('Renamed "_cfg" to "_config"');
        }

        spinner.succeed('Folder structure updated successfully');
      } catch (error) {
        spinner.fail('Failed to update folder structure');
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    }

    // Check if there's an existing BMAD installation (after any folder renames)
    const hasExistingInstall = await fs.pathExists(bmadDir);

    // Collect IDE tool selection early - we need this to know if we should ask about TTS
    let toolSelection;
    let agentVibesConfig = { enabled: false, alreadyInstalled: false };
    let claudeCodeSelected = false;

    if (!hasExistingInstall) {
      // For new installations, collect IDE selection first
      // We don't have modules yet, so pass empty array
      toolSelection = await this.promptToolSelection(confirmedDirectory, []);

      // Check if Claude Code was selected
      claudeCodeSelected = toolSelection.ides && toolSelection.ides.includes('claude-code');

      // If Claude Code was selected, ask about TTS
      if (claudeCodeSelected) {
        const { enableTts } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enableTts',
            message: 'Claude Code supports TTS (Text-to-Speech). Would you like to enable it?',
            default: false,
          },
        ]);

        if (enableTts) {
          agentVibesConfig = { enabled: true, alreadyInstalled: false };
        }
      }
    }

    // Always ask for custom content, but we'll handle it differently for new installs
    let customContentConfig = { hasCustomContent: false };
    if (hasExistingInstall) {
      // Existing installation - prompt to add/update custom content
      customContentConfig = await this.promptCustomContentForExisting();
    } else {
      // New installation - we'll prompt after creating the directory structure
      // For now, set a flag to indicate we should ask later
      customContentConfig._shouldAsk = true;
    }

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
            { name: 'Add Custom Content', value: 'add-custom' },
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
        // Quick update doesn't install custom content - just updates existing modules
        return {
          actionType: 'quick-update',
          directory: confirmedDirectory,
          customContent: { hasCustomContent: false },
        };
      }

      // Handle add custom content separately
      if (actionType === 'add-custom') {
        customContentConfig = await this.promptCustomContentSource();
        // After adding custom content, continue to select additional modules
        const { installedModuleIds } = await this.getExistingInstallation(confirmedDirectory);

        // Ask if user wants to add additional modules
        const { wantsMoreModules } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'wantsMoreModules',
            message: 'Do you want to add any additional modules?',
            default: false,
          },
        ]);

        let selectedModules = [];
        if (wantsMoreModules) {
          const moduleChoices = await this.getModuleChoices(installedModuleIds, customContentConfig);
          selectedModules = await this.selectModules(moduleChoices);

          // Process custom content selection
          const selectedCustomContent = selectedModules.filter((mod) => mod.startsWith('__CUSTOM_CONTENT__'));

          if (selectedCustomContent.length > 0) {
            customContentConfig.selected = true;
            customContentConfig.selectedFiles = selectedCustomContent.map((mod) => mod.replace('__CUSTOM_CONTENT__', ''));

            // Convert to module IDs
            const customContentModuleIds = [];
            const customHandler = new CustomHandler();
            for (const customFile of customContentConfig.selectedFiles) {
              const customInfo = await customHandler.getCustomInfo(customFile);
              if (customInfo) {
                customContentModuleIds.push(customInfo.id);
              }
            }
            selectedModules = [...selectedModules.filter((mod) => !mod.startsWith('__CUSTOM_CONTENT__')), ...customContentModuleIds];
          }
        }

        return {
          actionType: 'update',
          directory: confirmedDirectory,
          installCore: false, // Don't reinstall core
          modules: selectedModules,
          customContent: customContentConfig,
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

    // For new installations, ask about content types first
    if (!hasExistingInstall) {
      // Ask about custom content first
      const { wantsCustomContent } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'wantsCustomContent',
          message: 'Will you be installing any custom content?',
          default: false,
        },
      ]);

      if (wantsCustomContent) {
        customContentConfig = await this.promptCustomContentSource();
      }

      // Then ask about official modules
      const { wantsOfficialModules } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'wantsOfficialModules',
          message: 'Will you be installing any official modules?',
          default: true,
        },
      ]);

      let selectedOfficialModules = [];
      if (wantsOfficialModules) {
        const { installedModuleIds } = await this.getExistingInstallation(confirmedDirectory);
        const moduleChoices = await this.getModuleChoices(installedModuleIds, { hasCustomContent: false });
        selectedOfficialModules = await this.selectModules(moduleChoices);
      }

      // Store the selected modules for later
      customContentConfig._selectedOfficialModules = selectedOfficialModules;
    }

    const { installedModuleIds } = await this.getExistingInstallation(confirmedDirectory);

    // Collect core configuration first
    const coreConfig = await this.collectCoreConfig(confirmedDirectory);

    // Custom content will be handled during installation phase
    // Store the custom content config for later use
    if (customContentConfig._shouldAsk) {
      delete customContentConfig._shouldAsk;
    }

    // Handle module selection
    let selectedModules = [];
    if (actionType === 'update' || actionType === 'reinstall') {
      // Keep all existing installed modules during update/reinstall
      selectedModules = [...installedModuleIds];
      console.log(chalk.cyan('\n📦 Keeping existing modules: ') + selectedModules.join(', '));
    } else if (!hasExistingInstall) {
      // For new installs, we've already selected official modules
      selectedModules = customContentConfig._selectedOfficialModules || [];

      // Add custom content modules if any were selected
      if (customContentConfig && customContentConfig.selectedModuleIds) {
        selectedModules = [...selectedModules, ...customContentConfig.selectedModuleIds];
      }

      // Custom modules are already added via selectedModuleIds from customContentConfig
      // No need for additional processing here
    }

    // AgentVibes TTS configuration already collected earlier for new installations
    // For existing installations, keep the old behavior
    if (hasExistingInstall && !agentVibesConfig.enabled) {
      agentVibesConfig = await this.promptAgentVibes(confirmedDirectory);
    }

    // Tool selection already collected for new installations
    // For existing installations, we need to collect it now
    if (hasExistingInstall && !toolSelection) {
      const modulesForToolSelection = selectedModules;
      toolSelection = await this.promptToolSelection(confirmedDirectory, modulesForToolSelection);
    }

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
      // Custom content configuration
      customContent: customContentConfig,
      enableAgentVibes: agentVibesConfig.enabled,
      agentVibesInstalled: agentVibesConfig.alreadyInstalled,
    };
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
    const bmadResult = await installer.findBmadDir(projectDir || process.cwd());
    const bmadDir = bmadResult.bmadDir;
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
      console.log(chalk.cyan('    ~/_bmad-tts-backups/\n'));
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
   * Get module choices for selection
   * @param {Set} installedModuleIds - Currently installed module IDs
   * @param {Object} customContentConfig - Custom content configuration
   * @returns {Array} Module choices for inquirer
   */
  async getModuleChoices(installedModuleIds, customContentConfig = null) {
    const moduleChoices = [];
    const isNewInstallation = installedModuleIds.size === 0;

    const customContentItems = [];
    const hasCustomContentItems = false;

    // Add custom content items
    if (customContentConfig && customContentConfig.hasCustomContent && customContentConfig.customPath) {
      // Existing installation - show from directory
      const customHandler = new CustomHandler();
      const customFiles = await customHandler.findCustomContent(customContentConfig.customPath);

      for (const customFile of customFiles) {
        const customInfo = await customHandler.getCustomInfo(customFile);
        if (customInfo) {
          customContentItems.push({
            name: `${chalk.cyan('✓')} ${customInfo.name} ${chalk.gray(`(${customInfo.relativePath})`)}`,
            value: `__CUSTOM_CONTENT__${customFile}`, // Unique value for each custom content
            checked: true, // Default to selected since user chose to provide custom content
            path: customInfo.path, // Track path to avoid duplicates
          });
        }
      }
    }

    // Add official modules
    const { ModuleManager } = require('../installers/lib/modules/manager');
    // For new installations, don't scan project yet (will do after custom content is discovered)
    // For existing installations, scan if user selected custom content
    const shouldScanProject =
      !isNewInstallation && customContentConfig && customContentConfig.hasCustomContent && customContentConfig.selected;
    const moduleManager = new ModuleManager({
      scanProjectForModules: shouldScanProject,
    });
    const { modules: availableModules, customModules: customModulesFromProject } = await moduleManager.listAvailable();

    // First, add all items to appropriate sections
    const allCustomModules = [];

    // Add custom content items from directory
    allCustomModules.push(...customContentItems);

    // Add custom modules from project scan (if scanning is enabled)
    for (const mod of customModulesFromProject) {
      // Skip if this module is already in customContentItems (by path)
      const isDuplicate = allCustomModules.some((item) => item.path && mod.path && path.resolve(item.path) === path.resolve(mod.path));

      if (!isDuplicate) {
        allCustomModules.push({
          name: `${chalk.cyan('✓')} ${mod.name} ${chalk.gray(`(${mod.source})`)}`,
          value: mod.id,
          checked: isNewInstallation ? mod.defaultSelected || false : installedModuleIds.has(mod.id),
        });
      }
    }

    // Add separators and modules in correct order
    if (allCustomModules.length > 0) {
      // Add separator for custom content, all custom modules, and official content separator
      moduleChoices.push(
        new inquirer.Separator('── Custom Content ──'),
        ...allCustomModules,
        new inquirer.Separator('── Official Content ──'),
      );
    }

    // Add official modules (only non-custom ones)
    for (const mod of availableModules) {
      if (!mod.isCustom) {
        moduleChoices.push({
          name: mod.name,
          value: mod.id,
          checked: isNewInstallation ? mod.defaultSelected || false : installedModuleIds.has(mod.id),
        });
      }
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
          // Check for any bmad installation (any folder with _config/manifest.yaml)
          const { Installer } = require('../installers/lib/core/installer');
          const installer = new Installer();
          const bmadDir = await installer.findBmadDir(directory);
          const hasBmadInstall = (await fs.pathExists(bmadDir)) && (await fs.pathExists(path.join(bmadDir, '_config', 'manifest.yaml')));

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
   * - AFTER core config (user_name, etc)
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

  /**
   * Prompt for custom content for existing installations
   * @returns {Object} Custom content configuration
   */
  async promptCustomContentForExisting() {
    try {
      // Skip custom content installation - always return false
      return { hasCustomContent: false };

      // TODO: Custom content installation temporarily disabled
      // CLIUtils.displaySection('Custom Content', 'Add new custom agents, workflows, or modules to your installation');

      // const { hasCustomContent } = await inquirer.prompt([
      //   {
      //     type: 'list',
      //     name: 'hasCustomContent',
      //     message: 'Do you want to add or update custom content?',
      //     choices: [
      //       {
      //         name: 'No, continue with current installation only',
      //         value: false,
      //       },
      //       {
      //         name: 'Yes, I have custom content to add or update',
      //         value: true,
      //       },
      //     ],
      //     default: false,
      //   },
      // ]);

      // if (!hasCustomContent) {
      //   return { hasCustomContent: false };
      // }

      // TODO: Custom content installation temporarily disabled
      // // Get directory path
      // const { customPath } = await inquirer.prompt([
      //   {
      //     type: 'input',
      //     name: 'customPath',
      //     message: 'Enter directory to search for custom content (will scan subfolders):',
      //     default: process.cwd(),
      //     validate: async (input) => {
      //       if (!input || input.trim() === '') {
      //         return 'Please enter a directory path';
      //       }

      //       // Normalize and check if path exists
      //       const expandedPath = CLIUtils.expandPath(input.trim());
      //       const pathExists = await fs.pathExists(expandedPath);
      //       if (!pathExists) {
      //         return 'Directory does not exist';
      //       }

      //       // Check if it's actually a directory
      //       const stats = await fs.stat(expandedPath);
      //       if (!stats.isDirectory()) {
      //         return 'Path must be a directory';
      //       }

      //       return true;
      //     },
      //     transformer: (input) => {
      //       return CLIUtils.expandPath(input);
      //     },
      //   },
      // ]);

      // const resolvedPath = CLIUtils.expandPath(customPath);

      // // Find custom content
      // const customHandler = new CustomHandler();
      // const customFiles = await customHandler.findCustomContent(resolvedPath);

      // if (customFiles.length === 0) {
      //   console.log(chalk.yellow(`\nNo custom content found in ${resolvedPath}`));

      //   const { tryDifferent } = await inquirer.prompt([
      //     {
      //       type: 'confirm',
      //       name: 'tryDifferent',
      //       message: 'Try a different directory?',
      //       default: true,
      //     },
      //   ]);

      //   if (tryDifferent) {
      //     return await this.promptCustomContentForExisting();
      //   }

      //   return { hasCustomContent: false };
      // }

      // // Display found items
      // console.log(chalk.cyan(`\nFound ${customFiles.length} custom content file(s):`));
      // const customContentItems = [];

      // for (const customFile of customFiles) {
      //   const customInfo = await customHandler.getCustomInfo(customFile);
      //   if (customInfo) {
      //     customContentItems.push({
      //       name: `${chalk.cyan('✓')} ${customInfo.name} ${chalk.gray(`(${customInfo.relativePath})`)}`,
      //       value: `__CUSTOM_CONTENT__${customFile}`,
      //       checked: true,
      //     });
      //   }
      // }

      // // Add option to keep existing custom content
      // console.log(chalk.yellow('\nExisting custom modules will be preserved unless you remove them'));

      // const { selectedFiles } = await inquirer.prompt([
      //   {
      //     type: 'checkbox',
      //     name: 'selectedFiles',
      //     message: 'Select custom content to add:',
      //     choices: customContentItems,
      //     pageSize: 15,
      //     validate: (answer) => {
      //       if (answer.length === 0) {
      //         return 'You must select at least one item';
      //       }
      //       return true;
      //     },
      //   },
      // ]);

      // return {
      //   hasCustomContent: true,
      //   customPath: resolvedPath,
      //   selected: true,
      //   selectedFiles: selectedFiles,
      // };
    } catch (error) {
      console.error(chalk.red('Error configuring custom content:'), error);
      return { hasCustomContent: false };
    }
  }

  /**
   * Prompt user for custom content source location
   * @returns {Object} Custom content configuration
   */
  async promptCustomContentSource() {
    const customContentConfig = { hasCustomContent: true, sources: [] };

    // Keep asking for more sources until user is done
    while (true) {
      console.log(chalk.cyan('\n📦 Adding Custom Content'));

      let sourcePath;
      let isValid = false;

      while (!isValid) {
        const { path: inputPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'path',
            message: 'Enter the path to your custom content folder:',
            validate: async (input) => {
              if (!input || input.trim() === '') {
                return 'Path is required';
              }

              try {
                // Expand the path
                const expandedPath = this.expandUserPath(input.trim());

                // Check if path exists
                if (!(await fs.pathExists(expandedPath))) {
                  return 'Path does not exist';
                }

                // Check if it's a directory
                const stat = await fs.stat(expandedPath);
                if (!stat.isDirectory()) {
                  return 'Path must be a directory';
                }

                // Check for module.yaml in the root
                const moduleYamlPath = path.join(expandedPath, 'module.yaml');
                if (!(await fs.pathExists(moduleYamlPath))) {
                  return 'Directory must contain a module.yaml file in the root';
                }

                // Try to parse the module.yaml to get the module ID
                try {
                  const yaml = require('yaml');
                  const content = await fs.readFile(moduleYamlPath, 'utf8');
                  const moduleData = yaml.parse(content);
                  if (!moduleData.code) {
                    return 'module.yaml must contain a "code" field for the module ID';
                  }
                } catch (error) {
                  return 'Invalid module.yaml file: ' + error.message;
                }

                return true;
              } catch (error) {
                return 'Error validating path: ' + error.message;
              }
            },
          },
        ]);

        sourcePath = this.expandUserPath(inputPath);
        isValid = true;
      }

      // Read module.yaml to get module info
      const yaml = require('yaml');
      const moduleYamlPath = path.join(sourcePath, 'module.yaml');
      const moduleContent = await fs.readFile(moduleYamlPath, 'utf8');
      const moduleData = yaml.parse(moduleContent);

      // Add to sources
      customContentConfig.sources.push({
        path: sourcePath,
        id: moduleData.code,
        name: moduleData.name || moduleData.code,
      });

      console.log(chalk.green(`✓ Added custom module: ${moduleData.name || moduleData.code}`));

      // Ask if user wants to add more
      const { addMore } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addMore',
          message: 'Add another custom module?',
          default: false,
        },
      ]);

      if (!addMore) {
        break;
      }
    }

    // Ask if user wants to add these to the installation
    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: `Install ${customContentConfig.sources.length} custom module(s) now?`,
        default: true,
      },
    ]);

    if (shouldInstall) {
      customContentConfig.selected = true;
      // Store paths to module.yaml files, not directories
      customContentConfig.selectedFiles = customContentConfig.sources.map((s) => path.join(s.path, 'module.yaml'));
      // Also include module IDs for installation
      customContentConfig.selectedModuleIds = customContentConfig.sources.map((s) => s.id);
    }

    return customContentConfig;
  }
}

module.exports = { UI };
