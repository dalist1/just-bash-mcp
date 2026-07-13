import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
import {strict as assert} from 'node:assert'
import {mkdtemp, rm, symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const serverEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))

function getServerEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
 const environment: Record<string, string> = {}
 for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string' && !key.startsWith('JUST_BASH_') && key !== 'NODE_ENV') {
   environment[key] = value
  }
 }
 return {...environment, ...overrides}
}

async function withClient<T>(environment: Record<string, string>, run: (client: Client) => Promise<T>, server: {command: string; args?: string[]} = {command: process.execPath, args: [serverEntry]}): Promise<T> {
 const transport = new StdioClientTransport({...server, cwd: root, env: environment, stderr: 'pipe'})
 const client = new Client({name: 'just-bash-mcp-test', version: '1.0.0'})
 await client.connect(transport)
 try {
  return await run(client)
 } finally {
  await client.close()
 }
}

function getText(result: unknown): string {
 if (typeof result !== 'object' || result === null || !('content' in result) || !Array.isArray(result.content)) {
  throw new Error('Expected an MCP content result')
 }
 const content: unknown[] = result.content
 const text = content.find((entry): entry is {type: 'text'; text: string} => typeof entry === 'object' && entry !== null && 'type' in entry && entry.type === 'text' && 'text' in entry && typeof entry.text === 'string')
 if (!text) {
  throw new Error('Expected text content in MCP result')
 }
 return text.text
}

function getJson(result: unknown): Record<string, unknown> {
 return JSON.parse(getText(result)) as Record<string, unknown>
}

function isError(result: unknown): boolean {
 return typeof result === 'object' && result !== null && 'isError' in result && result.isError === true
}

void test('exposes the complete 3.1 MCP surface and byte-safe execution paths', {timeout: 120000}, async () => {
 await withClient(getServerEnvironment(), async client => {
  const listed = await client.listTools()
  assert.deepEqual(listed.tools.map(tool => tool.name).sort(), [
   'bash',
   'bash_direct_read',
   'bash_direct_write',
   'bash_exec',
   'bash_exec_persistent',
   'bash_get_cwd',
   'bash_get_env',
   'bash_info',
   'bash_list_files',
   'bash_read_file',
   'bash_reset',
   'bash_sandbox_domain',
   'bash_sandbox_extend_timeout',
   'bash_sandbox_mkdir',
   'bash_sandbox_read_file',
   'bash_sandbox_reset',
   'bash_sandbox_run',
   'bash_sandbox_stop',
   'bash_sandbox_write_files',
   'bash_transform',
   'bash_write_file'
  ])

  const info = getJson(await client.callTool({name: 'bash_info', arguments: {}}))
  assert.equal(info.version, '3.1.0')
  assert.equal(info.upstreamVersion, '3.1.0')
  assert.equal(info.denyPrivateRanges, false)
  assert.equal(info.denyPrivateRangesConfigured, false)

  const strictMode = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'set -euo pipefail; value=ok; printf "%s" "$value"'}}))
  assert.equal(strictMode.exitCode, 0)
  assert.equal(strictMode.stdout, 'ok')

  const bytes = Buffer.from([0, 255, 65]).toString('base64')
  const initialFile = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'base64 /blob', files: {'/blob': {content: bytes, encoding: 'base64', mode: 420, mtime: '2026-01-01T00:00:00.000Z'}}}}))
  assert.equal(initialFile.stdout, `${bytes}\n`)

  const stdin = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'base64', stdinBase64: bytes}}))
  assert.equal(stdin.stdout, `${bytes}\n`)

  const args = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'printf "<%s>"', args: ['a b']}}))
  assert.equal(args.stdout, '<a b>')

  const replacedEnv = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'printenv TOKEN', replaceEnv: true, env: {TOKEN: 'present'}}}))
  assert.equal(replacedEnv.stdout, 'present\n')

  const redirected = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'missing-command > /all 2>&1; cat /all'}}))
  assert.equal(redirected.exitCode, 0)
  assert.match(String(redirected.stdout), /missing-command: command not found/)
  assert.equal(redirected.stderr, '')

  const write = await client.callTool({name: 'bash_direct_write', arguments: {path: '/nested/data.bin', content: bytes, encoding: 'base64'}})
  assert.equal(isError(write), false)
  const read = await client.callTool({name: 'bash_direct_read', arguments: {path: '/nested/data.bin', encoding: 'base64'}})
  assert.equal(getText(read), bytes)

  const invalidBase64 = await client.callTool({name: 'bash_exec', arguments: {command: 'cat', stdinBase64: '%%%'}})
  assert.equal(isError(invalidBase64), true)
  assert.match(getText(invalidBase64), /Invalid base64 content/)

  const transformed = getJson(await client.callTool({name: 'bash_transform', arguments: {command: 'echo hi | grep h', collectCommands: true}}))
  assert.equal(transformed.script, 'echo hi | grep h')
  assert.deepEqual(transformed.metadata, {commands: ['echo', 'grep']})
 })
})

void test('forwards sandbox capabilities, command filters, options, and binary files', {timeout: 120000}, async () => {
 await withClient(getServerEnvironment({NODE_ENV: 'production', JUST_BASH_ALLOWED_COMMANDS: 'echo,printf,js-exec,python,python3', JUST_BASH_ENABLE_JAVASCRIPT: 'true', JUST_BASH_ENABLE_PYTHON: 'true'}), async client => {
  const info = getJson(await client.callTool({name: 'bash_info', arguments: {}}))
  assert.equal(info.denyPrivateRanges, true)
  assert.equal(info.denyPrivateRangesConfigured, false)

  const echo = getJson(await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'echo allowed', includeOutput: true, includeLogs: true}}))
  assert.equal(echo.exitCode, 0)
  assert.equal(echo.stdout, 'allowed\n')
  assert.equal(echo.output, 'allowed\n')
  assert.ok(Array.isArray(echo.logs))

  const args = getJson(await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'printf "<%s>"', args: ['a b']}}))
  assert.equal(args.stdout, '<a b>')

  const deniedResult = await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'ls'}})
  assert.equal(isError(deniedResult), true)
  const denied = getJson(deniedResult)
  assert.equal(denied.exitCode, 127)
  assert.match(String(denied.stderr), /ls: command not found/)

  const javascript = getJson(await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'js-exec --version'}}))
  assert.equal(javascript.exitCode, 0)
  assert.match(String(javascript.stdout), /QuickJS/)

  const python = getJson(await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'python3 -c "print(6 * 7)"', timeoutMs: 30000}}))
  assert.equal(python.exitCode, 0)
  assert.equal(python.stdout, '42\n')

  const bytes = Buffer.from([0, 255, 65]).toString('base64')
  const write = await client.callTool({name: 'bash_sandbox_write_files', arguments: {files: {'/nested/data.bin': {content: bytes, encoding: 'base64'}}}})
  assert.equal(isError(write), false)
  const read = await client.callTool({name: 'bash_sandbox_read_file', arguments: {path: '/nested/data.bin', encoding: 'base64'}})
  assert.equal(getText(read), bytes)
 })
})

void test('preserves security overrides and redacts network credentials', {timeout: 30000}, async () => {
 await withClient(
  getServerEnvironment({
   NODE_ENV: 'production',
   JUST_BASH_ALLOW_NETWORK: 'true',
   JUST_BASH_ALLOWED_URLS_JSON: '[{"url":"https://api.example.com/v1/","transform":[{"headers":{"Authorization":"secret-token"}}]}]',
   JUST_BASH_ALLOWED_METHODS: 'get, post',
   JUST_BASH_DENY_PRIVATE_RANGES: 'false',
   JUST_BASH_DEFENSE_IN_DEPTH: 'false',
   JUST_BASH_INITIAL_ENV: '{"TOKEN":"initial-value"}',
   JUST_BASH_PROCESS_INFO: '{"pid":123,"ppid":45,"uid":1000,"gid":1001}'
  }),
  async client => {
   const info = getJson(await client.callTool({name: 'bash_info', arguments: {}}))
   assert.equal(info.networkEnabled, true)
   assert.deepEqual(info.allowedMethods, ['GET', 'POST'])
   assert.equal(info.denyPrivateRanges, false)
   assert.equal(info.denyPrivateRangesConfigured, true)
   assert.equal(info.initialEnvConfigured, true)
   assert.deepEqual(info.virtualProcessInfo, {pid: 123, ppid: 45, uid: 1000, gid: 1001})
   assert.deepEqual(info.defenseInDepth, {enabled: false})
   assert.doesNotMatch(JSON.stringify(info), /secret-token/)
   assert.match(JSON.stringify(info.allowedUrlPrefixes), /\[redacted\]/)

   const processInfo = getJson(await client.callTool({name: 'bash_exec', arguments: {command: 'printf "%s:%s:%s:%s" "$TOKEN" "$$" "$PPID" "$UID"'}}))
   assert.equal(processInfo.stdout, 'initial-value:123:45:1000')

   const sandboxEnv = getJson(await client.callTool({name: 'bash_sandbox_run', arguments: {command: 'printenv TOKEN'}}))
   assert.equal(sandboxEnv.stdout, 'initial-value\n')
  }
 )
})

void test('starts through an npm-style executable symlink', {timeout: 30000, skip: process.platform === 'win32'}, async () => {
 const directory = await mkdtemp(join(tmpdir(), 'just-bash-mcp-'))
 const executable = join(directory, 'just-bash-mcp')
 await symlink(serverEntry, executable)
 try {
  await withClient(
   getServerEnvironment(),
   async client => {
    const listed = await client.listTools()
    assert.equal(listed.tools.length, 21)
   },
   {command: executable}
  )
 } finally {
  await rm(directory, {recursive: true, force: true})
 }
})
