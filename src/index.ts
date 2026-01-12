#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	Bash,
	type BashOptions,
	getCommandNames,
	getNetworkCommandNames,
	type NetworkConfig,
	OverlayFs,
	ReadWriteFs,
} from "just-bash";
import { z } from "zod/v4";

type HttpMethod =
	| "GET"
	| "HEAD"
	| "POST"
	| "PUT"
	| "DELETE"
	| "PATCH"
	| "OPTIONS";

const OVERLAY_ROOT = process.env.JUST_BASH_OVERLAY_ROOT;
const READ_WRITE_ROOT = process.env.JUST_BASH_READ_WRITE_ROOT;
const INITIAL_CWD = process.env.JUST_BASH_CWD || "/home/user";
const ALLOW_NETWORK = process.env.JUST_BASH_ALLOW_NETWORK === "true";
const ALLOWED_URL_PREFIXES =
	process.env.JUST_BASH_ALLOWED_URLS?.split(",").filter(Boolean) || [];
const ALLOWED_METHODS = (process.env.JUST_BASH_ALLOWED_METHODS?.split(
	",",
).filter(Boolean) || ["GET", "HEAD"]) as HttpMethod[];
const MAX_REDIRECTS = Number.parseInt(
	process.env.JUST_BASH_MAX_REDIRECTS || "20",
	10,
);
const NETWORK_TIMEOUT_MS = Number.parseInt(
	process.env.JUST_BASH_NETWORK_TIMEOUT_MS || "30000",
	10,
);
const MAX_CALL_DEPTH = Number.parseInt(
	process.env.JUST_BASH_MAX_CALL_DEPTH || "100",
	10,
);
const MAX_COMMAND_COUNT = Number.parseInt(
	process.env.JUST_BASH_MAX_COMMAND_COUNT || "10000",
	10,
);
const MAX_LOOP_ITERATIONS = Number.parseInt(
	process.env.JUST_BASH_MAX_LOOP_ITERATIONS || "10000",
	10,
);
const MAX_OUTPUT_LENGTH = Number.parseInt(
	process.env.JUST_BASH_MAX_OUTPUT_LENGTH || "30000",
	10,
);

const server = new McpServer({
	name: "just-bash-mcp",
			version: "2.0.1",
});

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

	return {
		dangerouslyAllowFullInternetAccess: true,
		maxRedirects: MAX_REDIRECTS,
		timeoutMs: NETWORK_TIMEOUT_MS,
	};
}

function buildExecutionLimits(): BashOptions["executionLimits"] {
	return {
		maxCallDepth: MAX_CALL_DEPTH,
		maxCommandCount: MAX_COMMAND_COUNT,
		maxLoopIterations: MAX_LOOP_ITERATIONS,
		maxAwkIterations: MAX_LOOP_ITERATIONS,
		maxSedIterations: MAX_LOOP_ITERATIONS,
		maxJqIterations: MAX_LOOP_ITERATIONS,
	};
}

function createBashInstance(files?: Record<string, string>): Bash {
	const networkConfig = buildNetworkConfig();
	const executionLimits = buildExecutionLimits();

	if (READ_WRITE_ROOT) {
		const rwfs = new ReadWriteFs({ root: READ_WRITE_ROOT });
		return new Bash({
			fs: rwfs,
			cwd: READ_WRITE_ROOT,
			network: networkConfig,
			executionLimits,
			files,
		});
	}

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

function truncateOutput(
	output: string,
	maxLength: number,
	streamName: "stdout" | "stderr",
): string {
	if (output.length <= maxLength) {
		return output;
	}
	const truncatedLength = output.length - maxLength;
	return `${output.slice(0, maxLength)}\n\n[${streamName} truncated: ${truncatedLength} characters removed]`;
}

let persistentBash: Bash | null = null;

function getPersistentBash(): Bash {
	if (!persistentBash) {
		persistentBash = createBashInstance();
	}
	return persistentBash;
}

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
		},
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
								stdout: truncateOutput(
									result.stdout,
									MAX_OUTPUT_LENGTH,
									"stdout",
								),
								stderr: truncateOutput(
									result.stderr,
									MAX_OUTPUT_LENGTH,
									"stderr",
								),
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
		},
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
								stdout: truncateOutput(
									result.stdout,
									MAX_OUTPUT_LENGTH,
									"stdout",
								),
								stderr: truncateOutput(
									result.stderr,
									MAX_OUTPUT_LENGTH,
									"stderr",
								),
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

server.registerTool(
	"bash_write_file",
	{
		description: "Write content to a file in the persistent bash environment.",
		inputSchema: {
			path: z.string().describe("The file path to write to"),
			content: z.string().describe("The content to write"),
		},
	},
	async ({ path, content }: { path: string; content: string }) => {
		try {
			const bash = getPersistentBash();
			const escapedContent = content.replace(/'/g, "'\\''");
			const result = await bash.exec(
				`mkdir -p "$(dirname '${path}')" && cat > '${path}' << 'JUST_BASH_EOF'\n${escapedContent}\nJUST_BASH_EOF`,
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

server.registerTool(
	"bash_read_file",
	{
		description: "Read content from a file in the persistent bash environment.",
		inputSchema: {
			path: z.string().describe("The file path to read"),
		},
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
						text: truncateOutput(result.stdout, MAX_OUTPUT_LENGTH, "stdout"),
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
		},
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
			let cmd: string;

			if (recursive) {
				cmd = showHidden
					? `find '${path}' -type f`
					: `find '${path}' -type f ! -name '.*' ! -path '*/.*'`;
			} else {
				cmd = showHidden ? `ls -la '${path}'` : `ls -l '${path}'`;
			}

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

server.registerTool(
	"bash_info",
	{
		description: "Get information about the bash environment configuration.",
		inputSchema: {},
	},
	async () => {
		const fsMode = READ_WRITE_ROOT
			? "read-write"
			: OVERLAY_ROOT
				? "overlay"
				: "in-memory";

		const info = {
	version: "2.0.1",
			fsMode,
			fsRoot: READ_WRITE_ROOT || OVERLAY_ROOT || null,
			initialCwd: INITIAL_CWD,
			networkEnabled: ALLOW_NETWORK,
			allowedUrlPrefixes:
				ALLOWED_URL_PREFIXES.length > 0 ? ALLOWED_URL_PREFIXES : null,
			allowedMethods: ALLOW_NETWORK ? ALLOWED_METHODS : null,
			maxOutputLength: MAX_OUTPUT_LENGTH,
			executionLimits: buildExecutionLimits(),
			availableCommands: getCommandNames(),
			networkCommands: ALLOW_NETWORK ? getNetworkCommandNames() : [],
			commandCategories: {
				fileOperations:
					"cat, cp, file, ln, ls, mkdir, mv, readlink, rm, split, stat, touch, tree",
				textProcessing:
					"awk, base64, column, comm, cut, diff, expand, fold, grep (egrep, fgrep), head, join, md5sum, nl, od, paste, printf, rev, sed, sha1sum, sha256sum, sort, strings, tac, tail, tr, unexpand, uniq, wc, xargs",
				dataProcessing:
					"jq (JSON), sqlite3 (SQLite), xan (CSV), yq (YAML/XML/TOML/CSV)",
				compression: "gzip (gunzip, zcat)",
				navigation:
					"basename, cd, dirname, du, echo, env, export, find, hostname, printenv, pwd, tee",
				shellUtilities:
					"alias, bash, chmod, clear, date, expr, false, help, history, seq, sh, sleep, timeout, true, unalias, which",
				network: "curl, html-to-markdown (when network enabled)",
			},
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("just-bash-mcp server v2.0.1 running on stdio");
