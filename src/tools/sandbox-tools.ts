/**
 * Sandbox API tools
 * Tools for execution in a persistent isolated environment
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
	type OutputMessage,
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

export function registerSandboxTools(server: McpServer): void {
	server.registerTool(
		"bash_sandbox_run",
		{
			description:
				"Run a command in a persistent isolated environment with optional structured output and logs.",
			inputSchema: {
				command: z.string().describe("The command to execute"),
				cwd: z.string().optional().describe("Working directory for the command"),
				env: z.record(z.string(), z.string()).optional().describe("Environment variables to set"),
				includeOutput: z
					.boolean()
					.optional()
					.describe("Include structured output messages from SandboxCommand.output()"),
				includeLogs: z
					.boolean()
					.optional()
					.describe("Include execution logs from SandboxCommand.logs()"),
			},
		},
		async ({
			command,
			cwd,
			env,
			includeOutput = false,
			includeLogs = false,
		}: {
			command: string;
			cwd?: string;
			env?: Record<string, string>;
			includeOutput?: boolean;
			includeLogs?: boolean;
		}) => {
			try {
				const sandbox = await getPersistentSandbox();
				const cmd = await sandbox.runCommand(command, { cwd, env });
				const result = await cmd.wait();
				const stdout = await cmd.stdout();
				const stderr = await cmd.stderr();

				const response: {
					stdout: string;
					stderr: string;
					exitCode: number;
					output?: string;
					logs?: OutputMessage[];
				} = {
					stdout: truncateOutput(stdout, config.MAX_OUTPUT_LENGTH, "stdout"),
					stderr: truncateOutput(stderr, config.MAX_OUTPUT_LENGTH, "stderr"),
					exitCode: result.exitCode,
				};

				if (includeOutput) {
					response.output = truncateOutput(await cmd.output(), config.MAX_OUTPUT_LENGTH, "stdout");
				}
				if (includeLogs) {
					const logs: OutputMessage[] = [];
					for await (const message of cmd.logs()) {
						logs.push(message);
					}
					response.logs = logs;
				}

				return createJsonResponse(response, result.exitCode !== 0);
			} catch (error) {
				return classifyError(error, "Sandbox error");
			}
		},
	);

	server.registerTool(
		"bash_sandbox_domain",
		{
			description: "Get the current sandbox domain or identifier.",
			inputSchema: {},
		},
		async () => {
			try {
				const sandbox = await getPersistentSandbox();
				return createJsonResponse({ domain: sandbox.domain });
			} catch (error) {
				return classifyError(error, "Domain error");
			}
		},
	);

	server.registerTool(
		"bash_sandbox_write_files",
		{
			description: "Write multiple files to the persistent isolated environment at once.",
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

	server.registerTool(
		"bash_sandbox_read_file",
		{
			description: "Read a file from the persistent isolated environment.",
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

	server.registerTool(
		"bash_sandbox_mkdir",
		{
			description: "Create a directory in the persistent isolated environment.",
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

	server.registerTool(
		"bash_sandbox_stop",
		{
			description:
				"Stop and clean up the persistent isolated environment, releasing all resources. Use bash_sandbox_reset to just clear state.",
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

	server.registerTool(
		"bash_sandbox_reset",
		{
			description: "Reset the persistent isolated environment, clearing all files and state.",
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
