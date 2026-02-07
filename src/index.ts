#!/usr/bin/env node

/**
 * just-bash-mcp - MCP Server for sandboxed bash execution
 *
 * A Model Context Protocol (MCP) server that provides AI agents with a
 * secure, sandboxed bash environment powered by just-bash from Vercel Labs.
 *
 * @see https://github.com/vercel-labs/just-bash
 * @see https://modelcontextprotocol.io
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./config/index.ts";
import { registerAllTools } from "./tools/index.ts";

// ============================================================================
// Server Initialization
// ============================================================================

const server = new McpServer({
	name: config.SERVER_NAME,
	version: config.VERSION,
});

// Register all tools with the server
registerAllTools(server);

// ============================================================================
// Start Server
// ============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
