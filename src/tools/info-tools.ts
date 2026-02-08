/**
 * Information and state tools
 * Tools for getting information about the bash environment
 *
 * Uses upstream command registry types (AllCommandName, CommandName) and
 * SecurityViolationLogger for defense-in-depth violation reporting.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type AllCommandName,
	type CommandName,
	getCommandNames,
	getNetworkCommandNames,
	getPythonCommandNames,
} from "just-bash";
import {
	buildExecutionLimits,
	COMMAND_CATEGORIES,
	config,
	ENVIRONMENT_VARIABLES,
	FEATURES,
	parseMountsConfig,
	violationLogger,
} from "../config/index.ts";
import { createErrorResponse, createJsonResponse } from "../utils/index.ts";
import { getDefenseInDepthBox, getPersistentBash } from "./bash-instance.ts";

function getUpstreamVersion(): string {
	try {
		// Resolve the just-bash package directory relative to this module
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const pkgPath = join(__dirname, "..", "..", "node_modules", "just-bash", "package.json");
		const pkg: { version: string } = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
			version: string;
		};
		return pkg.version;
	} catch {
		return "unknown";
	}
}

const UPSTREAM_VERSION = getUpstreamVersion();

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
						config.ALLOWED_COMMANDS?.includes(cmd as AllCommandName as CommandName),
					)
				: allBuiltinCommands;

			// Build defense-in-depth status with violation stats
			const didBox = getDefenseInDepthBox();
			const defenseInDepthStatus = config.ENABLE_DEFENSE_IN_DEPTH
				? {
						enabled: true,
						auditMode: config.DEFENSE_IN_DEPTH_AUDIT,
						consoleLogging: config.DEFENSE_IN_DEPTH_LOG,
						boxActive: didBox?.isActive() ?? false,
						...(didBox && {
							stats: didBox.getStats(),
						}),
						violations: {
							total: violationLogger.getTotalCount(),
							hasViolations: violationLogger.hasViolations(),
							summary: violationLogger.getSummary(),
						},
					}
				: { enabled: false };

			const info = {
				version: config.VERSION,
				upstreamVersion: UPSTREAM_VERSION,
				fsMode,
				fsRoot: config.READ_WRITE_ROOT || config.OVERLAY_ROOT || null,
				overlayReadOnly: config.OVERLAY_ROOT ? config.OVERLAY_READ_ONLY : null,
				mounts: mounts.length > 0 ? mounts.map((m) => ({ mountPoint: m.mountPoint })) : null,
				initialCwd: config.INITIAL_CWD,
				networkEnabled: config.ALLOW_NETWORK,
				allowedUrlPrefixes:
					config.ALLOWED_URL_PREFIXES.length > 0 ? config.ALLOWED_URL_PREFIXES : null,
				allowedMethods: config.ALLOW_NETWORK ? config.ALLOWED_METHODS : null,
				maxResponseSize: config.MAX_RESPONSE_SIZE ?? null,
				maxOutputLength: config.MAX_OUTPUT_LENGTH,
				maxFileReadSize: config.MAX_FILE_READ_SIZE ?? null,
				loggingEnabled: config.ENABLE_LOGGING,
				tracingEnabled: config.ENABLE_TRACING,
				pythonEnabled: config.ENABLE_PYTHON,
				defenseInDepth: defenseInDepthStatus,
				commandFilter: config.ALLOWED_COMMANDS || null,
				executionLimits: buildExecutionLimits(),
				availableCommands,
				networkCommands: config.ALLOW_NETWORK ? getNetworkCommandNames() : [],
				pythonCommands: config.ENABLE_PYTHON ? getPythonCommandNames() : [],
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
			description: "Get the current working directory of the persistent bash environment.",
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
			description: "Get all environment variables from the persistent bash environment.",
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
