/**
 * File operation tools
 * Tools for reading, writing, and listing files in the bash environment
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod/v4'
import {config} from '../config/index.js'
import {createErrorResponse, createSuccessResponse, decodeBase64, truncateOutput} from '../utils/index.js'
import {getPersistentBash} from './bash-instance.js'

type FileEncoding = 'utf-8' | 'base64'

function shellQuote(value: string): string {
 return `'${value.replace(/'/g, `'\\''`)}'`
}

async function readFromPersistentBash(path: string, encoding: FileEncoding): Promise<string> {
 const bash = getPersistentBash()
 const resolvedPath = bash.fs.resolvePath(bash.getCwd(), path)
 if (encoding === 'base64') {
  return Buffer.from(await bash.fs.readFileBuffer(resolvedPath)).toString('base64')
 }
 return bash.fs.readFile(resolvedPath)
}

async function writeToPersistentBash(path: string, content: string, encoding: FileEncoding): Promise<number> {
 const bash = getPersistentBash()
 const resolvedPath = bash.fs.resolvePath(bash.getCwd(), path)
 const data = encoding === 'base64' ? decodeBase64(content) : content
 await bash.fs.writeFile(resolvedPath, data)
 return typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength
}

/**
 * Register file operation tools with the MCP server
 */
export function registerFileTools(server: McpServer): void {
 // ========================================================================
 // bash_write_file - Write file
 // ========================================================================
 server.registerTool(
  'bash_write_file',
  {description: 'Write content to a file in the persistent bash environment.', inputSchema: {path: z.string().describe('The file path to write to'), content: z.string().describe('The content to write'), encoding: z.enum(['utf-8', 'base64']).optional().describe('Content encoding (default: utf-8)')}},
  async ({path, content, encoding = 'utf-8'}: {path: string; content: string; encoding?: FileEncoding}) => {
   try {
    const bytesWritten = await writeToPersistentBash(path, content, encoding)

    return createSuccessResponse(`Successfully wrote ${bytesWritten} bytes to ${path}`)
   } catch (error) {
    return createErrorResponse(error, 'Write error')
   }
  }
 )

 // ========================================================================
 // bash_read_file - Read file
 // ========================================================================
 server.registerTool(
  'bash_read_file',
  {description: 'Read content from a file in the persistent bash environment.', inputSchema: {path: z.string().describe('The file path to read'), encoding: z.enum(['utf-8', 'base64']).optional().describe('Output encoding (default: utf-8)')}},
  async ({path, encoding = 'utf-8'}: {path: string; encoding?: FileEncoding}) => {
   try {
    const content = await readFromPersistentBash(path, encoding)

    return {content: [{type: 'text' as const, text: truncateOutput(content, config.MAX_OUTPUT_LENGTH, 'stdout')}]}
   } catch (error) {
    return createErrorResponse(error, 'Read error')
   }
  }
 )

 // ========================================================================
 // bash_list_files - List files
 // ========================================================================
 server.registerTool(
  'bash_list_files',
  {
   description: 'List files and directories in the persistent bash environment.',
   inputSchema: {path: z.string().optional().describe('The directory path to list (defaults to current directory)'), recursive: z.boolean().optional().describe('Whether to list recursively'), showHidden: z.boolean().optional().describe('Whether to show hidden files')}
  },
  async ({path = '.', recursive = false, showHidden = false}: {path?: string; recursive?: boolean; showHidden?: boolean}) => {
   try {
    const bash = getPersistentBash()
    let cmd: string
    const quotedPath = shellQuote(path)

    if (recursive) {
     cmd = showHidden ? `find ${quotedPath} -type f` : `find ${quotedPath} -type f ! -name '.*' ! -path '*/.*'`
    } else {
     cmd = showHidden ? `ls -la ${quotedPath}` : `ls -l ${quotedPath}`
    }

    const result = await bash.exec(cmd)

    return {content: [{type: 'text' as const, text: result.stdout || '(empty directory)'}], isError: result.exitCode !== 0}
   } catch (error) {
    return createErrorResponse(error, 'List error')
   }
  }
 )

 // ========================================================================
 // bash_direct_read - Direct filesystem read
 // ========================================================================
 server.registerTool(
  'bash_direct_read',
  {description: 'Read a file directly from the persistent bash filesystem (without running cat).', inputSchema: {path: z.string().describe('The file path to read'), encoding: z.enum(['utf-8', 'base64']).optional().describe('Output encoding (default: utf-8)')}},
  async ({path, encoding = 'utf-8'}: {path: string; encoding?: FileEncoding}) => {
   try {
    const content = await readFromPersistentBash(path, encoding)

    return {content: [{type: 'text' as const, text: truncateOutput(content, config.MAX_OUTPUT_LENGTH, 'stdout')}]}
   } catch (error) {
    return createErrorResponse(error, 'Read error')
   }
  }
 )

 // ========================================================================
 // bash_direct_write - Direct filesystem write
 // ========================================================================
 server.registerTool(
  'bash_direct_write',
  {
   description: 'Write a file directly to the persistent bash filesystem (without running shell commands).',
   inputSchema: {path: z.string().describe('The file path to write'), content: z.string().describe('The content to write'), encoding: z.enum(['utf-8', 'base64']).optional().describe('Content encoding (default: utf-8)')}
  },
  async ({path, content, encoding = 'utf-8'}: {path: string; content: string; encoding?: FileEncoding}) => {
   try {
    const bytesWritten = await writeToPersistentBash(path, content, encoding)

    return createSuccessResponse(`Successfully wrote ${bytesWritten} bytes to ${path}`)
   } catch (error) {
    return createErrorResponse(error, 'Write error')
   }
  }
 )
}
