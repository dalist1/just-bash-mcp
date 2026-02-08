/**
 * Re-export all upstream just-bash types for downstream consumers.
 *
 * This barrel module provides a single import point for all types from
 * the just-bash package, so consumers of just-bash-mcp don't need to
 * depend on just-bash directly.
 *
 * Covers the full upstream API surface:
 * - Core: Bash, BashOptions, ExecOptions, BashExecResult, ExecResult
 * - Commands: CommandName, AllCommandName, NetworkCommandName, PythonCommandName
 * - Custom commands: CustomCommand, LazyCommand, defineCommand, Command, CommandContext
 * - Filesystem: IFileSystem, InMemoryFs, OverlayFs, ReadWriteFs, MountableFs + all types
 * - Network: NetworkConfig, error classes
 * - Sandbox: Sandbox, SandboxCommand, SandboxOptions, OutputMessage, WriteFilesInput
 * - Security: DefenseInDepthBox, SecurityViolationLogger, SecurityViolationError + types
 * - Trace: TraceEvent, TraceCallback
 */

// ============================================================================
// Core
// ============================================================================
export type { BashLogger, BashOptions, ExecOptions, ExecutionLimits } from "just-bash";
export { Bash } from "just-bash";

// ============================================================================
// Result types
// ============================================================================
export type { BashExecResult, Command, CommandContext, ExecResult, IFileSystem } from "just-bash";

// ============================================================================
// Trace types (from upstream, not locally redefined)
// ============================================================================
export type { TraceCallback, TraceEvent } from "just-bash";

// ============================================================================
// Command registry
// ============================================================================
export type { AllCommandName, CommandName, NetworkCommandName, PythonCommandName } from "just-bash";
export { getCommandNames, getNetworkCommandNames, getPythonCommandNames } from "just-bash";

// ============================================================================
// Custom commands
// ============================================================================
export type { CustomCommand, LazyCommand } from "just-bash";
export { defineCommand } from "just-bash";

// ============================================================================
// Filesystem types
// ============================================================================
export type {
	BufferEncoding,
	CpOptions,
	DirectoryEntry,
	FileContent,
	FileEntry,
	FileInit,
	FileSystemFactory,
	FsEntry,
	FsStat,
	InitialFiles,
	MkdirOptions,
	MountableFsOptions,
	MountConfig,
	OverlayFsOptions,
	ReadWriteFsOptions,
	RmOptions,
	SymlinkEntry,
} from "just-bash";

// ============================================================================
// Filesystem implementations
// ============================================================================
export { InMemoryFs, MountableFs, OverlayFs, ReadWriteFs } from "just-bash";

// ============================================================================
// Network
// ============================================================================
export type { NetworkConfig } from "just-bash";
export {
	NetworkAccessDeniedError,
	RedirectNotAllowedError,
	TooManyRedirectsError,
} from "just-bash";

// ============================================================================
// Sandbox (Vercel Sandbox compatible API)
// ============================================================================
export type {
	OutputMessage,
	SandboxCommandFinished,
	SandboxOptions,
	WriteFilesInput,
} from "just-bash";
export { Sandbox, SandboxCommand } from "just-bash";

// ============================================================================
// Security / Defense-in-Depth
// ============================================================================
export type {
	DefenseInDepthConfig,
	DefenseInDepthHandle,
	DefenseInDepthStats,
	SecurityViolation,
	SecurityViolationType,
} from "just-bash";
export {
	createConsoleViolationCallback,
	DefenseInDepthBox,
	SecurityViolationError,
	SecurityViolationLogger,
} from "just-bash";
