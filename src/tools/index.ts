/**
 * Tools registration module
 * Aggregates and exports all MCP tools
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerExecTools } from "./exec-tools.js";
import { registerFileTools } from "./file-tools.js";
import { registerInfoTools } from "./info-tools.js";
import { registerSandboxTools } from "./sandbox-tools.js";

// Re-export bash instance utilities
export {
	createBashInstance,
	getPersistentBash,
	getPersistentSandbox,
	resetPersistentBash,
	resetPersistentSandbox,
} from "./bash-instance.js";
// Re-export individual registrations for fine-grained control
export { registerExecTools } from "./exec-tools.js";
export { registerFileTools } from "./file-tools.js";
export { registerInfoTools } from "./info-tools.js";
export { registerSandboxTools } from "./sandbox-tools.js";

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(server: McpServer): void {
	// Core execution tools
	registerExecTools(server);

	// File operation tools
	registerFileTools(server);

	// Vercel Sandbox compatible tools
	registerSandboxTools(server);

	// Information and state tools
	registerInfoTools(server);
}
