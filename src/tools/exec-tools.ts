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

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {type Bash, type InitialFiles, NetworkAccessDeniedError, RedirectNotAllowedError, SecurityViolationError, TooManyRedirectsError} from 'just-bash'
import {z} from 'zod/v4'
import {createErrorResponse, decodeBase64, formatExecResult} from '../utils/index.js'
import {createBashInstance, getPersistentBash, resetPersistentBash} from './bash-instance.js'

interface ToolExecOptions {
 cwd?: string
 env?: Record<string, string>
 replaceEnv?: boolean
 stdin?: string
 stdinBase64?: string
 stdinKind?: 'text' | 'bytes'
 args?: string[]
 rawScript?: boolean
 timeoutMs?: number
}

type InitialFileInput = string | {content: string; encoding?: 'utf-8' | 'base64'; mode?: number; mtime?: string}

const initialFileSchema = z.union([z.string(), z.object({content: z.string(), encoding: z.enum(['utf-8', 'base64']).optional(), mode: z.number().int().nonnegative().optional(), mtime: z.string().datetime().optional()})])

const execOptionSchema = {
 cwd: z.string().optional().describe('Working directory for the command'),
 env: z.record(z.string(), z.string()).optional().describe('Environment variables to set for this execution'),
 replaceEnv: z.boolean().optional().describe('Start with an empty environment instead of merging env with the initial environment'),
 stdin: z.string().optional().describe('Standard input to pass to the script'),
 stdinBase64: z.string().optional().describe('Base64-encoded stdin. When set, stdinKind is forced to bytes and stdin is ignored'),
 stdinKind: z.enum(['text', 'bytes']).optional().describe('How stdin is encoded: text UTF-8 encodes the string; bytes forwards a latin1-shaped byte buffer verbatim'),
 args: z.array(z.string()).optional().describe('Additional argv entries appended to the first command without shell parsing'),
 rawScript: z.boolean().optional().describe('If true, skip normalizing the script (preserves leading whitespace). Useful for here-docs.'),
 timeoutMs: z.number().int().positive().optional().describe('Cooperatively abort execution after this many milliseconds')
} as const

async function execWithOptions(bash: Bash, command: string, options: ToolExecOptions = {}) {
 const {timeoutMs, stdinBase64, ...execOptions} = options
 const resolvedOptions = stdinBase64 === undefined ? execOptions : {...execOptions, stdin: decodeBase64(stdinBase64).toString('latin1'), stdinKind: 'bytes' as const}
 if (!timeoutMs) {
  return bash.exec(command, resolvedOptions)
 }

 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 try {
  return await bash.exec(command, {...resolvedOptions, signal: controller.signal})
 } finally {
  clearTimeout(timeout)
 }
}

function normalizeInitialFiles(files: Record<string, InitialFileInput> | undefined): InitialFiles | undefined {
 if (!files) return undefined
 const normalized: InitialFiles = {}
 for (const [path, value] of Object.entries(files)) {
  if (typeof value === 'string') {
   normalized[path] = value
   continue
  }

  normalized[path] = {content: value.encoding === 'base64' ? decodeBase64(value.content) : value.content, ...(value.mode !== undefined && {mode: value.mode}), ...(value.mtime && {mtime: new Date(value.mtime)})}
 }
 return normalized
}

/**
 * Classify errors from just-bash into user-friendly messages.
 * Uses upstream error classes for precise classification.
 */
function classifyError(error: unknown, prefix: string) {
 if (error instanceof NetworkAccessDeniedError) {
  return createErrorResponse(error, `${prefix} [Network Access Denied]`)
 }
 if (error instanceof TooManyRedirectsError) {
  return createErrorResponse(error, `${prefix} [Too Many Redirects]`)
 }
 if (error instanceof RedirectNotAllowedError) {
  return createErrorResponse(error, `${prefix} [Redirect Not Allowed]`)
 }
 if (error instanceof SecurityViolationError) {
  return createErrorResponse(error, `${prefix} [Security Violation]`)
 }
 return createErrorResponse(error, prefix)
}

/**
 * Register bash execution tools with the MCP server
 */
export function registerExecTools(server: McpServer): void {
 // ========================================================================
 // bash - Upstream bash-tool compatible execution
 // ========================================================================
 server.registerTool(
  'bash',
  {description: 'Execute bash commands in the sandbox environment. Upstream-compatible MCP exposure of the just-bash/bash-tool execute interface. The persistent filesystem is shared across calls.', inputSchema: {command: z.string().describe('The bash command to execute')}},
  async ({command}: {command: string}) => {
   try {
    const bash = getPersistentBash()
    const result = await bash.exec(command)
    return formatExecResult(result)
   } catch (error) {
    return classifyError(error, 'Execution error')
   }
  }
 )

 // ========================================================================
 // bash_exec - Isolated execution
 // ========================================================================
 server.registerTool(
  'bash_exec',
  {
   description: "Execute a bash command in a fresh sandboxed environment. Environment variables, functions, cwd, and in-memory filesystem writes don't persist across calls.",
   inputSchema: {
    command: z.string().describe('The bash command to execute'),
    initialEnv: z.record(z.string(), z.string()).optional().describe('Initial environment variables to set when creating the bash instance'),
    files: z.record(z.string(), initialFileSchema).optional().describe('Files to create before execution (path -> content or {content, encoding, mode, mtime})'),
    ...execOptionSchema
   }
  },
  async ({command, initialEnv, files, ...options}: {command: string; initialEnv?: Record<string, string>; files?: Record<string, InitialFileInput>} & ToolExecOptions) => {
   try {
    const bash = createBashInstance(normalizeInitialFiles(files), undefined, initialEnv)
    const result = await execWithOptions(bash, command, options)
    return formatExecResult(result)
   } catch (error) {
    return classifyError(error, 'Execution error')
   }
  }
 )

 // ========================================================================
 // bash_exec_persistent - Persistent execution
 // ========================================================================
 server.registerTool(
  'bash_exec_persistent',
  {description: 'Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls, but env vars, functions, and cwd are reset each call.', inputSchema: {command: z.string().describe('The bash command to execute'), ...execOptionSchema}},
  async ({command, ...options}: {command: string} & ToolExecOptions) => {
   try {
    const bash = getPersistentBash()
    const result = await execWithOptions(bash, command, options)
    return formatExecResult(result)
   } catch (error) {
    return classifyError(error, 'Execution error')
   }
  }
 )

 // ========================================================================
 // bash_reset - Reset persistent environment
 // ========================================================================
 server.registerTool('bash_reset', {description: 'Reset the persistent bash environment, clearing all files and state.', inputSchema: {}}, async () => {
  resetPersistentBash()
  return {content: [{type: 'text' as const, text: 'Persistent bash environment has been reset.'}]}
 })
}
