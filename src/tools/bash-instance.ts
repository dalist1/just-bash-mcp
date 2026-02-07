/**
 * Bash instance management
 * Handles creation and lifecycle of Bash instances
 */

import {
	Bash,
	type BashOptions,
	type CustomCommand,
	InMemoryFs,
	MountableFs,
	OverlayFs,
	ReadWriteFs,
	Sandbox,
	type SandboxOptions,
} from "just-bash";

import {
	bashLogger,
	buildExecutionLimits,
	buildNetworkConfig,
	config,
	parseMountsConfig,
	traceCallback,
} from "../config/index.ts";

// ============================================================================
// Bash Instance Factory
// ============================================================================

/**
 * Create a new Bash instance with the given configuration
 */
export function createBashInstance(
	files?: Record<string, string>,
	customCommands?: CustomCommand[],
	env?: Record<string, string>,
): Bash {
	const networkConfig = buildNetworkConfig();
	const executionLimits = buildExecutionLimits();

	const baseOptions: BashOptions = {
		network: networkConfig,
		executionLimits,
		files,
		env,
		logger: bashLogger,
		trace: traceCallback,
		customCommands,
		commands: config.ALLOWED_COMMANDS,
		python: config.ENABLE_PYTHON,
		defenseInDepth: config.ENABLE_DEFENSE_IN_DEPTH,
	};

	// Check for mountable filesystem configuration
	const mounts = parseMountsConfig();
	if (mounts.length > 0) {
		const mountableFs = new MountableFs({
			base: new InMemoryFs(),
			mounts,
		});
		return new Bash({
			...baseOptions,
			fs: mountableFs,
			cwd: config.INITIAL_CWD,
		});
	}

	// Check for read-write filesystem configuration
	if (config.READ_WRITE_ROOT) {
		const rwfs = new ReadWriteFs({
			root: config.READ_WRITE_ROOT,
			...(config.MAX_FILE_READ_SIZE !== undefined && {
				maxFileReadSize: config.MAX_FILE_READ_SIZE,
			}),
		});
		return new Bash({
			...baseOptions,
			fs: rwfs,
			cwd: config.READ_WRITE_ROOT,
		});
	}

	// Check for overlay filesystem configuration
	if (config.OVERLAY_ROOT) {
		const overlay = new OverlayFs({
			root: config.OVERLAY_ROOT,
			readOnly: config.OVERLAY_READ_ONLY,
			...(config.MAX_FILE_READ_SIZE !== undefined && {
				maxFileReadSize: config.MAX_FILE_READ_SIZE,
			}),
		});
		return new Bash({
			...baseOptions,
			fs: overlay,
			cwd: overlay.getMountPoint(),
		});
	}

	// Default: in-memory filesystem
	return new Bash({
		...baseOptions,
		cwd: config.INITIAL_CWD,
	});
}

// ============================================================================
// Persistent Bash Instance (singleton pattern)
// ============================================================================

let persistentBash: Bash | null = null;

/**
 * Get or create the persistent Bash instance
 */
export function getPersistentBash(): Bash {
	if (!persistentBash) {
		persistentBash = createBashInstance();
	}
	return persistentBash;
}

/**
 * Reset the persistent Bash instance
 */
export function resetPersistentBash(): void {
	persistentBash = null;
}

// ============================================================================
// Persistent Sandbox Instance (singleton pattern)
// ============================================================================

let persistentSandbox: Sandbox | null = null;

/**
 * Get or create the persistent Sandbox instance
 */
export async function getPersistentSandbox(): Promise<Sandbox> {
	if (!persistentSandbox) {
		const networkConfig = buildNetworkConfig();
		const options: SandboxOptions = {
			cwd: config.INITIAL_CWD,
			network: networkConfig,
			maxCallDepth: config.MAX_CALL_DEPTH,
			maxCommandCount: config.MAX_COMMAND_COUNT,
			maxLoopIterations: config.MAX_LOOP_ITERATIONS,
			...(config.OVERLAY_ROOT && { overlayRoot: config.OVERLAY_ROOT }),
		};
		persistentSandbox = await Sandbox.create(options);
	}
	return persistentSandbox;
}

/**
 * Reset the persistent Sandbox instance
 */
export function resetPersistentSandbox(): void {
	persistentSandbox = null;
}
