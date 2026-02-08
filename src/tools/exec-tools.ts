/**
 * Bash execution tools
 * Core tools for executing bash commands
 *
 * Uses upstream network error classes for rich error classification:
 * - NetworkAccessDeniedError: URL not in allowlist
 * - TooManyRedirectsError: Redirect limit exceeded
 * - RedirectNotAllowedError: Redirect target not in allowlist
 * - SecurityViolationError: Defense-in-depth violation detected
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	NetworkAccessDeniedError,
	RedirectNotAllowedError,
	SecurityViolationError,
	TooManyRedirectsError,
} from "just-bash";
import { z } from "zod/v4";
import { createErrorResponse, formatExecResult } from "../utils/index.ts";
import { createBashInstance, getPersistentBash, resetPersistentBash } from "./bash-instance.ts";

/**
 * Classify errors from just-bash into user-friendly messages.
 * Uses upstream error classes for precise classification.
 */
function classifyError(error: unknown, prefix: string) {
	if (error instanceof NetworkAccessDeniedError) {
		return createErrorResponse(error, `${prefix} [Network Access Denied]`);
	}
	if (error instanceof TooManyRedirectsError) {
		return createErrorResponse(error, `${prefix} [Too Many Redirects]`);
	}
	if (error instanceof RedirectNotAllowedError) {
		return createErrorResponse(error, `${prefix} [Redirect Not Allowed]`);
	}
	if (error instanceof SecurityViolationError) {
		return createErrorResponse(error, `${prefix} [Security Violation]`);
	}
	return createErrorResponse(error, prefix);
}

/**
 * Register bash execution tools with the MCP server
 */
export function registerExecTools(server: McpServer): void {
	// ========================================================================
	// bash_exec - Isolated execution
	// ========================================================================
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
					.describe("Environment variables to set for execution"),
				initialEnv: z
					.record(z.string(), z.string())
					.optional()
					.describe("Initial environment variables to set when creating the bash instance"),
				files: z
					.record(z.string(), z.string())
					.optional()
					.describe("Files to create before execution (path -> content)"),
				rawScript: z
					.boolean()
					.optional()
					.describe(
						"If true, skip normalizing the script (preserves leading whitespace). Useful for here-docs.",
					),
			},
		},
		async ({
			command,
			cwd,
			env,
			initialEnv,
			files,
			rawScript,
		}: {
			command: string;
			cwd?: string;
			env?: Record<string, string>;
			initialEnv?: Record<string, string>;
			files?: Record<string, string>;
			rawScript?: boolean;
		}) => {
			try {
				const bash = createBashInstance(files, undefined, initialEnv);
				const result = await bash.exec(command, { cwd, env, rawScript });
				return formatExecResult(result);
			} catch (error) {
				return classifyError(error, "Execution error");
			}
		},
	);

	// ========================================================================
	// bash_exec_persistent - Persistent execution
	// ========================================================================
	server.registerTool(
		"bash_exec_persistent",
		{
			description:
				"Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls, but env vars, functions, and cwd are reset each call.",
			inputSchema: {
				command: z.string().describe("The bash command to execute"),
				cwd: z.string().optional().describe("Working directory for the command"),
				env: z.record(z.string(), z.string()).optional().describe("Environment variables to set"),
				rawScript: z
					.boolean()
					.optional()
					.describe(
						"If true, skip normalizing the script (preserves leading whitespace). Useful for here-docs.",
					),
			},
		},
		async ({
			command,
			cwd,
			env,
			rawScript,
		}: {
			command: string;
			cwd?: string;
			env?: Record<string, string>;
			rawScript?: boolean;
		}) => {
			try {
				const bash = getPersistentBash();
				const result = await bash.exec(command, { cwd, env, rawScript });
				return formatExecResult(result);
			} catch (error) {
				return classifyError(error, "Execution error");
			}
		},
	);

	// ========================================================================
	// bash_reset - Reset persistent environment
	// ========================================================================
	server.registerTool(
		"bash_reset",
		{
			description: "Reset the persistent bash environment, clearing all files and state.",
			inputSchema: {},
		},
		async () => {
			resetPersistentBash();
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
}
