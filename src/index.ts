#!/usr/bin/env node

/**
 * just-bash-mcp - MCP Server for sandboxed bash execution
 *
 * A Model Context Protocol (MCP) server that provides AI agents with a
 * secure, sandboxed bash environment powered by just-bash.
 *
 * @see https://github.com/vercel-labs/just-bash
 * @see https://modelcontextprotocol.io
 */

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {config} from './config/index.js'
import {registerAllTools} from './tools/index.js'

export * from 'just-bash'
export {bashLogger, buildDefenseInDepthConfig, buildExecutionLimits, buildJavaScriptConfig, buildNetworkConfig, config, getJavaScriptToolHandler, parseMountsConfig, setJavaScriptToolHandler, traceCallback, violationLogger} from './config/index.js'
export * from './tools/index.js'

// ============================================================================
// Server Initialization
// ============================================================================

export function createServer(): McpServer {
 const server = new McpServer({name: config.SERVER_NAME, version: config.VERSION})

 registerAllTools(server)
 return server
}

// ============================================================================
// Start Server
// ============================================================================

export async function startServer(): Promise<void> {
 const server = createServer()
 const transport = new StdioServerTransport()
 await server.connect(transport)
}

function isMainModule(): boolean {
 const entryPoint = process.argv[1]
 if (!entryPoint) return false
 try {
  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(entryPoint))
 } catch {
  return false
 }
}

if (isMainModule()) {
 await startServer()
}
