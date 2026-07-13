/**
 * Sandbox API tools
 * Tools for execution in a persistent isolated environment
 *
 * Uses upstream Sandbox APIs and its underlying Bash instance:
 * - Sandbox.create(), mkDir(), stop(), extendTimeout()
 * - Bash.exec() for script execution with the complete ExecOptions surface
 * - Sandbox.domain getter for domain info
 * - OutputMessage type for streaming output
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {NetworkAccessDeniedError, RedirectNotAllowedError, SecurityViolationError, TooManyRedirectsError, type OutputMessage} from 'just-bash'
import {z} from 'zod/v4'
import {config} from '../config/index.js'
import {createErrorResponse, createJsonResponse, createSuccessResponse, decodeBase64, truncateOutput} from '../utils/index.js'
import {getPersistentSandbox, resetPersistentSandbox} from './bash-instance.js'

type SandboxWriteFiles = Record<string, string | {content: string; encoding?: 'utf-8' | 'base64'}>

const sandboxWriteFileEntrySchema = z.union([z.string(), z.object({content: z.string(), encoding: z.enum(['utf-8', 'base64']).optional()})])

function createAbortSignal(timeoutMs: number | undefined): {signal?: AbortSignal; cleanup(): void} {
 if (!timeoutMs) return {cleanup() {}}
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 return {signal: controller.signal, cleanup: () => clearTimeout(timeout)}
}

async function writeFiles(files: SandboxWriteFiles): Promise<void> {
 const sandbox = await getPersistentSandbox()
 const bash = sandbox.bashEnvInstance
 for (const [path, input] of Object.entries(files)) {
  const resolvedPath = bash.fs.resolvePath(bash.getCwd(), path)
  const parentDir = resolvedPath.slice(0, resolvedPath.lastIndexOf('/')) || '/'
  if (parentDir !== '/') {
   await bash.fs.mkdir(parentDir, {recursive: true})
  }
  const content = typeof input === 'string' ? input : input.encoding === 'base64' ? decodeBase64(input.content) : input.content
  await bash.fs.writeFile(resolvedPath, content)
 }
}

async function readFile(path: string, encoding: 'utf-8' | 'base64'): Promise<string> {
 const sandbox = await getPersistentSandbox()
 const bash = sandbox.bashEnvInstance
 const resolvedPath = bash.fs.resolvePath(bash.getCwd(), path)
 return encoding === 'base64' ? Buffer.from(await bash.fs.readFileBuffer(resolvedPath)).toString('base64') : bash.fs.readFile(resolvedPath)
}

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

export function registerSandboxTools(server: McpServer): void {
 server.registerTool(
  'bash_sandbox_run',
  {
   description: 'Run a command in a persistent isolated environment with optional structured output and logs.',
   inputSchema: {
    command: z.string().describe('The command to execute'),
    args: z.array(z.string()).optional().describe('Additional argv entries appended to the command without shell parsing'),
    cwd: z.string().optional().describe('Working directory for the command'),
    env: z.record(z.string(), z.string()).optional().describe('Environment variables to set'),
    sudo: z.boolean().optional().describe('Run with sudo. No-op in just-bash, included for Vercel Sandbox API compatibility'),
    timeoutMs: z.number().int().positive().optional().describe('Cooperatively abort execution after this many milliseconds'),
    includeOutput: z.boolean().optional().describe('Include combined stdout and stderr output'),
    includeLogs: z.boolean().optional().describe('Include stdout/stderr log records')
   }
  },
  async ({command, args, cwd, env, timeoutMs, includeOutput = false, includeLogs = false}: {command: string; args?: string[]; cwd?: string; env?: Record<string, string>; sudo?: boolean; timeoutMs?: number; includeOutput?: boolean; includeLogs?: boolean}) => {
   const abort = createAbortSignal(timeoutMs ?? config.SANDBOX_TIMEOUT_MS)
   try {
    const sandbox = await getPersistentSandbox()
    const result = await sandbox.bashEnvInstance.exec(command, {args, cwd, env, signal: abort.signal})
    const {stdout, stderr} = result

    const response: {stdout: string; stderr: string; exitCode: number; output?: string; logs?: OutputMessage[]} = {stdout: truncateOutput(stdout, config.MAX_OUTPUT_LENGTH, 'stdout'), stderr: truncateOutput(stderr, config.MAX_OUTPUT_LENGTH, 'stderr'), exitCode: result.exitCode}

    if (includeOutput) {
     response.output = truncateOutput(stdout + stderr, config.MAX_OUTPUT_LENGTH, 'stdout')
    }
    if (includeLogs) {
     response.logs = [...(stdout ? [{type: 'stdout' as const, data: truncateOutput(stdout, config.MAX_OUTPUT_LENGTH, 'stdout'), timestamp: new Date()}] : []), ...(stderr ? [{type: 'stderr' as const, data: truncateOutput(stderr, config.MAX_OUTPUT_LENGTH, 'stderr'), timestamp: new Date()}] : [])]
    }

    return createJsonResponse(response, result.exitCode !== 0)
   } catch (error) {
    return classifyError(error, 'Sandbox error')
   } finally {
    abort.cleanup()
   }
  }
 )

 server.registerTool('bash_sandbox_domain', {description: 'Get the current sandbox domain or identifier.', inputSchema: {}}, async () => {
  try {
   const sandbox = await getPersistentSandbox()
   return createJsonResponse({domain: sandbox.domain})
  } catch (error) {
   return classifyError(error, 'Domain error')
  }
 })

 server.registerTool(
  'bash_sandbox_write_files',
  {description: 'Write multiple files to the persistent isolated environment at once.', inputSchema: {files: z.record(z.string(), sandboxWriteFileEntrySchema).describe('Files to write (path -> content or {content, encoding})')}},
  async ({files}: {files: SandboxWriteFiles}) => {
   try {
    await writeFiles(files)

    return createSuccessResponse(`Successfully wrote ${Object.keys(files).length} file(s): ${Object.keys(files).join(', ')}`)
   } catch (error) {
    return classifyError(error, 'Write error')
   }
  }
 )

 server.registerTool(
  'bash_sandbox_read_file',
  {description: 'Read a file from the persistent isolated environment.', inputSchema: {path: z.string().describe('The file path to read'), encoding: z.enum(['utf-8', 'base64']).optional().describe('File encoding (default: utf-8)')}},
  async ({path, encoding = 'utf-8'}: {path: string; encoding?: 'utf-8' | 'base64'}) => {
   try {
    const content = await readFile(path, encoding)

    return {content: [{type: 'text' as const, text: truncateOutput(content, config.MAX_OUTPUT_LENGTH, 'stdout')}]}
   } catch (error) {
    return classifyError(error, 'Read error')
   }
  }
 )

 server.registerTool(
  'bash_sandbox_mkdir',
  {description: 'Create a directory in the persistent isolated environment.', inputSchema: {path: z.string().describe('The directory path to create'), recursive: z.boolean().optional().describe('Create parent directories if needed (default: true)')}},
  async ({path, recursive = true}: {path: string; recursive?: boolean}) => {
   try {
    const sandbox = await getPersistentSandbox()
    await sandbox.mkDir(path, {recursive})

    return createSuccessResponse(`Successfully created directory: ${path}`)
   } catch (error) {
    return classifyError(error, 'Mkdir error')
   }
  }
 )

 server.registerTool('bash_sandbox_stop', {description: 'Stop and clean up the persistent isolated environment, releasing all resources. Use bash_sandbox_reset to just clear state.', inputSchema: {}}, async () => {
  try {
   await resetPersistentSandbox()
   return createSuccessResponse('Sandbox environment has been stopped and cleaned up.')
  } catch (error) {
   return classifyError(error, 'Stop error')
  }
 })

 server.registerTool('bash_sandbox_extend_timeout', {description: 'Extend the persistent isolated environment timeout. Included for Vercel Sandbox API compatibility.', inputSchema: {timeoutMs: z.number().int().positive().describe('New timeout budget in milliseconds')}}, async ({timeoutMs}: {timeoutMs: number}) => {
  try {
   const sandbox = await getPersistentSandbox()
   await sandbox.extendTimeout(timeoutMs)
   return createSuccessResponse(`Sandbox timeout extended to ${timeoutMs}ms.`)
  } catch (error) {
   return classifyError(error, 'Extend timeout error')
  }
 })

 server.registerTool('bash_sandbox_reset', {description: 'Reset the persistent isolated environment, clearing all files and state.', inputSchema: {}}, async () => {
  try {
   await resetPersistentSandbox()
   return createSuccessResponse('Sandbox environment has been reset.')
  } catch (error) {
   return classifyError(error, 'Reset error')
  }
 })
}
