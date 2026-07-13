/**
 * Utility functions for just-bash-mcp
 */

import {config} from '../config/index.js'

export function decodeBase64(value: string): Buffer {
 const compact = value.replace(/\s/g, '')
 const paddingIndex = compact.indexOf('=')
 const data = paddingIndex === -1 ? compact : compact.slice(0, paddingIndex)
 const padding = paddingIndex === -1 ? '' : compact.slice(paddingIndex)
 if (!/^[A-Za-z0-9+/]*$/.test(data) || !/^={0,2}$/.test(padding) || compact.length % 4 === 1 || (padding.length > 0 && compact.length % 4 !== 0)) {
  throw new Error('Invalid base64 content')
 }
 return Buffer.from(compact, 'base64')
}

/**
 * Truncate output to maximum length with notification message
 */
export function truncateOutput(output: string, maxLength: number, streamName: 'stdout' | 'stderr'): string {
 if (output.length <= maxLength) {
  return output
 }
 const truncatedLength = output.length - maxLength
 return `${output.slice(0, maxLength)}\n\n[${streamName} truncated: ${truncatedLength} characters removed]`
}

/**
 * Create a successful MCP tool response
 */
export function createSuccessResponse(text: string): {content: Array<{type: 'text'; text: string}>} {
 return {content: [{type: 'text' as const, text}]}
}

/**
 * Create an error MCP tool response
 */
export function createErrorResponse(error: unknown, prefix = 'Error'): {content: Array<{type: 'text'; text: string}>; isError: true} {
 const message = error instanceof Error ? error.message : String(error)
 return {content: [{type: 'text' as const, text: `${prefix}: ${message}`}], isError: true}
}

/**
 * Create a JSON MCP tool response
 */
export function createJsonResponse(data: unknown, isError = false): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
 const response: {content: Array<{type: 'text'; text: string}>; isError?: boolean} = {content: [{type: 'text' as const, text: JSON.stringify(data, null, 2)}]}
 if (isError) {
  response.isError = true
 }
 return response
}

/**
 * Format bash execution result for MCP response
 */
export function formatExecResult(result: {stdout: string; stderr: string; exitCode: number; env?: Record<string, string>; stdoutKind?: 'text' | 'bytes'; stdoutEncoding?: 'binary'; metadata?: Record<string, unknown>}): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
 return createJsonResponse(
  {
   stdout: truncateOutput(result.stdout, config.MAX_OUTPUT_LENGTH, 'stdout'),
   stderr: truncateOutput(result.stderr, config.MAX_OUTPUT_LENGTH, 'stderr'),
   exitCode: result.exitCode,
   ...(result.env && {env: result.env}),
   ...(result.stdoutKind && {stdoutKind: result.stdoutKind}),
   ...(result.stdoutEncoding && {stdoutEncoding: result.stdoutEncoding}),
   ...(result.metadata && {metadata: result.metadata})
  },
  result.exitCode !== 0
 )
}
