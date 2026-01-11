#!/usr/bin/env node
/**
 * @fileoverview MCP server providing a sandboxed bash environment using just-bash.
 * @author dalist1
 * @license Apache-2.0
 * @see https://github.com/dalist1/just-bash-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import {
	Bash,
	OverlayFs,
	type NetworkConfig,
	getCommandNames,
	getNetworkCommandNames,
} from "just-bash";

/** Supported HTTP methods for network requests */
type HttpMethod =
	| "GET"
	| "HEAD"
	| "POST"
	| "PUT"
	| "DELETE"
	| "PATCH"
	| "OPTIONS";

// ============================================================================
// Configuration from environment variables
// ============================================================================

/** Path to real directory for overlay filesystem (read-only mount) */
const OVERLAY_ROOT = process.env.JUST_BASH_OVERLAY_ROOT;

/** Initial working directory for bash environment */
const INITIAL_CWD = process.env.JUST_BASH_CWD || "/home/user";

/** Whether network access is enabled */
const ALLOW_NETWORK = process.env.JUST_BASH_ALLOW_NETWORK === "true";

/** Comma-separated list of allowed URL prefixes */
const ALLOWED_URL_PREFIXES =
	process.env.JUST_BASH_ALLOWED_URLS?.split(",").filter(Boolean) || [];

/** Allowed HTTP methods for network requests */
const ALLOWED_METHODS = (process.env.JUST_BASH_ALLOWED_METHODS?.split(
	",",
).filter(Boolean) || ["GET", "HEAD"]) as HttpMethod[];

/** Maximum number of redirects to follow */
const MAX_REDIRECTS = parseInt(process.env.JUST_BASH_MAX_REDIRECTS || "20", 10);

/** Request timeout in milliseconds */
const NETWORK_TIMEOUT_MS = parseInt(
	process.env.JUST_BASH_NETWORK_TIMEOUT_MS || "30000",
	10,
);

// ============================================================================
// Execution limits from environment
// ============================================================================

/** Maximum function call/recursion depth */
const MAX_CALL_DEPTH = parseInt(
	process.env.JUST_BASH_MAX_CALL_DEPTH || "100",
	10,
);

/** Maximum number of commands per execution */
const MAX_COMMAND_COUNT = parseInt(
	process.env.JUST_BASH_MAX_COMMAND_COUNT || "10000",
	10,
);

/** Maximum loop iterations */
const MAX_LOOP_ITERATIONS = parseInt(
	process.env.JUST_BASH_MAX_LOOP_ITERATIONS || "10000",
	10,
);

// ============================================================================
// MCP Server Setup
// ============================================================================

/** MCP server instance */
const server = new McpServer({
	name: "just-bash-mcp",
	version: "1.0.0",
});

/**
 * Builds the network configuration based on environment variables.
 * @returns Network configuration object or undefined if network is disabled
 */
function buildNetworkConfig(): NetworkConfig | undefined {
	if (!ALLOW_NETWORK) {
		return undefined;
	}

	if (ALLOWED_URL_PREFIXES.length > 0) {
		return {
			allowedUrlPrefixes: ALLOWED_URL_PREFIXES,
			allowedMethods: ALLOWED_METHODS,
			maxRedirects: MAX_REDIRECTS,
			timeoutMs: NETWORK_TIMEOUT_MS,
		};
	}

	// Full internet access if ALLOW_NETWORK is true but no prefixes specified
	return {
		dangerouslyAllowFullInternetAccess: true,
		maxRedirects: MAX_REDIRECTS,
		timeoutMs: NETWORK_TIMEOUT_MS,
	};
}

/**
 * Builds the execution limits configuration.
 * @returns Execution limits object with all limit values
 */
function buildExecutionLimits() {
	return {
		maxCallDepth: MAX_CALL_DEPTH,
		maxCommandCount: MAX_COMMAND_COUNT,
		maxLoopIterations: MAX_LOOP_ITERATIONS,
		maxAwkIterations: MAX_LOOP_ITERATIONS,
		maxSedIterations: MAX_LOOP_ITERATIONS,
		maxJqIterations: MAX_LOOP_ITERATIONS,
	};
}

/**
 * Creates a new Bash instance with optional overlay filesystem.
 * @param files - Optional initial files to create in the filesystem
 * @returns Configured Bash instance
 */
function createBashInstance(files?: Record<string, string>): Bash {
	const networkConfig = buildNetworkConfig();
	const executionLimits = buildExecutionLimits();

	if (OVERLAY_ROOT) {
		const overlay = new OverlayFs({ root: OVERLAY_ROOT });
		return new Bash({
			fs: overlay,
			cwd: overlay.getMountPoint(),
			network: networkConfig,
			executionLimits,
			files,
		});
	}

	return new Bash({
		cwd: INITIAL_CWD,
		network: networkConfig,
		executionLimits,
		files,
	});
}

// ============================================================================
// Persistent Bash Instance
// ============================================================================

/** Persistent bash instance for stateful operations */
let persistentBash: Bash | null = null;

/**
 * Gets or creates the persistent Bash instance.
 * @returns The persistent Bash instance
 */
function getPersistentBash(): Bash {
	if (!persistentBash) {
		persistentBash = createBashInstance();
	}
	return persistentBash;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Tool: bash_exec
 * Execute a bash command in a sandboxed environment.
 * Each execution is isolated - environment variables, functions, and cwd don't persist.
 */
server.registerTool(
	"bash_exec",
	{
		description:
			"Execute a bash command in a sandboxed environment. Each execution is isolated - environment variables, functions, and cwd don't persist across calls (filesystem does).",
		inputSchema: {
			command: z.string().describe("The bash command to execute"),
			cwd: z.string().optional().describe("Working directory for the command"),
			env: z
				.record(z.string(), z.string())
				.optional()
				.describe("Environment variables to set"),
			files: z
				.record(z.string(), z.string())
				.optional()
				.describe("Files to create before execution (path -> content)"),
		} as any,
	},
	async ({
		command,
		cwd,
		env,
		files,
	}: {
		command: string;
		cwd?: string;
		env?: Record<string, string>;
		files?: Record<string, string>;
	}) => {
		try {
			const bash = createBashInstance(files);
			const result = await bash.exec(command, { cwd, env });

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								stdout: result.stdout,
								stderr: result.stderr,
								exitCode: result.exitCode,
								env: result.env,
							},
							null,
							2,
						),
					},
				],
				isError: result.exitCode !== 0,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: bash_exec_persistent
 * Execute a bash command in a persistent sandboxed environment.
 * The filesystem persists across calls, but env vars, functions, and cwd are reset.
 */
server.registerTool(
	"bash_exec_persistent",
	{
		description:
			"Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls, but env vars, functions, and cwd are reset each call.",
		inputSchema: {
			command: z.string().describe("The bash command to execute"),
			cwd: z.string().optional().describe("Working directory for the command"),
			env: z
				.record(z.string(), z.string())
				.optional()
				.describe("Environment variables to set"),
		} as any,
	},
	async ({
		command,
		cwd,
		env,
	}: {
		command: string;
		cwd?: string;
		env?: Record<string, string>;
	}) => {
		try {
			const bash = getPersistentBash();
			const result = await bash.exec(command, { cwd, env });

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								stdout: result.stdout,
								stderr: result.stderr,
								exitCode: result.exitCode,
								env: result.env,
							},
							null,
							2,
						),
					},
				],
				isError: result.exitCode !== 0,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: bash_reset
 * Reset the persistent bash environment, clearing all files and state.
 */
server.registerTool(
	"bash_reset",
	{
		description:
			"Reset the persistent bash environment, clearing all files and state.",
		inputSchema: {},
	},
	async () => {
		persistentBash = null;
		return {
			content: [
				{
					type: "text" as const,
					text: "Persistent bash environment has been reset.",
				},
			],
		};
	},
);

/**
 * Tool: bash_write_file
 * Write content to a file in the persistent bash environment.
 */
server.registerTool(
	"bash_write_file",
	{
		description: "Write content to a file in the persistent bash environment.",
		inputSchema: {
			path: z.string().describe("The file path to write to"),
			content: z.string().describe("The content to write"),
		} as any,
	},
	async ({ path, content }: { path: string; content: string }) => {
		try {
			const bash = getPersistentBash();
			const result = await bash.exec(
				`cat > '${path}' << 'JUST_BASH_EOF'\n${content}\nJUST_BASH_EOF`,
			);

			if (result.exitCode !== 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Failed to write file: ${result.stderr}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully wrote ${content.length} bytes to ${path}`,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Write error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: bash_read_file
 * Read content from a file in the persistent bash environment.
 */
server.registerTool(
	"bash_read_file",
	{
		description: "Read content from a file in the persistent bash environment.",
		inputSchema: {
			path: z.string().describe("The file path to read"),
		} as any,
	},
	async ({ path }: { path: string }) => {
		try {
			const bash = getPersistentBash();
			const result = await bash.exec(`cat '${path}'`);

			if (result.exitCode !== 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Failed to read file: ${result.stderr}`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: result.stdout,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Read error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: bash_list_files
 * List files and directories in the persistent bash environment.
 */
server.registerTool(
	"bash_list_files",
	{
		description:
			"List files and directories in the persistent bash environment.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("The directory path to list (defaults to current directory)"),
			recursive: z.boolean().optional().describe("Whether to list recursively"),
			showHidden: z
				.boolean()
				.optional()
				.describe("Whether to show hidden files"),
		} as any,
	},
	async ({
		path = ".",
		recursive = false,
		showHidden = false,
	}: {
		path?: string;
		recursive?: boolean;
		showHidden?: boolean;
	}) => {
		try {
			const bash = getPersistentBash();
			let cmd = "ls -l";
			if (showHidden) cmd += "a";
			if (recursive) cmd = `find '${path}' -type f`;
			else cmd += ` '${path}'`;

			const result = await bash.exec(cmd);

			return {
				content: [
					{
						type: "text" as const,
						text: result.stdout || "(empty directory)",
					},
				],
				isError: result.exitCode !== 0,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `List error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Tool: bash_info
 * Get information about the bash environment configuration.
 */
server.registerTool(
	"bash_info",
	{
		description: "Get information about the bash environment configuration.",
		inputSchema: {},
	},
	async () => {
		const info = {
			overlayRoot: OVERLAY_ROOT || null,
			initialCwd: INITIAL_CWD,
			networkEnabled: ALLOW_NETWORK,
			allowedUrlPrefixes:
				ALLOWED_URL_PREFIXES.length > 0 ? ALLOWED_URL_PREFIXES : null,
			allowedMethods: ALLOW_NETWORK ? ALLOWED_METHODS : null,
			executionLimits: buildExecutionLimits(),
			availableCommands: getCommandNames(),
			networkCommands: ALLOW_NETWORK ? getNetworkCommandNames() : [],
			supportedCommands: [
				"File Operations: basename, cat, chmod, cp, dirname, du, file, find, ln, ls, mkdir, mv, od, pwd, readlink, rm, split, stat, touch, tree",
				"Text Processing: awk, column, comm, cut, diff, expand, fold, grep (+ egrep, fgrep), head, join, jq, nl, paste, rev, sed, sort, strings, tac, tail, tr, unexpand, uniq, wc, xan, xargs, yq",
				"Hashing & Encoding: base64, md5sum, sha1sum, sha256sum",
				"Compression: gzip (+ gunzip, zcat)",
				"Database: sqlite3",
				"Navigation & Environment: cd, echo, env, export, hostname, printenv, printf, tee",
				"Shell Utilities: alias, bash, clear, date, expr, false, help, history, seq, sh, sleep, timeout, true, unalias, which",
				"Network Commands (if enabled): curl, html-to-markdown",
			],
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(info, null, 2),
				},
			],
		};
	},
);

// ============================================================================
// Server Startup
// ============================================================================

/** Start the MCP server with stdio transport */
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("just-bash-mcp server running on stdio");
