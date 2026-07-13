/**
 * Bash instance management
 * Handles creation and lifecycle of Bash instances
 *
 * Uses all upstream just-bash APIs:
 * - Bash and Sandbox for execution
 * - DefenseInDepthBox with SecurityViolationLogger for security monitoring
 * - defineCommand for custom command registration
 * - All filesystem variants (InMemoryFs, MountableFs, OverlayFs, ReadWriteFs)
 * - Network error classes for rich error reporting (handled in exec-tools/sandbox-tools)
 */

import {Bash, type BashOptions, type CustomCommand, DefenseInDepthBox as UpstreamDefenseInDepthBox, InMemoryFs, type InitialFiles, MountableFs, OverlayFs, ReadWriteFs, Sandbox, type SandboxOptions, defineCommand} from 'just-bash'
import {bashLogger, buildDefenseInDepthConfig, buildExecutionLimits, buildJavaScriptConfig, buildNetworkConfig, config, type DefenseInDepthConfig, type DefenseInDepthStats, parseMountsConfig, traceCallback, violationLogger} from '../config/index.js'

// ============================================================================
// Bash Instance Factory
// ============================================================================

// ============================================================================
// Defense-in-Depth Box (singleton)
// ============================================================================

interface DefenseInDepthBoxInstance {
 isActive(): boolean
 getStats(): DefenseInDepthStats
}

const DefenseInDepthBox = UpstreamDefenseInDepthBox as unknown as {getInstance(config?: DefenseInDepthConfig | boolean): DefenseInDepthBoxInstance}

let defenseInDepthBox: DefenseInDepthBoxInstance | null = null

/**
 * Get or create the shared DefenseInDepthBox instance.
 * Returns null if defense-in-depth is disabled.
 */
export function getDefenseInDepthBox(): DefenseInDepthBoxInstance | null {
 const didConfig = buildDefenseInDepthConfig()
 if (!didConfig) return null

 if (!defenseInDepthBox) {
  defenseInDepthBox = DefenseInDepthBox.getInstance(didConfig)
 }
 return defenseInDepthBox
}

/**
 * Get the shared SecurityViolationLogger for querying violation stats.
 */
export {violationLogger} from '../config/index.js'

/**
 * Re-export defineCommand so downstream consumers can create custom commands
 * using the upstream API without importing just-bash directly.
 */
export {defineCommand}

// ============================================================================
// Bash Instance Factory
// ============================================================================

/**
 * Create a new Bash instance with the given configuration
 */
export function createBashInstance(files?: InitialFiles, customCommands?: CustomCommand[], env?: Record<string, string>): Bash {
 const networkConfig = buildNetworkConfig()
 const executionLimits = buildExecutionLimits()
 const defenseInDepthConfig = buildDefenseInDepthConfig()
 const javascriptConfig = buildJavaScriptConfig()
 const initialEnv = config.INITIAL_ENV || env ? {...(config.INITIAL_ENV ?? {}), ...(env ?? {})} : undefined

 const baseOptions: BashOptions = {
  network: networkConfig,
  executionLimits,
  files,
  env: initialEnv,
  logger: bashLogger,
  trace: traceCallback,
  customCommands,
  commands: config.ALLOWED_COMMANDS,
  python: config.ENABLE_PYTHON,
  javascript: javascriptConfig,
  defenseInDepth: defenseInDepthConfig,
  processInfo: config.PROCESS_INFO
 }

 // Check for mountable filesystem configuration
 const mounts = parseMountsConfig()
 if (mounts.length > 0) {
  const mountableFs = new MountableFs({base: new InMemoryFs(), mounts})
  return new Bash({...baseOptions, fs: mountableFs, cwd: config.INITIAL_CWD})
 }

 // Check for read-write filesystem configuration
 if (config.READ_WRITE_ROOT) {
  const rwfs = new ReadWriteFs({root: config.READ_WRITE_ROOT, ...(config.MAX_FILE_READ_SIZE !== undefined && {maxFileReadSize: config.MAX_FILE_READ_SIZE})})
  return new Bash({...baseOptions, fs: rwfs, cwd: config.READ_WRITE_ROOT})
 }

 // Check for overlay filesystem configuration
 if (config.OVERLAY_ROOT) {
  const overlay = new OverlayFs({root: config.OVERLAY_ROOT, readOnly: config.OVERLAY_READ_ONLY, ...(config.MAX_FILE_READ_SIZE !== undefined && {maxFileReadSize: config.MAX_FILE_READ_SIZE})})
  return new Bash({...baseOptions, fs: overlay, cwd: overlay.getMountPoint()})
 }

 // Default: in-memory filesystem
 return new Bash({...baseOptions, cwd: config.INITIAL_CWD})
}

// ============================================================================
// Persistent Bash Instance (singleton pattern)
// ============================================================================

let persistentBash: Bash | null = null

/**
 * Get or create the persistent Bash instance
 */
export function getPersistentBash(): Bash {
 if (!persistentBash) {
  persistentBash = createBashInstance()
 }
 return persistentBash
}

/**
 * Reset the persistent Bash instance
 */
export function resetPersistentBash(): void {
 persistentBash = null
}

// ============================================================================
// Persistent Sandbox Instance (singleton pattern)
// ============================================================================

let persistentSandbox: Sandbox | null = null

/**
 * Get or create the persistent Sandbox instance.
 * Passes all available configuration including network and filesystem options.
 */
export async function getPersistentSandbox(): Promise<Sandbox> {
 if (!persistentSandbox) {
  const networkConfig = buildNetworkConfig()
  const defenseInDepthConfig = buildDefenseInDepthConfig()
  const javascriptConfig = buildJavaScriptConfig()
  const options: SandboxOptions = {
   cwd: config.INITIAL_CWD,
   env: config.INITIAL_ENV,
   network: networkConfig,
   maxCallDepth: config.MAX_CALL_DEPTH,
   maxCommandCount: config.MAX_COMMAND_COUNT,
   maxLoopIterations: config.MAX_LOOP_ITERATIONS,
   defenseInDepth: defenseInDepthConfig,
   python: config.ENABLE_PYTHON,
   javascript: javascriptConfig,
   commands: config.ALLOWED_COMMANDS,
   timeoutMs: config.SANDBOX_TIMEOUT_MS,
   ...(config.OVERLAY_ROOT && {overlayRoot: config.OVERLAY_ROOT})
  }
  persistentSandbox = await Sandbox.create(options)
 }
 return persistentSandbox
}

/**
 * Reset the persistent Sandbox instance.
 * Calls Sandbox.stop() to clean up resources before releasing.
 */
export async function resetPersistentSandbox(): Promise<void> {
 if (persistentSandbox) {
  await persistentSandbox.stop()
 }
 persistentSandbox = null
}
