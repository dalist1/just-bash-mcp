/**
 * File operation tools
 * Tools for reading, writing, and listing files in the bash environment
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { config } from "../config/index.js";
import {
	createErrorResponse,
	createSuccessResponse,
	truncateOutput,
} from "../utils/index.js";
import { getPersistentBash } from "./bash-instance.js";

/**
 * Register file operation tools with the MCP server
 */
export function registerFileTools(server: McpServer): void {
	// ========================================================================
	// bash_write_file - Write file via shell
	// ========================================================================
	server.registerTool(
		"bash_write_file",
		{
			description:
				"Write content to a file in the persistent bash environment.",
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

				return createSuccessResponse(
					`Successfully wrote ${content.length} bytes to ${path}`,
				);
			} catch (error) {
				return createErrorResponse(error, "Write error");
			}
		},
	);

	// ========================================================================
	// bash_read_file - Read file via shell
	// ========================================================================
	server.registerTool(
		"bash_read_file",
		{
			description:
				"Read content from a file in the persistent bash environment.",
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
							text: truncateOutput(
								result.stdout,
								config.MAX_OUTPUT_LENGTH,
								"stdout",
							),
						},
					],
				};
			} catch (error) {
				return createErrorResponse(error, "Read error");
			}
		},
	);

	// ========================================================================
	// bash_list_files - List files
	// ========================================================================
	server.registerTool(
		"bash_list_files",
		{
			description:
				"List files and directories in the persistent bash environment.",
			inputSchema: {
				path: z
					.string()
					.optional()
					.describe(
						"The directory path to list (defaults to current directory)",
					),
				recursive: z
					.boolean()
					.optional()
					.describe("Whether to list recursively"),
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
				return createErrorResponse(error, "List error");
			}
		},
	);

	// ========================================================================
	// bash_direct_read - Direct filesystem read
	// ========================================================================
	server.registerTool(
		"bash_direct_read",
		{
			description:
				"Read a file directly from the persistent bash filesystem (without running cat).",
			inputSchema: {
				path: z.string().describe("The file path to read"),
			},
		},
		async ({ path }: { path: string }) => {
			try {
				const bash = getPersistentBash();
				const content = await bash.readFile(path);

				return {
					content: [
						{
							type: "text" as const,
							text: truncateOutput(content, config.MAX_OUTPUT_LENGTH, "stdout"),
						},
					],
				};
			} catch (error) {
				return createErrorResponse(error, "Read error");
			}
		},
	);

	// ========================================================================
	// bash_direct_write - Direct filesystem write
	// ========================================================================
	server.registerTool(
		"bash_direct_write",
		{
			description:
				"Write a file directly to the persistent bash filesystem (without running shell commands).",
			inputSchema: {
				path: z.string().describe("The file path to write"),
				content: z.string().describe("The content to write"),
			},
		},
		async ({ path, content }: { path: string; content: string }) => {
			try {
				const bash = getPersistentBash();
				await bash.writeFile(path, content);

				return createSuccessResponse(
					`Successfully wrote ${content.length} bytes to ${path}`,
				);
			} catch (error) {
				return createErrorResponse(error, "Write error");
			}
		},
	);
}
