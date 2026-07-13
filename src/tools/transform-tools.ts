/**
 * Bash transform tools
 * Exposes the upstream AST transform pipeline through MCP.
 */

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod/v4'
import {createErrorResponse, createJsonResponse} from '../utils/index.js'

type TransformPipeline = {use(plugin: unknown): TransformPipeline; transform(commandLine: string): unknown}

type TransformExports = {BashTransformPipeline: new () => TransformPipeline; CommandCollectorPlugin: new () => unknown; TeePlugin: new (options: {outputDir: string}) => unknown}

async function loadTransformExports(): Promise<TransformExports> {
 const upstream = (await import('just-bash')) as unknown as Partial<TransformExports>
 if (!upstream.BashTransformPipeline || !upstream.CommandCollectorPlugin || !upstream.TeePlugin) {
  throw new Error('Installed just-bash does not expose the transform API')
 }
 return upstream as TransformExports
}

export function registerTransformTools(server: McpServer): void {
 server.registerTool(
  'bash_transform',
  {
   description: 'Transform a bash script with the upstream just-bash AST transform pipeline without executing it.',
   inputSchema: {command: z.string().describe('The bash script to transform'), collectCommands: z.boolean().optional().describe('Collect command metadata with CommandCollectorPlugin'), teeOutputDir: z.string().optional().describe('If set, apply TeePlugin and tee command output into this virtual output directory')}
  },
  async ({command, collectCommands = false, teeOutputDir}: {command: string; collectCommands?: boolean; teeOutputDir?: string}) => {
   try {
    const {BashTransformPipeline, CommandCollectorPlugin, TeePlugin} = await loadTransformExports()
    const pipeline = new BashTransformPipeline()
    if (teeOutputDir) {
     pipeline.use(new TeePlugin({outputDir: teeOutputDir}))
    }
    if (collectCommands) {
     pipeline.use(new CommandCollectorPlugin())
    }
    return createJsonResponse(pipeline.transform(command))
   } catch (error) {
    return createErrorResponse(error, 'Transform error')
   }
  }
 )
}
