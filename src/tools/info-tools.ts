/**
 * Information and state tools
 * Tools for getting information about the bash environment
 *
 * Uses upstream command registry types (AllCommandName, CommandName) and
 * SecurityViolationLogger for defense-in-depth violation reporting.
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {type AllCommandName, type CommandName, getCommandNames, getJavaScriptCommandNames, getNetworkCommandNames, getPythonCommandNames} from 'just-bash'
import {buildExecutionLimits, COMMAND_CATEGORIES, config, ENVIRONMENT_VARIABLES, FEATURES, parseMountsConfig, UPSTREAM_JUST_BASH_VERSION, violationLogger} from '../config/index.js'
import {createErrorResponse, createJsonResponse} from '../utils/index.js'
import {getDefenseInDepthBox, getPersistentBash} from './bash-instance.js'

function redactAllowedUrlPrefixes(): unknown[] | null {
 if (config.ALLOWED_URL_PREFIXES.length === 0) return null
 return config.ALLOWED_URL_PREFIXES.map(entry => {
  if (typeof entry === 'string') return entry
  return {url: entry.url, ...(entry.transform && {transform: entry.transform.map(transform => ({headers: Object.fromEntries(Object.keys(transform.headers).map(header => [header, '[redacted]']))}))})}
 })
}

/**
 * Register information tools with the MCP server
 */
export function registerInfoTools(server: McpServer): void {
 // ========================================================================
 // bash_info - Environment information
 // ========================================================================
 server.registerTool('bash_info', {description: 'Get information about the bash environment configuration.', inputSchema: {}}, async () => {
  const mounts = parseMountsConfig()
  const fsMode = mounts.length > 0 ? 'mountable' : config.READ_WRITE_ROOT ? 'read-write' : config.OVERLAY_ROOT ? 'overlay' : 'in-memory'

  // Get actual available commands (respects ALLOWED_COMMANDS filter)
  const allBuiltinCommands = getCommandNames()
  const availableCommands = config.ALLOWED_COMMANDS ? allBuiltinCommands.filter(cmd => config.ALLOWED_COMMANDS?.includes(cmd as AllCommandName as CommandName)) : allBuiltinCommands

  // Build defense-in-depth status with violation stats
  const didBox = getDefenseInDepthBox()
  const defenseInDepthStatus = config.ENABLE_DEFENSE_IN_DEPTH
   ? {
      enabled: true,
      auditMode: config.DEFENSE_IN_DEPTH_AUDIT,
      consoleLogging: config.DEFENSE_IN_DEPTH_LOG,
      boxActive: didBox?.isActive() ?? false,
      ...(didBox && {stats: didBox.getStats()}),
      violations: {total: violationLogger.getTotalCount(), hasViolations: violationLogger.hasViolations(), summary: violationLogger.getSummary()}
     }
   : {enabled: false}

  const info = {
   version: config.VERSION,
   upstreamVersion: UPSTREAM_JUST_BASH_VERSION,
   fsMode,
   fsRoot: config.READ_WRITE_ROOT || config.OVERLAY_ROOT || null,
   overlayReadOnly: config.OVERLAY_ROOT ? config.OVERLAY_READ_ONLY : null,
   mounts: mounts.length > 0 ? mounts.map(m => ({mountPoint: m.mountPoint})) : null,
   initialCwd: config.INITIAL_CWD,
   networkEnabled: config.ALLOW_NETWORK,
   allowedUrlPrefixes: redactAllowedUrlPrefixes(),
   allowedMethods: config.ALLOW_NETWORK ? config.ALLOWED_METHODS : null,
   maxResponseSize: config.MAX_RESPONSE_SIZE ?? null,
   denyPrivateRanges: config.DENY_PRIVATE_RANGES ?? process.env.NODE_ENV === 'production',
   denyPrivateRangesConfigured: config.DENY_PRIVATE_RANGES !== undefined,
   maxOutputLength: config.MAX_OUTPUT_LENGTH,
   maxFileReadSize: config.MAX_FILE_READ_SIZE ?? null,
   initialEnvConfigured: config.INITIAL_ENV !== undefined,
   virtualProcessInfo: config.PROCESS_INFO ?? null,
   sandboxTimeoutMs: config.SANDBOX_TIMEOUT_MS ?? null,
   loggingEnabled: config.ENABLE_LOGGING,
   tracingEnabled: config.ENABLE_TRACING,
   pythonEnabled: config.ENABLE_PYTHON,
   javascriptEnabled: config.ENABLE_JAVASCRIPT,
   javascriptBootstrapConfigured: config.JAVASCRIPT_BOOTSTRAP !== undefined,
   defenseInDepth: defenseInDepthStatus,
   commandFilter: config.ALLOWED_COMMANDS || null,
   mcpTools: [
    'bash',
    'bash_exec',
    'bash_exec_persistent',
    'bash_reset',
    'bash_write_file',
    'bash_read_file',
    'bash_list_files',
    'bash_direct_read',
    'bash_direct_write',
    'bash_sandbox_run',
    'bash_sandbox_domain',
    'bash_sandbox_write_files',
    'bash_sandbox_read_file',
    'bash_sandbox_mkdir',
    'bash_sandbox_stop',
    'bash_sandbox_extend_timeout',
    'bash_sandbox_reset',
    'bash_transform',
    'bash_info',
    'bash_get_cwd',
    'bash_get_env'
   ],
   executionLimits: buildExecutionLimits(),
   availableCommands,
   networkCommands: config.ALLOW_NETWORK ? getNetworkCommandNames() : [],
   pythonCommands: config.ENABLE_PYTHON ? getPythonCommandNames() : [],
   javascriptCommands: config.ENABLE_JAVASCRIPT ? getJavaScriptCommandNames() : [],
   commandCategories: COMMAND_CATEGORIES,
   features: FEATURES,
   environmentVariables: ENVIRONMENT_VARIABLES
  }

  return createJsonResponse(info)
 })

 // ========================================================================
 // bash_get_cwd - Get current working directory
 // ========================================================================
 server.registerTool('bash_get_cwd', {description: 'Get the current working directory of the persistent bash environment.', inputSchema: {}}, async () => {
  try {
   const bash = getPersistentBash()
   const cwd = bash.getCwd()

   return {content: [{type: 'text' as const, text: cwd}]}
  } catch (error) {
   return createErrorResponse(error)
  }
 })

 // ========================================================================
 // bash_get_env - Get environment variables
 // ========================================================================
 server.registerTool('bash_get_env', {description: 'Get all environment variables from the persistent bash environment.', inputSchema: {}}, async () => {
  try {
   const bash = getPersistentBash()
   const env = bash.getEnv()

   return createJsonResponse(env)
  } catch (error) {
   return createErrorResponse(error)
  }
 })
}
