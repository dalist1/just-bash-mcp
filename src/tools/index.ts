/**
 * Tools registration module
 * Aggregates and exports all MCP tools
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {registerExecTools} from './exec-tools.js'
import {registerFileTools} from './file-tools.js'
import {registerInfoTools} from './info-tools.js'
import {registerSandboxTools} from './sandbox-tools.js'
import {registerTransformTools} from './transform-tools.js'

export {setJavaScriptToolHandler} from '../config/index.js'

// Re-export bash instance utilities
export {createBashInstance, defineCommand, getDefenseInDepthBox, getPersistentBash, getPersistentSandbox, resetPersistentBash, resetPersistentSandbox, violationLogger} from './bash-instance.js'
// Re-export individual registrations for fine-grained control
export {registerExecTools} from './exec-tools.js'
export {registerFileTools} from './file-tools.js'
export {registerInfoTools} from './info-tools.js'
export {registerSandboxTools} from './sandbox-tools.js'
export {registerTransformTools} from './transform-tools.js'

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer): void {
 // Core execution tools
 registerExecTools(server)

 // File operation tools
 registerFileTools(server)

 // Additional persistent sandbox tools
 registerSandboxTools(server)

 // AST transform tools
 registerTransformTools(server)

 // Information and state tools
 registerInfoTools(server)
}
