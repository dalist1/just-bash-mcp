/**
 * Utility functions for just-bash-mcp
 */

import { config } from "../config/index.ts";

/**
 * Truncate output to maximum length with notification message
 */
export function truncateOutput(
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

/**
 * Create a successful MCP tool response
 */
export function createSuccessResponse(text: string): {
	content: Array<{ type: "text"; text: string }>;
} {
	return {
		content: [{ type: "text" as const, text }],
	};
}

/**
 * Create an error MCP tool response
 */
export function createErrorResponse(
	error: unknown,
	prefix = "Error",
): { content: Array<{ type: "text"; text: string }>; isError: true } {
	const message = error instanceof Error ? error.message : String(error);
	return {
		content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
		isError: true,
	};
}

/**
 * Create a JSON MCP tool response
 */
export function createJsonResponse(
	data: unknown,
	isError = false,
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
	const response: {
		content: Array<{ type: "text"; text: string }>;
		isError?: boolean;
	} = {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
	if (isError) {
		response.isError = true;
	}
	return response;
}

/**
 * Format bash execution result for MCP response
 */
export function formatExecResult(result: {
	stdout: string;
	stderr: string;
	exitCode: number;
	env?: Record<string, string>;
}): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
	return createJsonResponse(
		{
			stdout: truncateOutput(result.stdout, config.MAX_OUTPUT_LENGTH, "stdout"),
			stderr: truncateOutput(result.stderr, config.MAX_OUTPUT_LENGTH, "stderr"),
			exitCode: result.exitCode,
			...(result.env && { env: result.env }),
		},
		result.exitCode !== 0,
	);
}
