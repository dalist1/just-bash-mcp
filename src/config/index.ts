/**
 * Configuration module for just-bash-mcp
 * Handles environment variable parsing and configuration building
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type BashLogger,
	type BashOptions,
	type CommandName,
	type DefenseInDepthConfig,
	type MountConfig,
	type NetworkConfig,
	OverlayFs,
	ReadWriteFs,
	SecurityViolationLogger,
	createConsoleViolationCallback,
} from "just-bash";

// Re-export upstream types used by other modules
export type { DefenseInDepthConfig };

export interface TraceEvent {
	category: string;
	name: string;
	durationMs: number;
	details?: Record<string, unknown>;
}

export type TraceCallback = (event: TraceEvent) => void;

// ============================================================================
// Types
// ============================================================================

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

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
	readonly MAX_RESPONSE_SIZE: number | undefined;
	readonly MAX_CALL_DEPTH: number;
	readonly MAX_COMMAND_COUNT: number;
	readonly MAX_LOOP_ITERATIONS: number;
	readonly MAX_AWK_ITERATIONS: number;
	readonly MAX_SED_ITERATIONS: number;
	readonly MAX_JQ_ITERATIONS: number;
	readonly MAX_GLOB_OPERATIONS: number;
	readonly MAX_STRING_LENGTH: number;
	readonly MAX_ARRAY_ELEMENTS: number;
	readonly MAX_HEREDOC_SIZE: number;
	readonly MAX_SUBSTITUTION_DEPTH: number;
	readonly MAX_SQLITE_TIMEOUT_MS: number;
	readonly MAX_PYTHON_TIMEOUT_MS: number;
	readonly MAX_OUTPUT_LENGTH: number;
	readonly MAX_FILE_READ_SIZE: number | undefined;
	readonly ENABLE_LOGGING: boolean;
	readonly ENABLE_TRACING: boolean;
	readonly ENABLE_PYTHON: boolean;
	readonly ENABLE_DEFENSE_IN_DEPTH: boolean;
	readonly DEFENSE_IN_DEPTH_AUDIT: boolean;
	readonly DEFENSE_IN_DEPTH_LOG: boolean;
	readonly OVERLAY_READ_ONLY: boolean;
	readonly ALLOWED_COMMANDS: CommandName[] | undefined;
}

function readPackageVersion(relativePath: string): string {
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packagePath = join(__dirname, relativePath);
		const packageJson = JSON.parse(readFileSync(packagePath, "utf-8")) as { version?: string };
		return packageJson.version || "unknown";
	} catch {
		return "unknown";
	}
}

export const WRAPPER_VERSION = readPackageVersion("../../package.json");
export const UPSTREAM_JUST_BASH_VERSION = readPackageVersion(
	"../../node_modules/just-bash/package.json",
);

function getAllowedMethods(): HttpMethod[] {
	const methods = parseEnvStringArray("JUST_BASH_ALLOWED_METHODS");
	return methods.length > 0 ? (methods as HttpMethod[]) : ["GET", "HEAD"];
}

function getAllowedCommands(): CommandName[] | undefined {
	const commands = parseEnvStringArray("JUST_BASH_ALLOWED_COMMANDS");
	return commands.length > 0 ? (commands as CommandName[]) : undefined;
}

function parseEnvOptionalInt(key: string): number | undefined {
	const value = process.env[key];
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export const config: Config = {
	// Server info
	VERSION: WRAPPER_VERSION,
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
	MAX_RESPONSE_SIZE: parseEnvOptionalInt("JUST_BASH_MAX_RESPONSE_SIZE"),

	// Execution limits
	MAX_CALL_DEPTH: parseEnvInt("JUST_BASH_MAX_CALL_DEPTH", 100),
	MAX_COMMAND_COUNT: parseEnvInt("JUST_BASH_MAX_COMMAND_COUNT", 10000),
	MAX_LOOP_ITERATIONS: parseEnvInt("JUST_BASH_MAX_LOOP_ITERATIONS", 10000),
	MAX_AWK_ITERATIONS: parseEnvInt("JUST_BASH_MAX_AWK_ITERATIONS", 10000),
	MAX_SED_ITERATIONS: parseEnvInt("JUST_BASH_MAX_SED_ITERATIONS", 10000),
	MAX_JQ_ITERATIONS: parseEnvInt("JUST_BASH_MAX_JQ_ITERATIONS", 10000),
	MAX_GLOB_OPERATIONS: parseEnvInt("JUST_BASH_MAX_GLOB_OPERATIONS", 100000),
	MAX_STRING_LENGTH: parseEnvInt("JUST_BASH_MAX_STRING_LENGTH", 10485760),
	MAX_ARRAY_ELEMENTS: parseEnvInt("JUST_BASH_MAX_ARRAY_ELEMENTS", 100000),
	MAX_HEREDOC_SIZE: parseEnvInt("JUST_BASH_MAX_HEREDOC_SIZE", 10485760),
	MAX_SUBSTITUTION_DEPTH: parseEnvInt("JUST_BASH_MAX_SUBSTITUTION_DEPTH", 50),
	MAX_SQLITE_TIMEOUT_MS: parseEnvInt("JUST_BASH_MAX_SQLITE_TIMEOUT_MS", 5000),
	MAX_PYTHON_TIMEOUT_MS: parseEnvInt("JUST_BASH_MAX_PYTHON_TIMEOUT_MS", 30000),

	// Output limits
	MAX_OUTPUT_LENGTH: parseEnvInt("JUST_BASH_MAX_OUTPUT_LENGTH", 30000),

	// Filesystem limits
	MAX_FILE_READ_SIZE: parseEnvOptionalInt("JUST_BASH_MAX_FILE_READ_SIZE"),

	// Debugging
	ENABLE_LOGGING: parseEnvBoolean("JUST_BASH_ENABLE_LOGGING", false),
	ENABLE_TRACING: parseEnvBoolean("JUST_BASH_ENABLE_TRACING", false),

	// Feature flags
	ENABLE_PYTHON: parseEnvBoolean("JUST_BASH_ENABLE_PYTHON", false),
	ENABLE_DEFENSE_IN_DEPTH: parseEnvBoolean("JUST_BASH_DEFENSE_IN_DEPTH", false),
	DEFENSE_IN_DEPTH_AUDIT: parseEnvBoolean("JUST_BASH_DEFENSE_IN_DEPTH_AUDIT", false),
	DEFENSE_IN_DEPTH_LOG: parseEnvBoolean("JUST_BASH_DEFENSE_IN_DEPTH_LOG", false),
	OVERLAY_READ_ONLY: parseEnvBoolean("JUST_BASH_OVERLAY_READ_ONLY", false),

	// Command filtering
	ALLOWED_COMMANDS: getAllowedCommands(),
};

// ============================================================================
// Logger and Trace Callback
// ============================================================================

export const bashLogger: BashLogger | undefined = config.ENABLE_LOGGING
	? {
			info(message: string, data?: Record<string, unknown>): void {
				if (data) {
					console.error(`[just-bash] INFO: ${message}`, data);
				} else {
					console.error(`[just-bash] INFO: ${message}`);
				}
			},
			debug(message: string, data?: Record<string, unknown>): void {
				if (data) {
					console.error(`[just-bash] DEBUG: ${message}`, data);
				} else {
					console.error(`[just-bash] DEBUG: ${message}`);
				}
			},
		}
	: undefined;

export const traceCallback: BashOptions["trace"] = config.ENABLE_TRACING
	? (event: TraceEvent) => {
			if (event.details) {
				console.error(
					`[just-bash] TRACE: ${event.category}/${event.name} ${event.durationMs}ms`,
					JSON.stringify(event.details),
				);
			} else {
				console.error(`[just-bash] TRACE: ${event.category}/${event.name} ${event.durationMs}ms`);
			}
		}
	: undefined;

// ============================================================================
// Defense-in-Depth Configuration
// ============================================================================

/**
 * Shared SecurityViolationLogger instance for tracking violations across
 * all Bash instances. Exposed so info-tools can report violation stats.
 */
export const violationLogger = new SecurityViolationLogger();

/**
 * Build the defense-in-depth configuration from environment variables.
 * Returns `false` when disabled, or a full DefenseInDepthConfig object.
 */
export function buildDefenseInDepthConfig(): DefenseInDepthConfig | false {
	if (!config.ENABLE_DEFENSE_IN_DEPTH) {
		return false;
	}

	const consoleCallback = config.DEFENSE_IN_DEPTH_LOG
		? createConsoleViolationCallback()
		: undefined;

	return {
		enabled: true,
		auditMode: config.DEFENSE_IN_DEPTH_AUDIT,
		onViolation: (violation: { type: string; target: string; details: string }) => {
			violationLogger.record(violation);
			consoleCallback?.(violation);
		},
	};
}

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
			...(config.MAX_RESPONSE_SIZE !== undefined && {
				maxResponseSize: config.MAX_RESPONSE_SIZE,
			}),
		};
	}

	return {
		dangerouslyAllowFullInternetAccess: true,
		maxRedirects: config.MAX_REDIRECTS,
		timeoutMs: config.NETWORK_TIMEOUT_MS,
		...(config.MAX_RESPONSE_SIZE !== undefined && {
			maxResponseSize: config.MAX_RESPONSE_SIZE,
		}),
	};
}

export function buildExecutionLimits(): NonNullable<BashOptions["executionLimits"]> {
	return {
		maxCallDepth: config.MAX_CALL_DEPTH,
		maxCommandCount: config.MAX_COMMAND_COUNT,
		maxLoopIterations: config.MAX_LOOP_ITERATIONS,
		maxAwkIterations: config.MAX_AWK_ITERATIONS,
		maxSedIterations: config.MAX_SED_ITERATIONS,
		maxJqIterations: config.MAX_JQ_ITERATIONS,
		maxGlobOperations: config.MAX_GLOB_OPERATIONS,
		maxStringLength: config.MAX_STRING_LENGTH,
		maxArrayElements: config.MAX_ARRAY_ELEMENTS,
		maxHeredocSize: config.MAX_HEREDOC_SIZE,
		maxSubstitutionDepth: config.MAX_SUBSTITUTION_DEPTH,
		maxSqliteTimeoutMs: config.MAX_SQLITE_TIMEOUT_MS,
		maxPythonTimeoutMs: config.MAX_PYTHON_TIMEOUT_MS,
	};
}

export function parseMountsConfig(): MountConfig[] {
	if (!config.MOUNTS_CONFIG) return [];
	try {
		const parsed: unknown = JSON.parse(config.MOUNTS_CONFIG);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(
			(mount: { mountPoint: string; root: string; type?: string; readOnly?: boolean }) => {
				const fsType = mount.type || "overlay";
				const maxFileReadSize = config.MAX_FILE_READ_SIZE;
				const filesystem =
					fsType === "readwrite"
						? new ReadWriteFs({
								root: mount.root,
								...(maxFileReadSize !== undefined && { maxFileReadSize }),
							})
						: new OverlayFs({
								root: mount.root,
								readOnly: mount.readOnly,
								...(maxFileReadSize !== undefined && { maxFileReadSize }),
							});
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
	JUST_BASH_OVERLAY_ROOT: "Real directory to mount as overlay (read from disk, write to memory)",
	JUST_BASH_OVERLAY_READ_ONLY:
		"If true, all writes to overlay filesystem throw errors (default: false)",
	JUST_BASH_READ_WRITE_ROOT: "Real directory with read-write access",
	JUST_BASH_MOUNTS: "JSON array of mount configurations (supports type, readOnly fields)",
	JUST_BASH_CWD: "Initial working directory (default: /home/user)",
	JUST_BASH_ALLOW_NETWORK: "Enable network access (default: false)",
	JUST_BASH_ALLOWED_URLS: "Comma-separated URL prefixes to allow",
	JUST_BASH_ALLOWED_METHODS: "Comma-separated HTTP methods (default: GET,HEAD)",
	JUST_BASH_ALLOWED_COMMANDS: "Comma-separated list of allowed commands",
	JUST_BASH_MAX_REDIRECTS: "Max HTTP redirects (default: 20)",
	JUST_BASH_NETWORK_TIMEOUT_MS: "Network timeout in ms (default: 30000)",
	JUST_BASH_MAX_RESPONSE_SIZE: "Max network response body size in bytes (default: 10MB)",
	JUST_BASH_MAX_CALL_DEPTH: "Max recursion depth (default: 100)",
	JUST_BASH_MAX_COMMAND_COUNT: "Max commands per execution (default: 10000)",
	JUST_BASH_MAX_LOOP_ITERATIONS: "Max bash loop iterations (default: 10000)",
	JUST_BASH_MAX_AWK_ITERATIONS: "Max AWK while/for loop iterations (default: 10000)",
	JUST_BASH_MAX_SED_ITERATIONS: "Max sed branch loop iterations (default: 10000)",
	JUST_BASH_MAX_JQ_ITERATIONS: "Max jq loop iterations (default: 10000)",
	JUST_BASH_MAX_GLOB_OPERATIONS: "Max glob filesystem operations (default: 100000)",
	JUST_BASH_MAX_STRING_LENGTH: "Max string length in bytes (default: 10485760 = 10MB)",
	JUST_BASH_MAX_ARRAY_ELEMENTS: "Max array elements (default: 100000)",
	JUST_BASH_MAX_HEREDOC_SIZE: "Max heredoc size in bytes (default: 10485760 = 10MB)",
	JUST_BASH_MAX_SUBSTITUTION_DEPTH: "Max command substitution nesting depth (default: 50)",
	JUST_BASH_MAX_SQLITE_TIMEOUT_MS: "SQLite timeout in ms (default: 5000)",
	JUST_BASH_MAX_PYTHON_TIMEOUT_MS: "Python timeout in ms (default: 30000)",
	JUST_BASH_MAX_OUTPUT_LENGTH: "Max output length (default: 30000)",
	JUST_BASH_MAX_FILE_READ_SIZE:
		"Max file read size in bytes for OverlayFs/ReadWriteFs (default: 10MB)",
	JUST_BASH_ENABLE_LOGGING: "Enable debug logging (default: false)",
	JUST_BASH_ENABLE_TRACING: "Enable performance tracing (default: false)",
	JUST_BASH_ENABLE_PYTHON: "Enable python3/python commands via Pyodide (default: false)",
	JUST_BASH_DEFENSE_IN_DEPTH:
		"Enable defense-in-depth mode that patches dangerous JS globals (default: false)",
	JUST_BASH_DEFENSE_IN_DEPTH_AUDIT:
		"Audit mode: log violations but don't block them (default: false, requires DEFENSE_IN_DEPTH=true)",
	JUST_BASH_DEFENSE_IN_DEPTH_LOG:
		"Log violations to console via createConsoleViolationCallback (default: false)",
} as const;

// ============================================================================
// Command Categories Documentation
// ============================================================================

export const COMMAND_CATEGORIES = {
	fileOperations: "cat, cp, file, ln, ls, mkdir, mv, readlink, rm, rmdir, split, stat, touch, tree",
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
	customCommands:
		"Define custom TypeScript commands using defineCommand() from just-bash, supports lazy-loading via LazyCommand",
	rawScript: "Preserve leading whitespace in scripts (useful for here-docs)",
	logger: "Optional execution logging via BashLogger interface",
	trace: "Performance profiling via TraceCallback (upstream type)",
	commandFilter: "Restrict available commands via JUST_BASH_ALLOWED_COMMANDS env var",
	sandboxApi:
		"Vercel Sandbox compatible API via bash_sandbox_* tools (run, write, read, mkdir, stop, reset)",
	python: "Python support via Pyodide (opt-in via JUST_BASH_ENABLE_PYTHON=true)",
	defenseInDepth:
		"Defense-in-depth with SecurityViolationLogger, audit mode, and console logging (opt-in via JUST_BASH_DEFENSE_IN_DEPTH=true)",
	overlayReadOnly:
		"Read-only overlay filesystem mode (opt-in via JUST_BASH_OVERLAY_READ_ONLY=true)",
	networkResponseSize:
		"Configurable max network response body size via JUST_BASH_MAX_RESPONSE_SIZE",
	fileReadSizeLimit:
		"Configurable max file read size for OverlayFs/ReadWriteFs via JUST_BASH_MAX_FILE_READ_SIZE",
	networkErrorHandling:
		"Rich network error classification: NetworkAccessDeniedError, TooManyRedirectsError, RedirectNotAllowedError",
	securityViolationTracking:
		"SecurityViolationLogger tracks all defense-in-depth violations with stats via bash_info",
} as const;
