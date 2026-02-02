/**
 * Information and state tools
 * Tools for getting information about the bash environment
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type CommandName,
	getCommandNames,
	getNetworkCommandNames,
} from "just-bash";
import {
	buildExecutionLimits,
	COMMAND_CATEGORIES,
	config,
	ENVIRONMENT_VARIABLES,
	FEATURES,
	parseMountsConfig,
} from "../config/index.js";
import { createErrorResponse, createJsonResponse } from "../utils/index.js";
import { getPersistentBash } from "./bash-instance.js";

/**
 * Register information tools with the MCP server
 */
export function registerInfoTools(server: McpServer): void {
	// ========================================================================
	// bash_info - Environment information
	// ========================================================================
	server.registerTool(
		"bash_info",
		{
			description: "Get information about the bash environment configuration.",
			inputSchema: {},
		},
		async () => {
			const mounts = parseMountsConfig();
			const fsMode =
				mounts.length > 0
					? "mountable"
					: config.READ_WRITE_ROOT
						? "read-write"
						: config.OVERLAY_ROOT
							? "overlay"
							: "in-memory";

			// Get actual available commands (respects ALLOWED_COMMANDS filter)
			const allBuiltinCommands = getCommandNames();
			const availableCommands = config.ALLOWED_COMMANDS
				? allBuiltinCommands.filter((cmd) =>
						config.ALLOWED_COMMANDS?.includes(cmd as CommandName),
					)
				: allBuiltinCommands;

			const info = {
				version: config.VERSION,
				upstreamVersion: config.VERSION,
				fsMode,
				fsRoot: config.READ_WRITE_ROOT || config.OVERLAY_ROOT || null,
				mounts:
					mounts.length > 0
						? mounts.map((m) => ({ mountPoint: m.mountPoint }))
						: null,
				initialCwd: config.INITIAL_CWD,
				networkEnabled: config.ALLOW_NETWORK,
				allowedUrlPrefixes:
					config.ALLOWED_URL_PREFIXES.length > 0
						? config.ALLOWED_URL_PREFIXES
						: null,
				allowedMethods: config.ALLOW_NETWORK ? config.ALLOWED_METHODS : null,
				maxOutputLength: config.MAX_OUTPUT_LENGTH,
				loggingEnabled: config.ENABLE_LOGGING,
				tracingEnabled: config.ENABLE_TRACING,
				commandFilter: config.ALLOWED_COMMANDS || null,
				executionLimits: buildExecutionLimits(),
				availableCommands,
				networkCommands: config.ALLOW_NETWORK ? getNetworkCommandNames() : [],
				commandCategories: COMMAND_CATEGORIES,
				features: FEATURES,
				environmentVariables: ENVIRONMENT_VARIABLES,
			};

			return createJsonResponse(info);
		},
	);

	// ========================================================================
	// bash_get_cwd - Get current working directory
	// ========================================================================
	server.registerTool(
		"bash_get_cwd",
		{
			description:
				"Get the current working directory of the persistent bash environment.",
			inputSchema: {},
		},
		async () => {
			try {
				const bash = getPersistentBash();
				const cwd = bash.getCwd();

				return {
					content: [{ type: "text" as const, text: cwd }],
				};
			} catch (error) {
				return createErrorResponse(error);
			}
		},
	);

	// ========================================================================
	// bash_get_env - Get environment variables
	// ========================================================================
	server.registerTool(
		"bash_get_env",
		{
			description:
				"Get all environment variables from the persistent bash environment.",
			inputSchema: {},
		},
		async () => {
			try {
				const bash = getPersistentBash();
				const env = bash.getEnv();

				return createJsonResponse(env);
			} catch (error) {
				return createErrorResponse(error);
			}
		},
	);
}
