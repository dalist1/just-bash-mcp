/**
 * Ambient type declarations for just-bash.
 *
 * The upstream just-bash v2.9.6 ships .d.ts files but its internal
 * re-exports use relative .js paths (e.g., "./Bash.js", "./fs/interface.js")
 * that don't resolve under moduleResolution: "nodenext" because the package
 * bundles everything into dist/bundle/index.js. TypeScript can't follow the
 * type chain from the barrel index.d.ts through to the leaf .d.ts files.
 *
 * This ambient module declaration provides complete types for all public
 * exports of just-bash v2.9.6, derived from the upstream .d.ts sources.
 * It should be updated when the upstream package is bumped.
 */

declare module "just-bash" {
	// ========================================================================
	// Trace types (from types.d.ts)
	// ========================================================================

	interface TraceEvent {
		category: string;
		name: string;
		durationMs: number;
		details?: Record<string, unknown>;
	}

	type TraceCallback = (event: TraceEvent) => void;

	// ========================================================================
	// Core result types (from types.d.ts)
	// ========================================================================

	interface ExecResult {
		stdout: string;
		stderr: string;
		exitCode: number;
		env?: Record<string, string>;
	}

	interface BashExecResult extends ExecResult {
		env: Record<string, string>;
	}

	interface FeatureCoverageWriter {
		hit(feature: string): void;
	}

	// ========================================================================
	// Filesystem types (from fs/interface.d.ts)
	// ========================================================================

	type BufferEncoding = "utf8" | "utf-8" | "ascii" | "binary" | "base64" | "hex" | "latin1";
	type FileContent = string | Uint8Array;

	interface ReadFileOptions {
		encoding?: BufferEncoding | null;
	}
	interface WriteFileOptions {
		encoding?: BufferEncoding;
	}

	interface FileEntry {
		type: "file";
		content: string | Uint8Array;
		mode: number;
		mtime: Date;
	}
	interface DirectoryEntry {
		type: "directory";
		mode: number;
		mtime: Date;
	}
	interface SymlinkEntry {
		type: "symlink";
		target: string;
		mode: number;
		mtime: Date;
	}
	type FsEntry = FileEntry | DirectoryEntry | SymlinkEntry;

	interface DirentEntry {
		name: string;
		isFile: boolean;
		isDirectory: boolean;
		isSymbolicLink: boolean;
	}
	interface FsStat {
		isFile: boolean;
		isDirectory: boolean;
		isSymbolicLink: boolean;
		mode: number;
		size: number;
		mtime: Date;
	}
	interface MkdirOptions {
		recursive?: boolean;
	}
	interface RmOptions {
		recursive?: boolean;
		force?: boolean;
	}
	interface CpOptions {
		recursive?: boolean;
	}

	interface IFileSystem {
		readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
		readFileBuffer(path: string): Promise<Uint8Array>;
		writeFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		appendFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FsStat>;
		mkdir(path: string, options?: MkdirOptions): Promise<void>;
		readdir(path: string): Promise<string[]>;
		readdirWithFileTypes?(path: string): Promise<DirentEntry[]>;
		rm(path: string, options?: RmOptions): Promise<void>;
		cp(src: string, dest: string, options?: CpOptions): Promise<void>;
		mv(src: string, dest: string): Promise<void>;
		resolvePath(base: string, path: string): string;
		getAllPaths(): string[];
		chmod(path: string, mode: number): Promise<void>;
		symlink(target: string, linkPath: string): Promise<void>;
		link(existingPath: string, newPath: string): Promise<void>;
		readlink(path: string): Promise<string>;
		lstat(path: string): Promise<FsStat>;
		realpath(path: string): Promise<string>;
		utimes(path: string, atime: Date, mtime: Date): Promise<void>;
	}

	interface FileInit {
		content: FileContent;
		mode?: number;
		mtime?: Date;
	}
	type InitialFiles = Record<string, FileContent | FileInit>;
	type FileSystemFactory = (initialFiles?: InitialFiles) => IFileSystem;

	// ========================================================================
	// Execution limits (from limits.d.ts)
	// ========================================================================

	interface ExecutionLimits {
		maxCallDepth?: number;
		maxCommandCount?: number;
		maxLoopIterations?: number;
		maxAwkIterations?: number;
		maxSedIterations?: number;
		maxJqIterations?: number;
		maxSqliteTimeoutMs?: number;
		maxPythonTimeoutMs?: number;
		maxGlobOperations?: number;
		maxStringLength?: number;
		maxArrayElements?: number;
		maxHeredocSize?: number;
		maxSubstitutionDepth?: number;
	}

	function resolveLimits(userLimits?: ExecutionLimits): Required<ExecutionLimits>;

	// ========================================================================
	// Command types (from types.d.ts)
	// ========================================================================

	interface CommandExecOptions {
		env?: Record<string, string>;
		cwd: string;
	}

	interface CommandContext {
		fs: IFileSystem;
		cwd: string;
		env: Map<string, string>;
		exportedEnv?: Record<string, string>;
		stdin: string;
		limits?: Required<ExecutionLimits>;
		trace?: TraceCallback;
		exec?: (command: string, options: CommandExecOptions) => Promise<ExecResult>;
		fetch?: SecureFetch;
		getRegisteredCommands?: () => string[];
		sleep?: (ms: number) => Promise<void>;
		fileDescriptors?: Map<number, string>;
		xpgEcho?: boolean;
		substitutionDepth?: number;
		coverage?: FeatureCoverageWriter;
	}

	interface Command {
		name: string;
		execute(args: string[], ctx: CommandContext): Promise<ExecResult>;
	}

	type CommandRegistry = Map<string, Command>;

	// ========================================================================
	// Command registry (from commands/registry.d.ts)
	// ========================================================================

	type CommandName =
		| "echo"
		| "cat"
		| "printf"
		| "ls"
		| "mkdir"
		| "rmdir"
		| "touch"
		| "rm"
		| "cp"
		| "mv"
		| "ln"
		| "chmod"
		| "pwd"
		| "readlink"
		| "head"
		| "tail"
		| "wc"
		| "stat"
		| "grep"
		| "fgrep"
		| "egrep"
		| "rg"
		| "sed"
		| "awk"
		| "sort"
		| "uniq"
		| "comm"
		| "cut"
		| "paste"
		| "tr"
		| "rev"
		| "nl"
		| "fold"
		| "expand"
		| "unexpand"
		| "strings"
		| "split"
		| "column"
		| "join"
		| "tee"
		| "find"
		| "basename"
		| "dirname"
		| "tree"
		| "du"
		| "env"
		| "printenv"
		| "alias"
		| "unalias"
		| "history"
		| "xargs"
		| "true"
		| "false"
		| "clear"
		| "bash"
		| "sh"
		| "jq"
		| "base64"
		| "diff"
		| "date"
		| "sleep"
		| "timeout"
		| "seq"
		| "expr"
		| "md5sum"
		| "sha1sum"
		| "sha256sum"
		| "file"
		| "html-to-markdown"
		| "help"
		| "which"
		| "tac"
		| "hostname"
		| "od"
		| "gzip"
		| "gunzip"
		| "zcat"
		| "tar"
		| "yq"
		| "xan"
		| "sqlite3"
		| "time"
		| "whoami";

	type NetworkCommandName = "curl";
	type PythonCommandName = "python3" | "python";
	type AllCommandName = CommandName | NetworkCommandName | PythonCommandName;

	function getCommandNames(): string[];
	function getNetworkCommandNames(): string[];
	function getPythonCommandNames(): string[];

	// ========================================================================
	// Network types (from network/types.d.ts)
	// ========================================================================

	type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

	interface NetworkConfig {
		allowedUrlPrefixes?: string[];
		allowedMethods?: HttpMethod[];
		dangerouslyAllowFullInternetAccess?: boolean;
		maxRedirects?: number;
		timeoutMs?: number;
		maxResponseSize?: number;
	}

	interface FetchResult {
		status: number;
		statusText: string;
		headers: Record<string, string>;
		body: string;
		url: string;
	}

	interface SecureFetchOptions {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
		followRedirects?: boolean;
		timeoutMs?: number;
	}

	type SecureFetch = (url: string, options?: SecureFetchOptions) => Promise<FetchResult>;

	function createSecureFetch(config: NetworkConfig): SecureFetch;

	class NetworkAccessDeniedError extends Error {
		constructor(url: string);
	}
	class TooManyRedirectsError extends Error {
		constructor(maxRedirects: number);
	}
	class RedirectNotAllowedError extends Error {
		constructor(url: string);
	}

	// ========================================================================
	// Custom commands (from custom-commands.d.ts)
	// ========================================================================

	type CustomCommand = Command | LazyCommand;

	interface LazyCommand {
		name: string;
		load: () => Promise<Command>;
	}

	function isLazyCommand(cmd: CustomCommand): cmd is LazyCommand;
	function defineCommand(
		name: string,
		execute: (args: string[], ctx: CommandContext) => Promise<ExecResult>,
	): Command;
	function createLazyCustomCommand(lazy: LazyCommand): Command;

	// ========================================================================
	// Bash class (from Bash.d.ts)
	// ========================================================================

	interface BashLogger {
		info(message: string, data?: Record<string, unknown>): void;
		debug(message: string, data?: Record<string, unknown>): void;
	}

	interface BashOptions {
		files?: InitialFiles;
		env?: Record<string, string>;
		cwd?: string;
		fs?: IFileSystem;
		executionLimits?: ExecutionLimits;
		/** @deprecated Use executionLimits.maxCallDepth instead */
		maxCallDepth?: number;
		/** @deprecated Use executionLimits.maxCommandCount instead */
		maxCommandCount?: number;
		/** @deprecated Use executionLimits.maxLoopIterations instead */
		maxLoopIterations?: number;
		network?: NetworkConfig;
		python?: boolean;
		commands?: CommandName[];
		sleep?: (ms: number) => Promise<void>;
		customCommands?: CustomCommand[];
		logger?: BashLogger;
		trace?: TraceCallback;
		defenseInDepth?: DefenseInDepthConfig | boolean;
		coverage?: FeatureCoverageWriter;
	}

	interface ExecOptions {
		env?: Record<string, string>;
		cwd?: string;
		rawScript?: boolean;
	}

	class Bash {
		readonly fs: IFileSystem;
		constructor(options?: BashOptions);
		registerCommand(command: Command): void;
		exec(commandLine: string, options?: ExecOptions): Promise<BashExecResult>;
		readFile(path: string): Promise<string>;
		writeFile(path: string, content: string): Promise<void>;
		getCwd(): string;
		getEnv(): Record<string, string>;
	}

	// ========================================================================
	// Filesystem implementations
	// ========================================================================

	class InMemoryFs implements IFileSystem {
		constructor(initialFiles?: InitialFiles);
		writeFileSync(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
			metadata?: { mode?: number; mtime?: Date },
		): void;
		mkdirSync(path: string, options?: MkdirOptions): void;
		readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
		readFileBuffer(path: string): Promise<Uint8Array>;
		writeFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		appendFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FsStat>;
		lstat(path: string): Promise<FsStat>;
		mkdir(path: string, options?: MkdirOptions): Promise<void>;
		readdir(path: string): Promise<string[]>;
		readdirWithFileTypes(path: string): Promise<DirentEntry[]>;
		rm(path: string, options?: RmOptions): Promise<void>;
		cp(src: string, dest: string, options?: CpOptions): Promise<void>;
		mv(src: string, dest: string): Promise<void>;
		getAllPaths(): string[];
		resolvePath(base: string, path: string): string;
		chmod(path: string, mode: number): Promise<void>;
		symlink(target: string, linkPath: string): Promise<void>;
		link(existingPath: string, newPath: string): Promise<void>;
		readlink(path: string): Promise<string>;
		realpath(path: string): Promise<string>;
		utimes(path: string, atime: Date, mtime: Date): Promise<void>;
	}

	interface OverlayFsOptions {
		root: string;
		mountPoint?: string;
		readOnly?: boolean;
		maxFileReadSize?: number;
	}

	class OverlayFs implements IFileSystem {
		constructor(options: OverlayFsOptions);
		getMountPoint(): string;
		mkdirSync(path: string, options?: MkdirOptions): void;
		writeFileSync(path: string, content: string | Uint8Array): void;
		readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
		readFileBuffer(path: string): Promise<Uint8Array>;
		writeFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		appendFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FsStat>;
		lstat(path: string): Promise<FsStat>;
		mkdir(path: string, options?: MkdirOptions): Promise<void>;
		readdir(path: string): Promise<string[]>;
		readdirWithFileTypes(path: string): Promise<DirentEntry[]>;
		rm(path: string, options?: RmOptions): Promise<void>;
		cp(src: string, dest: string, options?: CpOptions): Promise<void>;
		mv(src: string, dest: string): Promise<void>;
		resolvePath(base: string, path: string): string;
		getAllPaths(): string[];
		chmod(path: string, mode: number): Promise<void>;
		symlink(target: string, linkPath: string): Promise<void>;
		link(existingPath: string, newPath: string): Promise<void>;
		readlink(path: string): Promise<string>;
		realpath(path: string): Promise<string>;
		utimes(path: string, atime: Date, mtime: Date): Promise<void>;
	}

	interface ReadWriteFsOptions {
		root: string;
		maxFileReadSize?: number;
	}

	class ReadWriteFs implements IFileSystem {
		constructor(options: ReadWriteFsOptions);
		readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
		readFileBuffer(path: string): Promise<Uint8Array>;
		writeFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		appendFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FsStat>;
		lstat(path: string): Promise<FsStat>;
		mkdir(path: string, options?: MkdirOptions): Promise<void>;
		readdir(path: string): Promise<string[]>;
		readdirWithFileTypes(path: string): Promise<DirentEntry[]>;
		rm(path: string, options?: RmOptions): Promise<void>;
		cp(src: string, dest: string, options?: CpOptions): Promise<void>;
		mv(src: string, dest: string): Promise<void>;
		resolvePath(base: string, path: string): string;
		getAllPaths(): string[];
		chmod(path: string, mode: number): Promise<void>;
		symlink(target: string, linkPath: string): Promise<void>;
		link(existingPath: string, newPath: string): Promise<void>;
		readlink(path: string): Promise<string>;
		realpath(path: string): Promise<string>;
		utimes(path: string, atime: Date, mtime: Date): Promise<void>;
	}

	interface MountConfig {
		mountPoint: string;
		filesystem: IFileSystem;
	}

	interface MountableFsOptions {
		base?: IFileSystem;
		mounts?: MountConfig[];
	}

	class MountableFs implements IFileSystem {
		constructor(options?: MountableFsOptions);
		mount(mountPoint: string, filesystem: IFileSystem): void;
		unmount(mountPoint: string): void;
		getMounts(): ReadonlyArray<{ mountPoint: string; filesystem: IFileSystem }>;
		isMountPoint(path: string): boolean;
		readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string>;
		readFileBuffer(path: string): Promise<Uint8Array>;
		writeFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		appendFile(
			path: string,
			content: FileContent,
			options?: WriteFileOptions | BufferEncoding,
		): Promise<void>;
		exists(path: string): Promise<boolean>;
		stat(path: string): Promise<FsStat>;
		lstat(path: string): Promise<FsStat>;
		mkdir(path: string, options?: MkdirOptions): Promise<void>;
		readdir(path: string): Promise<string[]>;
		rm(path: string, options?: RmOptions): Promise<void>;
		cp(src: string, dest: string, options?: CpOptions): Promise<void>;
		mv(src: string, dest: string): Promise<void>;
		resolvePath(base: string, path: string): string;
		getAllPaths(): string[];
		chmod(path: string, mode: number): Promise<void>;
		symlink(target: string, linkPath: string): Promise<void>;
		link(existingPath: string, newPath: string): Promise<void>;
		readlink(path: string): Promise<string>;
		realpath(path: string): Promise<string>;
		utimes(path: string, atime: Date, mtime: Date): Promise<void>;
	}

	// ========================================================================
	// Sandbox (from sandbox/)
	// ========================================================================

	interface OutputMessage {
		type: "stdout" | "stderr";
		data: string;
		timestamp: Date;
	}

	class SandboxCommand {
		readonly cmdId: string;
		readonly cwd: string;
		readonly startedAt: Date;
		exitCode: number | undefined;
		logs(): AsyncGenerator<OutputMessage, void, unknown>;
		wait(): Promise<SandboxCommandFinished>;
		output(): Promise<string>;
		stdout(): Promise<string>;
		stderr(): Promise<string>;
		kill(): Promise<void>;
	}

	interface SandboxCommandFinished extends SandboxCommand {
		exitCode: number;
	}

	interface SandboxOptions {
		cwd?: string;
		env?: Record<string, string>;
		timeoutMs?: number;
		fs?: IFileSystem;
		overlayRoot?: string;
		maxCallDepth?: number;
		maxCommandCount?: number;
		maxLoopIterations?: number;
		network?: NetworkConfig;
	}

	interface WriteFilesInput {
		[path: string]:
			| string
			| {
					content: string;
					encoding?: "utf-8" | "base64";
			  };
	}

	class Sandbox {
		static create(opts?: SandboxOptions): Promise<Sandbox>;
		runCommand(
			cmd: string,
			opts?: { cwd?: string; env?: Record<string, string> },
		): Promise<SandboxCommand>;
		writeFiles(files: WriteFilesInput): Promise<void>;
		readFile(path: string, encoding?: "utf-8" | "base64"): Promise<string>;
		mkDir(path: string, opts?: { recursive?: boolean }): Promise<void>;
		stop(): Promise<void>;
		extendTimeout(ms: number): Promise<void>;
		get domain(): string | undefined;
		get bashEnvInstance(): Bash;
	}

	// ========================================================================
	// Security / Defense-in-Depth
	// ========================================================================

	type SecurityViolationType = string;

	interface SecurityViolation {
		type: SecurityViolationType;
		target: string;
		details: string;
	}

	interface DefenseInDepthConfig {
		enabled?: boolean;
		auditMode?: boolean;
		onViolation?: (violation: SecurityViolation) => void;
	}

	interface DefenseInDepthHandle {
		run<T>(fn: () => T): T;
		deactivate(): void;
		executionId: string;
	}

	interface DefenseInDepthStats {
		violationsBlocked: number;
		violations: SecurityViolation[];
		activeTimeMs: number;
		refCount: number;
	}

	class DefenseInDepthBox {
		constructor(config: DefenseInDepthConfig);
		updateConfig(config: DefenseInDepthConfig): void;
		activate(): DefenseInDepthHandle;
		forceDeactivate(): void;
		isActive(): boolean;
		getStats(): DefenseInDepthStats;
		clearViolations(): void;
	}

	class SecurityViolationError extends Error {
		violation: SecurityViolation;
		name: "SecurityViolationError";
		constructor(message: string);
	}

	class SecurityViolationLogger {
		constructor();
		record(violation: SecurityViolation): void;
		getViolations(): SecurityViolation[];
		getViolationsByType(type: SecurityViolationType): SecurityViolation[];
		getSummary(): Array<{ type: string; count: number }>;
		getTotalCount(): number;
		hasViolations(): boolean;
		clear(): void;
		createCallback(): (violation: SecurityViolation) => void;
	}

	function createConsoleViolationCallback(): (violation: SecurityViolation) => void;
}
