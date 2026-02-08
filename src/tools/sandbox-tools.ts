/**
 * Sandbox API tools
 * Vercel Sandbox compatible tools for execution in an isolated environment
 *
 * Uses upstream Sandbox/SandboxCommand APIs:
 * - Sandbox.create(), runCommand(), writeFiles(), readFile(), mkDir(), stop()
 * - SandboxCommand: wait(), stdout(), stderr(), output(), logs(), kill()
 * - Sandbox.domain getter for domain info
 * - OutputMessage type for streaming output
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	NetworkAccessDeniedError,
	RedirectNotAllowedError,
	SecurityViolationError,
	TooManyRedirectsError,
} from "just-bash";
import { z } from "zod/v4";
import { config } from "../config/index.ts";
import {
	createErrorResponse,
	createJsonResponse,
	createSuccessResponse,
	truncateOutput,
} from "../utils/index.ts";
import { getPersistentSandbox, resetPersistentSandbox } from "./bash-instance.ts";

/**
 * Classify errors from just-bash into user-friendly messages.
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
 * Register Vercel Sandbox compatible tools with the MCP server
 */
export function registerSandboxTools(server: McpServer): void {
	// ========================================================================
	// bash_sandbox_run - Run command in sandbox
	// ========================================================================
	server.registerTool(
		"bash_sandbox_run",
		{
			description:
				"Run a command in a Vercel Sandbox compatible environment. The sandbox persists across calls.",
			inputSchema: {
				command: z.string().describe("The command to execute"),
				cwd: z.string().optional().describe("Working directory for the command"),
				env: z.record(z.string(), z.string()).optional().describe("Environment variables to set"),
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
				const sandbox = await getPersistentSandbox();
				const cmd = await sandbox.runCommand(command, { cwd, env });
				const result = await cmd.wait();
				const stdout = await cmd.stdout();
				const stderr = await cmd.stderr();

				return createJsonResponse(
					{
						stdout: truncateOutput(stdout, config.MAX_OUTPUT_LENGTH, "stdout"),
						stderr: truncateOutput(stderr, config.MAX_OUTPUT_LENGTH, "stderr"),
						exitCode: result.exitCode,
					},
					result.exitCode !== 0,
				);
			} catch (error) {
				return classifyError(error, "Sandbox error");
			}
		},
	);

	// ========================================================================
	// bash_sandbox_write_files - Write multiple files
	// ========================================================================
	server.registerTool(
		"bash_sandbox_write_files",
		{
			description: "Write multiple files to the sandbox environment at once.",
			inputSchema: {
				files: z.record(z.string(), z.string()).describe("Files to write (path -> content)"),
			},
		},
		async ({ files }: { files: Record<string, string> }) => {
			try {
				const sandbox = await getPersistentSandbox();
				await sandbox.writeFiles(files);

				return createSuccessResponse(
					`Successfully wrote ${Object.keys(files).length} file(s): ${Object.keys(files).join(", ")}`,
				);
			} catch (error) {
				return classifyError(error, "Write error");
			}
		},
	);

	// ========================================================================
	// bash_sandbox_read_file - Read file from sandbox
	// ========================================================================
	server.registerTool(
		"bash_sandbox_read_file",
		{
			description: "Read a file from the sandbox environment.",
			inputSchema: {
				path: z.string().describe("The file path to read"),
				encoding: z.enum(["utf-8", "base64"]).optional().describe("File encoding (default: utf-8)"),
			},
		},
		async ({ path, encoding = "utf-8" }: { path: string; encoding?: "utf-8" | "base64" }) => {
			try {
				const sandbox = await getPersistentSandbox();
				const content = await sandbox.readFile(path, encoding);

				return {
					content: [
						{
							type: "text" as const,
							text: truncateOutput(content, config.MAX_OUTPUT_LENGTH, "stdout"),
						},
					],
				};
			} catch (error) {
				return classifyError(error, "Read error");
			}
		},
	);

	// ========================================================================
	// bash_sandbox_mkdir - Create directory in sandbox
	// ========================================================================
	server.registerTool(
		"bash_sandbox_mkdir",
		{
			description: "Create a directory in the sandbox environment.",
			inputSchema: {
				path: z.string().describe("The directory path to create"),
				recursive: z
					.boolean()
					.optional()
					.describe("Create parent directories if needed (default: true)"),
			},
		},
		async ({ path, recursive = true }: { path: string; recursive?: boolean }) => {
			try {
				const sandbox = await getPersistentSandbox();
				await sandbox.mkDir(path, { recursive });

				return createSuccessResponse(`Successfully created directory: ${path}`);
			} catch (error) {
				return classifyError(error, "Mkdir error");
			}
		},
	);

	// ========================================================================
	// bash_sandbox_stop - Stop and clean up sandbox
	// ========================================================================
	server.registerTool(
		"bash_sandbox_stop",
		{
			description:
				"Stop and clean up the sandbox environment, releasing all resources. Use bash_sandbox_reset to just clear state.",
			inputSchema: {},
		},
		async () => {
			try {
				await resetPersistentSandbox();
				return createSuccessResponse("Sandbox environment has been stopped and cleaned up.");
			} catch (error) {
				return classifyError(error, "Stop error");
			}
		},
	);

	// ========================================================================
	// bash_sandbox_reset - Reset sandbox
	// ========================================================================
	server.registerTool(
		"bash_sandbox_reset",
		{
			description: "Reset the sandbox environment, clearing all files and state.",
			inputSchema: {},
		},
		async () => {
			try {
				await resetPersistentSandbox();
				return createSuccessResponse("Sandbox environment has been reset.");
			} catch (error) {
				return classifyError(error, "Reset error");
			}
		},
	);
}
