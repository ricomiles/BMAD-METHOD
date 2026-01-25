/**
 * Path transformation utilities for IDE installer standardization
 *
 * Provides utilities to convert hierarchical paths to flat naming conventions.
 * - Underscore format (bmad_module_name.md) - Windows-compatible universal format
 */

// Default file extension for backward compatibility
const DEFAULT_FILE_EXTENSION = '.md';

// Type segments - agents are included in naming, others are filtered out
const TYPE_SEGMENTS = ['workflows', 'tasks', 'tools'];
const AGENT_SEGMENT = 'agents';

/**
 * Convert hierarchical path to flat underscore-separated name
 * Converts: 'bmm', 'agents', 'pm' → 'bmad_bmm_agent_pm.md'
 * Converts: 'bmm', 'workflows', 'correct-course' → 'bmad_bmm_correct-course.md'
 * Converts: 'core', 'agents', 'brainstorming' → 'bmad_agent_brainstorming.md' (core items skip module prefix)
 *
 * @param {string} module - Module name (e.g., 'bmm', 'core')
 * @param {string} type - Artifact type ('agents', 'workflows', 'tasks', 'tools')
 * @param {string} name - Artifact name (e.g., 'pm', 'brainstorming')
 * @param {string} [fileExtension=DEFAULT_FILE_EXTENSION] - File extension including dot (e.g., '.md', '.toml')
 * @returns {string} Flat filename like 'bmad_bmm_agent_pm.md' or 'bmad_bmm_correct-course.md'
 */
function toUnderscoreName(module, type, name, fileExtension = DEFAULT_FILE_EXTENSION) {
  const isAgent = type === AGENT_SEGMENT;
  // For core module, skip the module prefix: use 'bmad_name.md' instead of 'bmad_core_name.md'
  if (module === 'core') {
    return isAgent ? `bmad_agent_${name}${fileExtension}` : `bmad_${name}${fileExtension}`;
  }
  return isAgent ? `bmad_${module}_agent_${name}${fileExtension}` : `bmad_${module}_${name}${fileExtension}`;
}

/**
 * Convert relative path to flat underscore-separated name
 * Converts: 'bmm/agents/pm.md' → 'bmad_bmm_agent_pm.md'
 * Converts: 'bmm/workflows/correct-course.md' → 'bmad_bmm_correct-course.md'
 * Converts: 'bmad_bmb/agents/agent-builder.md' → 'bmad_bmb_agent_agent-builder.md' (bmad prefix already in module)
 * Converts: 'core/agents/brainstorming.md' → 'bmad_agent_brainstorming.md' (core items skip module prefix)
 *
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @param {string} [fileExtension=DEFAULT_FILE_EXTENSION] - File extension including dot (e.g., '.md', '.toml')
 * @returns {string} Flat filename like 'bmad_bmm_agent_pm.md' or 'bmad_brainstorming.md'
 */
function toUnderscorePath(relativePath, fileExtension = DEFAULT_FILE_EXTENSION) {
  // Extract extension from relativePath to properly remove it
  const extMatch = relativePath.match(/\.[^.]+$/);
  const originalExt = extMatch ? extMatch[0] : '';
  const withoutExt = relativePath.replace(originalExt, '');
  const parts = withoutExt.split(/[/\\]/);

  const module = parts[0];
  const type = parts[1];
  const name = parts.slice(2).join('_');

  const isAgent = type === AGENT_SEGMENT;
  // For core module, skip the module prefix: use 'bmad_name.md' instead of 'bmad_core_name.md'
  if (module === 'core') {
    return isAgent ? `bmad_agent_${name}${fileExtension}` : `bmad_${name}${fileExtension}`;
  }
  // If module already starts with 'bmad_', don't add another prefix
  const prefix = module.startsWith('bmad_') ? '' : 'bmad_';
  return isAgent ? `${prefix}${module}_agent_${name}${fileExtension}` : `${prefix}${module}_${name}${fileExtension}`;
}

/**
 * Create custom agent underscore name
 * Creates: 'bmad_custom_fred-commit-poet.md'
 *
 * @param {string} agentName - Custom agent name
 * @param {string} [fileExtension=DEFAULT_FILE_EXTENSION] - File extension including dot (e.g., '.md', '.toml')
 * @returns {string} Flat filename like 'bmad_custom_fred-commit-poet.md'
 */
function customAgentUnderscoreName(agentName, fileExtension = DEFAULT_FILE_EXTENSION) {
  return `bmad_custom_${agentName}${fileExtension}`;
}

/**
 * Check if a filename uses underscore format
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename uses underscore format
 */
function isUnderscoreFormat(filename) {
  return filename.startsWith('bmad_') && filename.includes('_');
}

/**
 * Extract parts from an underscore-formatted filename
 * Parses: 'bmad_bmm_agent_pm.md' → { prefix: 'bmad', module: 'bmm', type: 'agents', name: 'pm' }
 * Parses: 'bmad_bmm_correct-course.md' → { prefix: 'bmad', module: 'bmm', type: 'workflows', name: 'correct-course' }
 * Parses: 'bmad_agent_brainstorming.md' → { prefix: 'bmad', module: 'core', type: 'agents', name: 'brainstorming' } (core agents)
 * Parses: 'bmad_brainstorming.md' → { prefix: 'bmad', module: 'core', type: 'workflows', name: 'brainstorming' } (core workflows)
 *
 * @param {string} filename - Underscore-formatted filename
 * @returns {Object|null} Parsed parts or null if invalid format
 */
function parseUnderscoreName(filename) {
  const withoutExt = filename.replace('.md', '');
  const parts = withoutExt.split('_');

  if (parts.length < 2 || parts[0] !== 'bmad') {
    return null;
  }

  // Check if this is an agent file (has 'agent' as one of the parts)
  const agentIndex = parts.indexOf('agent');

  if (agentIndex !== -1) {
    // This is an agent file
    // Format: bmad_agent_name (core) or bmad_module_agent_name
    if (agentIndex === 1) {
      // Core agent: bmad_agent_name
      return {
        prefix: parts[0],
        module: 'core',
        type: 'agents',
        name: parts.slice(agentIndex + 1).join('_'),
      };
    } else {
      // Module agent: bmad_module_agent_name
      return {
        prefix: parts[0],
        module: parts[1],
        type: 'agents',
        name: parts.slice(agentIndex + 1).join('_'),
      };
    }
  }

  // Not an agent file - must be a workflow/tool/task
  // If only 2 parts (bmad_name), it's a core workflow/tool/task
  if (parts.length === 2) {
    return {
      prefix: parts[0],
      module: 'core',
      type: 'workflows', // Default to workflows for non-agent core items
      name: parts[1],
    };
  }

  // Otherwise, it's a module workflow/tool/task (bmad_module_name)
  return {
    prefix: parts[0],
    module: parts[1],
    type: 'workflows', // Default to workflows for non-agent module items
    name: parts.slice(2).join('_'),
  };
}

// Backward compatibility aliases (deprecated)
// Note: These now use toDashPath and customAgentDashName which convert underscores to dashes
const toColonName = toUnderscoreName;
const toDashName = toUnderscoreName;
const customAgentColonName = customAgentUnderscoreName;
const customAgentDashName = customAgentUnderscoreName;
const isColonFormat = isUnderscoreFormat;
const isDashFormat = isUnderscoreFormat;
const parseColonName = parseUnderscoreName;
const parseDashName = parseUnderscoreName;

/**
 * Convert relative path to flat colon-separated name (for backward compatibility)
 * This is actually the same as underscore format now (underscores in filenames)
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @param {string} [fileExtension=DEFAULT_FILE_EXTENSION] - File extension including dot
 * @returns {string} Flat filename like 'bmad_bmm_agent_pm.md'
 */
function toColonPath(relativePath, fileExtension = DEFAULT_FILE_EXTENSION) {
  return toUnderscorePath(relativePath, fileExtension);
}

/**
 * Convert relative path to flat dash-separated name
 * Converts: 'bmm/agents/pm.md' → 'bmad-bmm-agent-pm.md'
 * Converts: 'bmm/workflows/correct-course' → 'bmad-bmm-correct-course.md'
 * Converts: 'bmad-bmb/agents/agent-builder.md' → 'bmad-bmb-agent-agent-builder.md' (bmad prefix already in module)
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @param {string} [fileExtension=DEFAULT_FILE_EXTENSION] - File extension including dot
 * @returns {string} Flat filename like 'bmad-bmm-agent-pm.md'
 */
function toDashPath(relativePath, fileExtension = DEFAULT_FILE_EXTENSION) {
  // Extract extension from relativePath to properly remove it
  const extMatch = relativePath.match(/\.[^.]+$/);
  const originalExt = extMatch ? extMatch[0] : '';
  const withoutExt = relativePath.replace(originalExt, '');
  const parts = withoutExt.split(/[/\\]/);

  const module = parts[0];
  const type = parts[1];
  const name = parts.slice(2).join('-');

  // Use dash naming style
  const isAgent = type === AGENT_SEGMENT;
  if (module === 'core') {
    return isAgent ? `bmad-agent-${name}${fileExtension}` : `bmad-${name}${fileExtension}`;
  }
  // If module already starts with 'bmad-', don't add another prefix
  const prefix = module.startsWith('bmad-') ? '' : 'bmad-';
  return isAgent ? `${prefix}${module}-agent-${name}${fileExtension}` : `${prefix}${module}-${name}${fileExtension}`;
}

module.exports = {
  DEFAULT_FILE_EXTENSION,
  toUnderscoreName,
  toUnderscorePath,
  customAgentUnderscoreName,
  isUnderscoreFormat,
  parseUnderscoreName,
  // Backward compatibility aliases
  toColonName,
  toColonPath,
  toDashName,
  toDashPath,
  customAgentColonName,
  customAgentDashName,
  isColonFormat,
  isDashFormat,
  parseColonName,
  parseDashName,
  TYPE_SEGMENTS,
  AGENT_SEGMENT,
};
