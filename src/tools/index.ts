/**
 * Tools registration module
 * Aggregates and exports all MCP tools
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {registerExecTools} from './exec-tools.ts'
import {registerFileTools} from './file-tools.ts'
import {registerInfoTools} from './info-tools.ts'
import {registerSandboxTools} from './sandbox-tools.ts'

export {setJavaScriptToolHandler} from '../config/index.ts'

// Re-export bash instance utilities
export {createBashInstance, defineCommand, getDefenseInDepthBox, getPersistentBash, getPersistentSandbox, resetPersistentBash, resetPersistentSandbox, violationLogger} from './bash-instance.ts'
// Re-export individual registrations for fine-grained control
export {registerExecTools} from './exec-tools.ts'
export {registerFileTools} from './file-tools.ts'
export {registerInfoTools} from './info-tools.ts'
export {registerSandboxTools} from './sandbox-tools.ts'

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

 // Information and state tools
 registerInfoTools(server)
}
