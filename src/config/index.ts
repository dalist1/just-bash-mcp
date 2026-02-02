/**
 * Configuration module for just-bash-mcp
 * Handles environment variable parsing and configuration building
 */

import {
	type BashLogger,
	type BashOptions,
	type CommandName,
	InMemoryFs,
	MountableFs,
	type MountConfig,
	type NetworkConfig,
	OverlayFs,
	ReadWriteFs,
} from "just-bash";

// ============================================================================
// Types
// ============================================================================

export type HttpMethod =
	| "GET"
	| "HEAD"
	| "POST"
	| "PUT"
	| "DELETE"
	| "PATCH"
	| "OPTIONS";

export interface TraceEvent {
	category: string;
	name: string;
	durationMs: number;
	details?: Record<string, unknown>;
}

export type TraceCallback = (event: TraceEvent) => void;

// ============================================================================
// Environment Variable Parsing
// ============================================================================

function parseEnvString(key: string, defaultValue: string): string {
	return process.env[key] || defaultValue;
}

function parseEnvBoolean(key: string, defaultValue: boolean): boolean {
	return process.env[key] === "true" ? true : defaultValue;
}

function parseEnvInt(key: string, defaultValue: number): number {
	const value = process.env[key];
	if (!value) return defaultValue;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvStringArray(key: string): string[] {
	return process.env[key]?.split(",").filter(Boolean) || [];
}

// ============================================================================
// Configuration Constants
// ============================================================================

export interface Config {
	readonly VERSION: string;
	readonly SERVER_NAME: string;
	readonly OVERLAY_ROOT: string | undefined;
	readonly READ_WRITE_ROOT: string | undefined;
	readonly MOUNTS_CONFIG: string | undefined;
	readonly INITIAL_CWD: string;
	readonly ALLOW_NETWORK: boolean;
	readonly ALLOWED_URL_PREFIXES: string[];
	readonly ALLOWED_METHODS: HttpMethod[];
	readonly MAX_REDIRECTS: number;
	readonly NETWORK_TIMEOUT_MS: number;
	readonly MAX_CALL_DEPTH: number;
	readonly MAX_COMMAND_COUNT: number;
	readonly MAX_LOOP_ITERATIONS: number;
	readonly MAX_SQLITE_TIMEOUT_MS: number;
	readonly MAX_PYTHON_TIMEOUT_MS: number;
	readonly MAX_OUTPUT_LENGTH: number;
	readonly ENABLE_LOGGING: boolean;
	readonly ENABLE_TRACING: boolean;
	readonly ALLOWED_COMMANDS: CommandName[] | undefined;
}

function getAllowedMethods(): HttpMethod[] {
	const methods = parseEnvStringArray("JUST_BASH_ALLOWED_METHODS");
	return methods.length > 0 ? (methods as HttpMethod[]) : ["GET", "HEAD"];
}

function getAllowedCommands(): CommandName[] | undefined {
	const commands = parseEnvStringArray("JUST_BASH_ALLOWED_COMMANDS");
	return commands.length > 0 ? (commands as CommandName[]) : undefined;
}

export const config: Config = {
	// Server info
	VERSION: "2.7.0",
	SERVER_NAME: "just-bash-mcp",

	// Filesystem configuration
	OVERLAY_ROOT: process.env.JUST_BASH_OVERLAY_ROOT,
	READ_WRITE_ROOT: process.env.JUST_BASH_READ_WRITE_ROOT,
	MOUNTS_CONFIG: process.env.JUST_BASH_MOUNTS,
	INITIAL_CWD: parseEnvString("JUST_BASH_CWD", "/home/user"),

	// Network configuration
	ALLOW_NETWORK: parseEnvBoolean("JUST_BASH_ALLOW_NETWORK", false),
	ALLOWED_URL_PREFIXES: parseEnvStringArray("JUST_BASH_ALLOWED_URLS"),
	ALLOWED_METHODS: getAllowedMethods(),
	MAX_REDIRECTS: parseEnvInt("JUST_BASH_MAX_REDIRECTS", 20),
	NETWORK_TIMEOUT_MS: parseEnvInt("JUST_BASH_NETWORK_TIMEOUT_MS", 30000),

	// Execution limits
	MAX_CALL_DEPTH: parseEnvInt("JUST_BASH_MAX_CALL_DEPTH", 100),
	MAX_COMMAND_COUNT: parseEnvInt("JUST_BASH_MAX_COMMAND_COUNT", 10000),
	MAX_LOOP_ITERATIONS: parseEnvInt("JUST_BASH_MAX_LOOP_ITERATIONS", 10000),
	MAX_SQLITE_TIMEOUT_MS: parseEnvInt("JUST_BASH_MAX_SQLITE_TIMEOUT_MS", 5000),
	MAX_PYTHON_TIMEOUT_MS: parseEnvInt("JUST_BASH_MAX_PYTHON_TIMEOUT_MS", 30000),

	// Output limits
	MAX_OUTPUT_LENGTH: parseEnvInt("JUST_BASH_MAX_OUTPUT_LENGTH", 30000),

	// Debugging
	ENABLE_LOGGING: parseEnvBoolean("JUST_BASH_ENABLE_LOGGING", false),
	ENABLE_TRACING: parseEnvBoolean("JUST_BASH_ENABLE_TRACING", false),

	// Command filtering
	ALLOWED_COMMANDS: getAllowedCommands(),
};

// ============================================================================
// Logger and Trace Callback
// ============================================================================

export const bashLogger: BashLogger | undefined = config.ENABLE_LOGGING
	? {
			info(message: string, data?: Record<string, unknown>): void {
				console.error(`[just-bash] INFO: ${message}`, data || "");
			},
			debug(message: string, data?: Record<string, unknown>): void {
				console.error(`[just-bash] DEBUG: ${message}`, data || "");
			},
		}
	: undefined;

export const traceCallback: TraceCallback | undefined = config.ENABLE_TRACING
	? (event: TraceEvent) => {
			console.error(
				`[just-bash] TRACE: ${event.category}/${event.name} ${event.durationMs}ms`,
				event.details ? JSON.stringify(event.details) : "",
			);
		}
	: undefined;

// ============================================================================
// Configuration Builders
// ============================================================================

export function buildNetworkConfig(): NetworkConfig | undefined {
	if (!config.ALLOW_NETWORK) {
		return undefined;
	}

	if (config.ALLOWED_URL_PREFIXES.length > 0) {
		return {
			allowedUrlPrefixes: config.ALLOWED_URL_PREFIXES,
			allowedMethods: config.ALLOWED_METHODS,
			maxRedirects: config.MAX_REDIRECTS,
			timeoutMs: config.NETWORK_TIMEOUT_MS,
		};
	}

	return {
		dangerouslyAllowFullInternetAccess: true,
		maxRedirects: config.MAX_REDIRECTS,
		timeoutMs: config.NETWORK_TIMEOUT_MS,
	};
}

export function buildExecutionLimits(): NonNullable<
	BashOptions["executionLimits"]
> {
	return {
		maxCallDepth: config.MAX_CALL_DEPTH,
		maxCommandCount: config.MAX_COMMAND_COUNT,
		maxLoopIterations: config.MAX_LOOP_ITERATIONS,
		maxAwkIterations: config.MAX_LOOP_ITERATIONS,
		maxSedIterations: config.MAX_LOOP_ITERATIONS,
		maxJqIterations: config.MAX_LOOP_ITERATIONS,
		maxSqliteTimeoutMs: config.MAX_SQLITE_TIMEOUT_MS,
		maxPythonTimeoutMs: config.MAX_PYTHON_TIMEOUT_MS,
	};
}

export function parseMountsConfig(): MountConfig[] {
	if (!config.MOUNTS_CONFIG) return [];
	try {
		const parsed = JSON.parse(config.MOUNTS_CONFIG);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(
			(mount: { mountPoint: string; root: string; type?: string }) => {
				const fsType = mount.type || "overlay";
				const filesystem =
					fsType === "readwrite"
						? new ReadWriteFs({ root: mount.root })
						: new OverlayFs({ root: mount.root });
				return { mountPoint: mount.mountPoint, filesystem };
			},
		);
	} catch {
		return [];
	}
}

// ============================================================================
// Environment Variables Documentation
// ============================================================================

export const ENVIRONMENT_VARIABLES = {
	JUST_BASH_OVERLAY_ROOT:
		"Real directory to mount as overlay (read from disk, write to memory)",
	JUST_BASH_READ_WRITE_ROOT: "Real directory with read-write access",
	JUST_BASH_MOUNTS: "JSON array of mount configurations",
	JUST_BASH_CWD: "Initial working directory (default: /home/user)",
	JUST_BASH_ALLOW_NETWORK: "Enable network access (default: false)",
	JUST_BASH_ALLOWED_URLS: "Comma-separated URL prefixes to allow",
	JUST_BASH_ALLOWED_METHODS: "Comma-separated HTTP methods (default: GET,HEAD)",
	JUST_BASH_ALLOWED_COMMANDS: "Comma-separated list of allowed commands",
	JUST_BASH_MAX_REDIRECTS: "Max HTTP redirects (default: 20)",
	JUST_BASH_NETWORK_TIMEOUT_MS: "Network timeout (default: 30000)",
	JUST_BASH_MAX_CALL_DEPTH: "Max recursion depth (default: 100)",
	JUST_BASH_MAX_COMMAND_COUNT: "Max commands per execution (default: 10000)",
	JUST_BASH_MAX_LOOP_ITERATIONS: "Max loop iterations (default: 10000)",
	JUST_BASH_MAX_SQLITE_TIMEOUT_MS: "SQLite timeout (default: 5000)",
	JUST_BASH_MAX_PYTHON_TIMEOUT_MS: "Python timeout (default: 30000)",
	JUST_BASH_MAX_OUTPUT_LENGTH: "Max output length (default: 30000)",
	JUST_BASH_ENABLE_LOGGING: "Enable debug logging (default: false)",
	JUST_BASH_ENABLE_TRACING: "Enable performance tracing (default: false)",
} as const;

// ============================================================================
// Command Categories Documentation
// ============================================================================

export const COMMAND_CATEGORIES = {
	fileOperations:
		"cat, cp, file, ln, ls, mkdir, mv, readlink, rm, rmdir, split, stat, touch, tree",
	textProcessing:
		"awk, base64, column, comm, cut, diff, expand, fold, grep (egrep, fgrep), head, join, md5sum, nl, od, paste, printf, rev, rg (ripgrep), sed, sha1sum, sha256sum, sort, strings, tac, tail, tr, unexpand, uniq, wc, xargs",
	dataProcessing:
		"jq (JSON), python3/python (Python via Pyodide), sqlite3 (SQLite), xan (CSV), yq (YAML/XML/TOML/CSV)",
	compression: "gzip (gunzip, zcat), tar",
	navigation:
		"basename, cd, dirname, du, echo, env, export, find, hostname, printenv, pwd, tee, whoami",
	shellUtilities:
		"alias, bash, chmod, clear, date, expr, false, help, history, seq, sh, sleep, time, timeout, true, unalias, which",
	network: "curl, html-to-markdown (when network enabled)",
} as const;

// ============================================================================
// Features Documentation
// ============================================================================

export const FEATURES = {
	customCommands: "Define custom TypeScript commands using defineCommand()",
	rawScript: "Preserve leading whitespace in scripts (useful for here-docs)",
	logger: "Optional execution logging via BashLogger interface",
	trace: "Performance profiling via TraceCallback",
	commandFilter:
		"Restrict available commands via JUST_BASH_ALLOWED_COMMANDS env var",
	sandboxApi: "Vercel Sandbox compatible API via bash_sandbox_* tools",
} as const;
