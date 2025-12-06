const chalk = require('chalk');
const path = require('node:path');
const fs = require('fs-extra');
const { Installer } = require('../installers/lib/core/installer');
const { UI } = require('../lib/ui');

const installer = new Installer();
const ui = new UI();

/**
 * Install custom content (agents, workflows, modules)
 * @param {Object} config - Installation configuration
 * @param {Object} result - Installation result
 * @param {string} projectDirectory - Project directory path
 */
async function installCustomContent(config, result, projectDirectory) {
  const { customContent } = config;
  const { selectedItems } = customContent;
  const projectDir = projectDirectory;
  const bmadDir = result.path;

  console.log(chalk.dim(`Project: ${projectDir}`));
  console.log(chalk.dim(`BMAD: ${bmadDir}`));

  // Install custom agents - use agent-install logic
  if (selectedItems.agents.length > 0) {
    console.log(chalk.blue(`\n👥 Installing ${selectedItems.agents.length} custom agent(s)...`));
    for (const agent of selectedItems.agents) {
      await installCustomAgentWithPrompts(agent, projectDir, bmadDir, config);
    }
  }

  // Install custom workflows - copy and register with IDEs
  if (selectedItems.workflows.length > 0) {
    console.log(chalk.blue(`\n📋 Installing ${selectedItems.workflows.length} custom workflow(s)...`));
    for (const workflow of selectedItems.workflows) {
      await installCustomWorkflowWithIDE(workflow, projectDir, bmadDir, config);
    }
  }

  // Install custom modules - treat like regular modules
  if (selectedItems.modules.length > 0) {
    console.log(chalk.blue(`\n🔧 Installing ${selectedItems.modules.length} custom module(s)...`));
    for (const module of selectedItems.modules) {
      await installCustomModuleAsRegular(module, projectDir, bmadDir, config);
    }
  }

  console.log(chalk.green('\n✓ Custom content installation complete!'));
}

/**
 * Install a custom agent with proper prompts (mirrors agent-install.js)
 */
async function installCustomAgentWithPrompts(agent, projectDir, bmadDir, config) {
  const {
    discoverAgents,
    loadAgentConfig,
    addToManifest,
    extractManifestData,
    promptInstallQuestions,
    createIdeSlashCommands,
    updateManifestYaml,
    saveAgentSource,
  } = require('../lib/agent/installer');
  const { compileAgent } = require('../lib/agent/compiler');
  const inquirer = require('inquirer');
  const readline = require('node:readline');
  const yaml = require('js-yaml');

  console.log(chalk.cyan(`  Installing agent: ${agent.name}`));

  // Load agent config
  const agentConfig = loadAgentConfig(agent.yamlPath);
  const agentType = agent.name; // e.g., "toolsmith"

  // Confirm/customize agent persona name (mirrors agent-install.js)
  const rl1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultPersonaName = agentConfig.metadata.name || agentType;
  console.log(chalk.cyan(`\n  📛 Agent Persona Name`));
  console.log(chalk.dim(`     Agent type: ${agentType}`));
  console.log(chalk.dim(`     Default persona: ${defaultPersonaName}`));
  console.log(chalk.dim('     Leave blank to use default, or provide a custom name.'));
  console.log(chalk.dim('     Examples:'));
  console.log(chalk.dim(`       - (blank) → "${defaultPersonaName}" as ${agentType}.md`));
  console.log(chalk.dim(`       - "Fred" → "Fred" as fred-${agentType}.md`));
  console.log(chalk.dim(`       - "Captain Code" → "Captain Code" as captain-code-${agentType}.md`));

  const customPersonaName = await new Promise((resolve) => {
    rl1.question(`\n     Custom name (or Enter for default): `, resolve);
  });
  rl1.close();

  // Determine final agent file name based on persona name
  let finalAgentName;
  let personaName;
  if (customPersonaName.trim()) {
    personaName = customPersonaName.trim();
    const namePrefix = personaName.toLowerCase().replaceAll(/\s+/g, '-');
    finalAgentName = `${namePrefix}-${agentType}`;
  } else {
    personaName = defaultPersonaName;
    finalAgentName = agentType;
  }

  console.log(chalk.dim(`     Persona: ${personaName}`));
  console.log(chalk.dim(`     File: ${finalAgentName}.md`));

  // Get answers (prompt or use defaults)
  let presetAnswers = {};

  // If custom persona name provided, inject it as custom_name for template processing
  if (customPersonaName.trim()) {
    presetAnswers.custom_name = personaName;
  }

  let answers;
  if (agentConfig.installConfig) {
    answers = await promptInstallQuestions(agentConfig.installConfig, agentConfig.defaults, presetAnswers);
  } else {
    answers = { ...agentConfig.defaults, ...presetAnswers };
  }

  // Create target directory
  const targetDir = path.join(bmadDir, 'custom', 'agents', finalAgentName);
  await fs.ensureDir(targetDir);

  // Compile agent with answers
  const { xml, metadata } = compileAgent(
    agentConfig.yamlContent,
    answers,
    finalAgentName,
    `.bmad/custom/agents/${finalAgentName}/${finalAgentName}.md`,
  );

  // Write compiled agent
  const compiledPath = path.join(targetDir, `${finalAgentName}.md`);
  await fs.writeFile(compiledPath, xml, 'utf8');

  // Copy sidecar files if exists
  if (agent.hasSidecar) {
    const entries = await fs.readdir(agent.path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.endsWith('.agent.yaml')) {
        await fs.copy(path.join(agent.path, entry.name), path.join(targetDir, entry.name));
      }
    }
  }

  // Save source YAML for reinstallation
  const cfgAgentsBackupDir = path.join(bmadDir, '_cfg', 'custom', 'agents');
  await fs.ensureDir(cfgAgentsBackupDir);
  const backupYamlPath = path.join(cfgAgentsBackupDir, `${finalAgentName}.agent.yaml`);
  await fs.copy(agent.yamlPath, backupYamlPath);

  // Add to agent manifest
  const manifestFile = path.join(bmadDir, '_cfg', 'agent-manifest.csv');
  const relativePath = `.bmad/custom/agents/${finalAgentName}/${finalAgentName}.md`;
  const manifestData = extractManifestData(xml, { ...metadata, name: finalAgentName }, relativePath, 'custom');
  manifestData.name = finalAgentName;
  manifestData.displayName = metadata.name || finalAgentName;
  addToManifest(manifestFile, manifestData);

  // Update manifest.yaml
  const manifestYamlPath = path.join(bmadDir, '_cfg', 'manifest.yaml');
  updateManifestYaml(manifestYamlPath, finalAgentName, finalAgentName);

  // Create IDE slash commands using existing IDEs from config
  const ideResults = await createIdeSlashCommands(projectDir, finalAgentName, relativePath, metadata, config.ides || []);
  const ideCount = Object.keys(ideResults).length;

  console.log(chalk.green(`  ✓ ${finalAgentName} (registered with ${ideCount} IDE${ideCount === 1 ? '' : 's'})`));
}

/**
 * Install a custom workflow and register with all IDEs
 */
async function installCustomWorkflowWithIDE(workflow, projectDir, bmadDir, config) {
  const targetDir = path.join(bmadDir, 'custom', 'workflows');

  // Check if workflow is a directory or just a file
  // workflow.path might be a file (workflow.md) or a directory
  let sourcePath = workflow.path;
  let isDirectory = false;

  try {
    const stats = await fs.stat(workflow.path);
    isDirectory = stats.isDirectory();
  } catch {
    console.log(chalk.red(`    ERROR: Cannot access workflow path: ${workflow.path}`));
    return;
  }

  // If it's a file ending in workflow.md, use the parent directory
  if (!isDirectory && workflow.path.endsWith('workflow.md')) {
    sourcePath = path.dirname(workflow.path);
    isDirectory = true;
  }

  if (isDirectory) {
    // Copy the entire workflow directory
    const workflowName = path.basename(sourcePath);
    const targetWorkflowDir = path.join(targetDir, workflowName);
    await fs.copy(sourcePath, targetWorkflowDir);

    // Update manifest with the main workflow.md file
    const relativePath = `.bmad/custom/workflows/${workflowName}/workflow.md`;
    await addWorkflowToManifest(bmadDir, workflow.name, workflow.description, relativePath, 'custom');
  } else {
    // Single file workflow
    const targetFileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, targetFileName);
    await fs.copy(sourcePath, targetPath);

    // Update manifest
    const relativePath = `.bmad/custom/workflows/${targetFileName}`;
    await addWorkflowToManifest(bmadDir, workflow.name, workflow.description, relativePath, 'custom');
  }

  // Register workflow with all configured IDEs
  const relativePath = `.bmad/custom/workflows/${path.basename(workflow.path)}`;
  if (config.ides && config.ides.length > 0) {
    const { IdeManager } = require('../installers/lib/ide/manager');
    const ideManager = new IdeManager();

    for (const ide of config.ides) {
      try {
        // IdeManager uses a Map, not getHandler method
        const ideHandler = ideManager.handlers.get(ide.toLowerCase());
        if (ideHandler && typeof ideHandler.registerWorkflow === 'function') {
          await ideHandler.registerWorkflow(projectDir, bmadDir, workflow.name, relativePath);
          console.log(chalk.dim(`    ✓ Registered with ${ide}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`    ⚠️  Could not register with ${ide}: ${error.message}`));
      }
    }
  }

  console.log(chalk.green(`  ✓ ${workflow.name} (copied to custom workflows and registered with IDEs)`));
}

/**
 * Helper to add workflow to manifest
 */
async function addWorkflowToManifest(bmadDir, name, description, relativePath, moduleType = 'custom') {
  const workflowManifestPath = path.join(bmadDir, '_cfg', 'workflow-manifest.csv');

  console.log(chalk.dim(`[DEBUG] Adding workflow to manifest: ${name} -> ${relativePath} (module: ${moduleType})`));

  // Read existing manifest
  let manifestContent = '';
  if (await fs.pathExists(workflowManifestPath)) {
    manifestContent = await fs.readFile(workflowManifestPath, 'utf8');
  }

  // Ensure header exists
  if (!manifestContent.includes('name,description,module,path')) {
    manifestContent = 'name,description,module,path\n';
  }

  // Add workflow entry
  const csvLine = `"${name}","${description}","${moduleType}","${relativePath}"\n`;

  // Check if workflow already exists in manifest
  if (manifestContent.includes(`"${name}",`)) {
    console.log(chalk.dim(`[DEBUG] Workflow already exists in manifest: ${name}`));
  } else {
    try {
      await fs.writeFile(workflowManifestPath, manifestContent + csvLine);
      console.log(chalk.dim(`[DEBUG] Successfully added to manifest`));
    } catch (error) {
      console.log(chalk.red(`[ERROR] Failed to write to manifest: ${error.message}`));
    }
  }
}

/**
 * Install a custom module like a regular module
 */
async function installCustomModuleAsRegular(module, projectDir, bmadDir, config) {
  const yaml = require('js-yaml');
  const path = require('node:path');

  // The custom module path should be the source location
  const customSrcPath = module.path;

  // Install the custom module by copying it to the custom modules directory
  const targetDir = path.join(bmadDir, 'custom', 'modules', module.name);
  await fs.copy(customSrcPath, targetDir);

  // Check if module has an installer and run it from the ORIGINAL source location
  const installerPath = path.join(customSrcPath, '_module-installer', 'installer.js');
  if (await fs.pathExists(installerPath)) {
    try {
      // Clear require cache to ensure fresh import
      delete require.cache[require.resolve(installerPath)];

      // Load and run the module installer
      const moduleInstaller = require(installerPath);
      await moduleInstaller.install({
        projectRoot: projectDir,
        config: config.coreConfig || {},
        installedIDEs: config.ides || [],
        logger: {
          log: (msg) => console.log(chalk.dim(`    ${msg}`)),
          error: (msg) => console.log(chalk.red(`    ERROR: ${msg}`)),
        },
      });
      console.log(chalk.green(`  ✓ ${module.name} (custom installer executed)`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  ${module.name} installer failed: ${error.message}`));
      console.log(chalk.dim(`    Module copied but not configured`));
    }
  } else {
    // No installer - check if module has agents/workflows to install
    console.log(chalk.dim(`    Processing module agents and workflows...`));

    // Install agents from the module
    const agentsPath = path.join(customSrcPath, 'agents');
    if (await fs.pathExists(agentsPath)) {
      const agentFiles = await fs.readdir(agentsPath);
      for (const agentFile of agentFiles) {
        if (agentFile.endsWith('.yaml')) {
          const agentPath = path.join(agentsPath, agentFile);
          await installModuleAgent(agentPath, module.name, projectDir, bmadDir, config);
        }
      }
    }

    // Install workflows from the module
    const workflowsPath = path.join(customSrcPath, 'workflows');
    if (await fs.pathExists(workflowsPath)) {
      const workflowDirs = await fs.readdir(workflowsPath, { withFileTypes: true });
      for (const workflowDir of workflowDirs) {
        if (workflowDir.isDirectory()) {
          const workflowPath = path.join(workflowsPath, workflowDir.name);
          await installModuleWorkflow(workflowPath, module.name, projectDir, bmadDir, config);
        }
      }
    }

    console.log(chalk.green(`  ✓ ${module.name}`));
  }

  // Update manifest.yaml to include custom module with proper prefix
  const manifestYamlPath = path.join(bmadDir, '_cfg', 'manifest.yaml');

  if (await fs.pathExists(manifestYamlPath)) {
    const manifest = yaml.load(await fs.readFile(manifestYamlPath, 'utf8'));

    // Remove any old entries without custom- prefix for this module
    const oldModuleName = module.name;
    if (manifest.modules.includes(oldModuleName)) {
      manifest.modules = manifest.modules.filter((m) => m !== oldModuleName);
      console.log(chalk.dim(`    Removed old entry: ${oldModuleName}`));
    }

    // Custom modules should be stored with custom- prefix
    const moduleNameWithPrefix = `custom-${module.name}`;
    if (!manifest.modules.includes(moduleNameWithPrefix)) {
      manifest.modules.push(moduleNameWithPrefix);
      console.log(chalk.dim(`    Added to manifest.yaml as ${moduleNameWithPrefix}`));
    }

    // Write back the cleaned manifest
    await fs.writeFile(manifestYamlPath, yaml.dump(manifest), 'utf8');
  }

  // Register module with IDEs (like regular modules do)
  if (config.ides && config.ides.length > 0) {
    const { IdeManager } = require('../installers/lib/ide/manager');
    const ideManager = new IdeManager();

    for (const ide of config.ides) {
      try {
        // IdeManager uses a Map, not direct property access
        const handler = ideManager.handlers.get(ide.toLowerCase());
        if (handler && handler.moduleInjector) {
          // Check if module has IDE-specific customizations
          const subModulePath = path.join(customSrcPath, 'sub-modules', ide);
          if (await fs.pathExists(subModulePath)) {
            console.log(chalk.dim(`    ✓ Found ${ide} customizations for ${module.name}`));
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`    ⚠️  Could not configure ${ide} for ${module.name}: ${error.message}`));
      }
    }
  }
}

/**
 * Install an agent from a module
 */
async function installModuleAgent(agentPath, moduleName, projectDir, bmadDir, config) {
  const {
    loadAgentConfig,
    addToManifest,
    extractManifestData,
    createIdeSlashCommands,
    updateManifestYaml,
  } = require('../lib/agent/installer');
  const { compileAgent } = require('../lib/agent/compiler');

  const agentName = path.basename(agentPath, '.yaml');
  console.log(chalk.dim(`    Installing agent: ${agentName} (from ${moduleName})`));

  // Load agent config
  const agentConfig = loadAgentConfig(agentPath);

  // Compile agent with defaults (no prompts for module agents)
  const { xml, metadata } = compileAgent(
    agentConfig.yamlContent,
    agentConfig.defaults || {},
    agentName,
    `.bmad/custom/modules/${moduleName}/agents/${agentName}.md`,
  );

  // Create target directory
  const targetDir = path.join(bmadDir, 'custom', 'modules', moduleName, 'agents');
  await fs.ensureDir(targetDir);

  // Write compiled agent
  const compiledPath = path.join(targetDir, `${agentName}.md`);
  await fs.writeFile(compiledPath, xml, 'utf8');

  // Remove the raw YAML file after compilation
  const yamlPath = path.join(targetDir, `${agentName}.yaml`);
  if (await fs.pathExists(yamlPath)) {
    await fs.remove(yamlPath);
  }

  // Add to agent manifest
  const manifestFile = path.join(bmadDir, '_cfg', 'agent-manifest.csv');
  const relativePath = `.bmad/custom/modules/${moduleName}/agents/${agentName}.md`;
  const manifestData = extractManifestData(xml, { ...metadata, name: agentName }, relativePath, 'custom');
  manifestData.name = `${moduleName}-${agentName}`;
  manifestData.displayName = metadata.name || agentName;
  addToManifest(manifestFile, manifestData);

  // Update manifest.yaml
  const manifestYamlPath = path.join(bmadDir, '_cfg', 'manifest.yaml');
  updateManifestYaml(manifestYamlPath, `${moduleName}-${agentName}`, agentName);

  // Create IDE slash commands
  const ideResults = await createIdeSlashCommands(projectDir, `${moduleName}-${agentName}`, relativePath, metadata, config.ides || []);
  const ideCount = Object.keys(ideResults).length;

  console.log(chalk.dim(`    ✓ ${agentName} (registered with ${ideCount} IDE${ideCount === 1 ? '' : 's'})`));
}

/**
 * Install a workflow from a module
 */
async function installModuleWorkflow(workflowPath, moduleName, projectDir, bmadDir, config) {
  const workflowName = path.basename(workflowPath);

  // Copy the workflow directory
  const targetDir = path.join(bmadDir, 'custom', 'modules', moduleName, 'workflows', workflowName);
  await fs.copy(workflowPath, targetDir);

  // Add to workflow manifest
  const workflowManifestPath = path.join(bmadDir, '_cfg', 'workflow-manifest.csv');
  const relativePath = `.bmad/custom/modules/${moduleName}/workflows/${workflowName}/README.md`;

  // Read existing manifest
  let manifestContent = '';
  if (await fs.pathExists(workflowManifestPath)) {
    manifestContent = await fs.readFile(workflowManifestPath, 'utf8');
  }

  // Ensure header exists
  if (!manifestContent.includes('name,description,module,path')) {
    manifestContent = 'name,description,module,path\n';
  }

  // Add workflow entry
  const csvLine = `"${moduleName}-${workflowName}","Workflow from ${moduleName} module","${moduleName}","${relativePath}"\n`;

  // Check if workflow already exists in manifest
  if (!manifestContent.includes(`"${moduleName}-${workflowName}",`)) {
    await fs.writeFile(workflowManifestPath, manifestContent + csvLine);
  }

  // Register with IDEs
  if (config.ides && config.ides.length > 0) {
    const { IdeManager } = require('../installers/lib/ide/manager');
    const ideManager = new IdeManager();

    for (const ide of config.ides) {
      try {
        const ideHandler = ideManager.handlers.get(ide.toLowerCase());
        if (ideHandler && typeof ideHandler.registerWorkflow === 'function') {
          await ideHandler.registerWorkflow(projectDir, bmadDir, `${moduleName}-${workflowName}`, relativePath);
          console.log(chalk.dim(`      ✓ Registered with ${ide}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`      ⚠️  Could not register with ${ide}: ${error.message}`));
      }
    }
  }

  console.log(chalk.dim(`    ✓ ${workflowName} workflow added and registered`));
}

module.exports = {
  command: 'install',
  description: 'Install BMAD Core agents and tools',
  options: [['--skip-cleanup', 'Skip automatic cleanup of legacy files']],
  action: async (options) => {
    try {
      const config = await ui.promptInstall();

      // Handle cancel
      if (config.actionType === 'cancel') {
        console.log(chalk.yellow('Installation cancelled.'));
        process.exit(0);
      }

      // Handle agent compilation separately
      if (config.actionType === 'compile') {
        const result = await installer.compileAgents(config);
        console.log(chalk.green('\n✨ Agent compilation complete!'));
        console.log(chalk.cyan(`Rebuilt ${result.agentCount} agents and ${result.taskCount} tasks`));
        process.exit(0);
      }

      // Handle quick update separately
      if (config.actionType === 'quick-update') {
        const result = await installer.quickUpdate(config);
        console.log(chalk.green('\n✨ Quick update complete!'));
        console.log(chalk.cyan(`Updated ${result.moduleCount} modules with preserved settings`));

        // After quick update, check for existing custom content and re-install to regenerate IDE commands
        const { UI } = require('../lib/ui');
        const ui = new UI();
        const customPath = path.join(config.directory, 'bmad-custom-src');

        // Check if custom content exists
        if (await fs.pathExists(customPath)) {
          console.log(chalk.cyan('\n📦 Detecting custom content to update IDE commands...'));

          // Get existing custom content selections (default to all for updates)
          const existingCustom = {
            agents: (await fs.pathExists(path.join(customPath, 'agents'))) ? true : false,
            workflows: (await fs.pathExists(path.join(customPath, 'workflows'))) ? true : false,
            modules: (await fs.pathExists(path.join(customPath, 'modules'))) ? true : false,
          };

          // Auto-select all existing custom content for update
          if (existingCustom.agents || existingCustom.workflows || existingCustom.modules) {
            const customContent = await ui.discoverCustomContent(customPath);

            config.customContent = {
              path: customPath,
              selectedItems: {
                agents: existingCustom.agents ? customContent.agents.map((a) => ({ ...a, selected: true })) : [],
                workflows: existingCustom.workflows ? customContent.workflows.map((w) => ({ ...w, selected: true })) : [],
                modules: existingCustom.modules ? customContent.modules.map((m) => ({ ...m, selected: true })) : [],
              },
            };

            await installCustomContent(config, result, config.directory);

            // Re-run IDE setup to register custom workflows with IDEs
            if (config.ides && config.ides.length > 0) {
              console.log(chalk.cyan('\n🔧 Updating IDE configurations for custom content...'));
              const { IdeManager } = require('../installers/lib/ide/manager');
              const ideManager = new IdeManager();

              for (const ide of config.ides) {
                try {
                  const ideResult = await ideManager.setup(ide, config.directory, result.path, {
                    selectedModules: [...(config.modules || []), 'custom'], // Include 'custom' for custom agents/workflows
                    skipModuleInstall: true, // Don't install modules again
                    verbose: false,
                    preCollectedConfig: {
                      ...config.coreConfig,
                      _alreadyConfigured: true, // Skip reconfiguration that might add duplicates
                    },
                  });

                  if (ideResult.success) {
                    console.log(chalk.dim(`  ✓ Updated ${ide} with custom workflows`));
                  }
                } catch (error) {
                  console.log(chalk.yellow(`  ⚠️  Could not update ${ide}: ${error.message}`));
                }
              }
            }
          } else {
            console.log(chalk.dim('  No custom content found to update'));
          }
        }

        console.log(chalk.green('\n✨ Update complete with custom content!'));
        process.exit(0);
      }

      // Handle reinstall by setting force flag
      if (config.actionType === 'reinstall') {
        config._requestedReinstall = true;
      }

      // Add skip cleanup flag if option provided
      if (options && options.skipCleanup) {
        config.skipCleanup = true;
      }

      // Regular install/update flow
      const result = await installer.install(config);

      // Check if installation was cancelled
      if (result && result.cancelled) {
        process.exit(0);
      }

      // Check if installation succeeded
      if (result && result.success) {
        // Install custom content if selected
        if (config.customContent && config.customContent.selectedItems) {
          console.log(chalk.cyan('\n📦 Installing Custom Content...'));
          await installCustomContent(config, result, config.directory);

          // Re-run IDE setup to register custom workflows with IDEs
          if (config.ides && config.ides.length > 0) {
            console.log(chalk.cyan('\n🔧 Updating IDE configurations for custom content...'));
            const { IdeManager } = require('../installers/lib/ide/manager');
            const ideManager = new IdeManager();

            for (const ide of config.ides) {
              try {
                const ideResult = await ideManager.setup(ide, config.directory, result.path, {
                  selectedModules: [...(config.modules || []), 'custom'], // Include 'custom' for custom agents/workflows
                  skipModuleInstall: true, // Don't install modules again
                  verbose: false,
                  preCollectedConfig: {
                    ...config.coreConfig,
                    _alreadyConfigured: true, // Skip reconfiguration that might add duplicates
                  },
                });

                if (ideResult.success) {
                  console.log(chalk.dim(`  ✓ Updated ${ide} with custom workflows`));
                }
              } catch (error) {
                console.log(chalk.yellow(`  ⚠️  Could not update ${ide}: ${error.message}`));
              }
            }
          }
        }

        console.log(chalk.green('\n✨ Installation complete!'));
        console.log(chalk.cyan('BMAD Core and Selected Modules have been installed to:'), chalk.bold(result.path));
        console.log(chalk.yellow('\nThank you for helping test the early release version of the new BMad Core and BMad Method!'));
        console.log(chalk.cyan('Stable Beta coming soon - please read the full README.md and linked documentation to get started!'));

        // Run AgentVibes installer if needed
        if (result.needsAgentVibes) {
          console.log(chalk.magenta('\n🎙️  AgentVibes TTS Setup'));
          console.log(chalk.cyan('AgentVibes provides voice synthesis for BMAD agents with:'));
          console.log(chalk.dim('  • ElevenLabs AI (150+ premium voices)'));
          console.log(chalk.dim('  • Piper TTS (50+ free voices)\n'));

          const readline = require('node:readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          await new Promise((resolve) => {
            rl.question(chalk.green('Press Enter to start AgentVibes installer...'), () => {
              rl.close();
              resolve();
            });
          });

          console.log('');

          // Run AgentVibes installer
          const { execSync } = require('node:child_process');
          try {
            execSync('npx agentvibes@latest install', {
              cwd: result.projectDir,
              stdio: 'inherit',
              shell: true,
            });
            console.log(chalk.green('\n✓ AgentVibes installation complete'));
          } catch {
            console.log(chalk.yellow('\n⚠ AgentVibes installation was interrupted or failed'));
            console.log(chalk.cyan('You can run it manually later with:'));
            console.log(chalk.green(`  cd ${result.projectDir}`));
            console.log(chalk.green('  npx agentvibes install\n'));
          }
        }

        process.exit(0);
      }
    } catch (error) {
      // Check if error has a complete formatted message
      if (error.fullMessage) {
        console.error(error.fullMessage);
        if (error.stack) {
          console.error('\n' + chalk.dim(error.stack));
        }
      } else {
        // Generic error handling for all other errors
        console.error(chalk.red('Installation failed:'), error.message);
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  },
};
