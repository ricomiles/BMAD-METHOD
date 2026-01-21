/**
 * Path transformation utilities for IDE installer standardization
 *
 * Provides utilities to convert hierarchical paths to flat naming conventions.
 * - Colon format (bmad:module:name.md) for folder-based IDEs converting to flat
 * - Dash format (bmad-module-name.md) for already-flat IDEs
 */

// Type segments to filter out from paths
const TYPE_SEGMENTS = ['agents', 'workflows', 'tasks', 'tools'];

/**
 * Convert hierarchical path to flat colon-separated name (for folder-based IDEs)
 * Converts: 'bmm/agents/pm.md' → 'bmad:bmm:pm.md'
 * Converts: 'bmm/workflows/correct-course.md' → 'bmad:bmm:correct-course.md'
 *
 * @param {string} module - Module name (e.g., 'bmm', 'core')
 * @param {string} type - Artifact type ('agents', 'workflows', 'tasks', 'tools') - filtered out
 * @param {string} name - Artifact name (e.g., 'pm', 'correct-course')
 * @returns {string} Flat filename like 'bmad:bmm:pm.md'
 */
function toColonName(module, type, name) {
  return `bmad:${module}:${name}.md`;
}

/**
 * Convert relative path to flat colon-separated name (for folder-based IDEs)
 * Converts: 'bmm/agents/pm.md' → 'bmad:bmm:pm.md'
 * Converts: 'bmm/workflows/correct-course.md' → 'bmad:bmm:correct-course.md'
 *
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @returns {string} Flat filename like 'bmad:bmm:pm.md'
 */
function toColonPath(relativePath) {
  const withoutExt = relativePath.replace('.md', '');
  const parts = withoutExt.split(/[/\\]/);
  // Filter out type segments (agents, workflows, tasks, tools)
  const filtered = parts.filter((p) => !TYPE_SEGMENTS.includes(p));
  return `bmad:${filtered.join(':')}.md`;
}

/**
 * Convert hierarchical path to flat dash-separated name (for flat IDEs)
 * Converts: 'bmm/agents/pm.md' → 'bmad-bmm-pm.md'
 * Converts: 'bmm/workflows/correct-course.md' → 'bmad-bmm-correct-course.md'
 *
 * @param {string} relativePath - Path like 'bmm/agents/pm.md'
 * @returns {string} Flat filename like 'bmad-bmm-pm.md'
 */
function toDashPath(relativePath) {
  const withoutExt = relativePath.replace('.md', '');
  const parts = withoutExt.split(/[/\\]/);
  // Filter out type segments (agents, workflows, tasks, tools)
  const filtered = parts.filter((p) => !TYPE_SEGMENTS.includes(p));
  return `bmad-${filtered.join('-')}.md`;
}

/**
 * Create custom agent colon name (for folder-based IDEs)
 * Creates: 'bmad:custom:fred-commit-poet.md'
 *
 * @param {string} agentName - Custom agent name
 * @returns {string} Flat filename like 'bmad:custom:fred-commit-poet.md'
 */
function customAgentColonName(agentName) {
  return `bmad:custom:${agentName}.md`;
}

/**
 * Create custom agent dash name (for flat IDEs)
 * Creates: 'bmad-custom-fred-commit-poet.md'
 *
 * @param {string} agentName - Custom agent name
 * @returns {string} Flat filename like 'bmad-custom-fred-commit-poet.md'
 */
function customAgentDashName(agentName) {
  return `bmad-custom-${agentName}.md`;
}

/**
 * Check if a filename uses colon format
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename uses colon format
 */
function isColonFormat(filename) {
  return filename.includes('bmad:') && filename.includes(':');
}

/**
 * Check if a filename uses dash format
 * @param {string} filename - Filename to check
 * @returns {boolean} True if filename uses dash format
 */
function isDashFormat(filename) {
  return filename.startsWith('bmad-') && !filename.includes(':');
}

/**
 * Extract parts from a colon-formatted filename
 * Parses: 'bmad:bmm:pm.md' → { prefix: 'bmad', module: 'bmm', name: 'pm' }
 *
 * @param {string} filename - Colon-formatted filename
 * @returns {Object|null} Parsed parts or null if invalid format
 */
function parseColonName(filename) {
  const withoutExt = filename.replace('.md', '');
  const parts = withoutExt.split(':');

  if (parts.length < 3 || parts[0] !== 'bmad') {
    return null;
  }

  return {
    prefix: parts[0],
    module: parts[1],
    name: parts.slice(2).join(':'), // Handle names that might contain colons
  };
}

/**
 * Extract parts from a dash-formatted filename
 * Parses: 'bmad-bmm-pm.md' → { prefix: 'bmad', module: 'bmm', name: 'pm' }
 *
 * @param {string} filename - Dash-formatted filename
 * @returns {Object|null} Parsed parts or null if invalid format
 */
function parseDashName(filename) {
  const withoutExt = filename.replace('.md', '');
  const parts = withoutExt.split('-');

  if (parts.length < 3 || parts[0] !== 'bmad') {
    return null;
  }

  return {
    prefix: parts[0],
    module: parts[1],
    name: parts.slice(2).join('-'), // Handle names that might contain dashes
  };
}

module.exports = {
  toColonName,
  toColonPath,
  toDashPath,
  customAgentColonName,
  customAgentDashName,
  isColonFormat,
  isDashFormat,
  parseColonName,
  parseDashName,
  TYPE_SEGMENTS,
};
