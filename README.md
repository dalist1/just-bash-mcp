# just-bash-mcp

[![npm version](https://img.shields.io/npm/v/just-bash-mcp.svg)](https://www.npmjs.com/package/just-bash-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An MCP (Model Context Protocol) server that provides a sandboxed bash environment for AI agents.

Execute bash commands in a secure, isolated environment with an in-memory virtual filesystem.

Built on top of [`just-bash`](https://github.com/vercel-labs/just-bash) v3.1.0.

## What's New in v3.1.0

- **Synced with upstream `just-bash` v3.1.0** - Full upstream commands, APIs, type exports, and command fixes through the latest release
- **Sandbox capability forwarding** - `bash_sandbox_*` honors Python, JavaScript, and command allow-list configuration through the new upstream `SandboxOptions`
- **Upstream shell fixes** - Includes corrected redirection routing, multiline quoted whitespace, strict-mode `set -euo pipefail`, heredoc substitutions, and mixed byte/text output
- **Expanded command compatibility** - Includes `jq -R`, nested jq interpolation, curl `@file` data, GNU tar option bundles, byte-clean `head`/`tail`, and piped-stdin `rg`
- **Byte-safe stdin handling** - Tracks the upstream v3 TypeScript-enforced stdin byte/UTF-8 model
- **Executor integration plumbing** - Includes upstream support for `js-exec` tool invocation hooks and executor package integration
- **ESM runtime fix** - Includes the upstream v3.0.1 dynamic `require("tty")`/`file` command crash fix
- **Full upstream exec options over MCP** - `cwd`, `env`, `replaceEnv`, `stdin`, `stdinKind`, `args`, `rawScript`, AbortSignal-backed `timeoutMs`, plus MCP-friendly `stdinBase64`
- **AST transform tool** - `bash_transform` exposes upstream `BashTransformPipeline`, `CommandCollectorPlugin`, and `TeePlugin`
- **Persistent sandbox tools** - `bash_sandbox_*` tools remain available for higher-level isolated workflows
- **Byte-safe file IO** - Persistent file tools support base64 read/write for binary content
- **Defense-in-depth mode** - Upstream-default monkey-patching of dangerous JS globals (set `JUST_BASH_DEFENSE_IN_DEPTH=false` to disable)
- **Python support** - Python3 via the upstream emscripten CPython runtime (`JUST_BASH_ENABLE_PYTHON=true`)
- **MountableFS + ReadWriteFS** - Real directory mounts with overlay/read-write options
- **Configurable execution limits** - Fine-grained control over loops, strings, arrays, heredocs, and substitutions

## Features

- **Sandboxed Execution**: Commands run in an isolated virtual filesystem
- **Stateless & Stateful Modes**: Choose between isolated executions or persistent filesystem
- **Network Access Control**: Optional network access with URL allow-lists
- **Execution Limits**: Protection against infinite loops and deep recursion
- **OverlayFS Support**: Mount real directories as read-only with copy-on-write
- **MountableFS Support**: Mount multiple filesystems at different paths
- **ReadWriteFS Support**: Direct read-write access to real directories

## Synced Upstream Features

The current wrapper release tracks `just-bash` `v3.1.0`, including:

- Sandbox forwarding for Python, JavaScript, command filters, custom commands, and custom fetch implementations
- Correct final-target routing for chained stdout/stderr redirections
- UTF-8 fixes for scripts that mix text and byte-producing statements
- Multiline quoted-string whitespace preservation
- Defense-in-depth fixes for ordinary variable assignments
- Heredoc-aware command-substitution parsing
- `set -euo pipefail` short-option cluster support
- `jq -R` raw-input mode and nested quoted strings in interpolation
- `curl @file` handling for data options
- GNU old-style tar option bundles such as `tar czf`
- Byte-clean `head`/`tail`, piped-stdin `rg`, and corrected JavaScript Buffer encodings
- UTC-by-default `date` behavior with explicit `TZ` support
- Breaking v3 stdin byte/UTF-8 handling updates for custom commands
- Executor and `js-exec` integration plumbing
- ESM Node bundle dynamic-require fix for commands that load `tty` transitively
- `jq` control-character handling inside JSON strings
- Faster `grep` pattern matching via matcher reuse and literal pre-filtering
- AWK lexer fixes for POSIX multi-line statement continuation
- Bug fixes across network, sqlite3, xan, rg, terminal rendering, and CI
- Workspace/Changesets migration with unchanged public import paths and bin entries
- Defense-in-depth hardening across the runtime and filesystem layers
- Defense-in-depth enabled by default upstream, plus additional hardening passes
- Filesystem hardening for overlays, external filesystems, symlinks, and broken symlink handling
- Virtualized PID and shell security invariant improvements
- Updated `Sandbox.runCommand()` signature compatibility
- Python runtime migration from Pyodide to emscripten CPython
- Follow-up Python runtime hardening and cleanup
- UTF-8 handling and write-path fixes
- CommonJS compatibility improvements upstream
- `ls -F` / `--classify` support
- Additional cleanup and internal hardening work shipped through `v3.1.0`

### GitHub main audit

Checked `vercel-labs/just-bash` `main` at commit `6130334f0ed013771bbe39f32a249bdaf762c488`. It is one unreleased command-only commit ahead of `v3.1.0`, adding GNU `cat` display flags (`-A`, `-b`, `-e`, `-E`, `-s`, `-t`, `-T`, and `-v`). The upstream manifest remains `3.1.0`; this wrapper intentionally tracks the reproducible npm release rather than an unversioned Git commit.

## Installation

### From npm (recommended)

Requires Node.js 22 or newer.

```bash
npm install -g just-bash-mcp

# Or with bun
bun add -g just-bash-mcp
```

### From source

```bash
git clone https://github.com/dalist1/just-bash-mcp.git
cd just-bash-mcp
bun install
bun run check
```

## Usage

### Running the Server

```bash
just-bash-mcp

# Or from source
bun run dev
```

## MCP Client Configuration

### Using npx (no installation required)

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"]
    }
  }
}
```

### Cursor / VS Code (Roo Code / Cline) / Windsurf

Add to your MCP settings:

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"]
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JUST_BASH_CWD` | Initial working directory | `/home/user` |
| `JUST_BASH_INITIAL_ENV` | JSON object of initial env vars, e.g. `{"TZ":"UTC"}` | - |
| `JUST_BASH_OVERLAY_ROOT` | Real directory to mount as copy-on-write overlay | - |
| `JUST_BASH_OVERLAY_READ_ONLY` | OverlayFS read-only mode | `false` |
| `JUST_BASH_READ_WRITE_ROOT` | Real directory with read-write access | - |
| `JUST_BASH_MOUNTS` | JSON array of mount configurations | - |
| `JUST_BASH_ALLOW_NETWORK` | Enable network access (`true`/`false`) | `false` |
| `JUST_BASH_ALLOWED_URLS` | Comma-separated URL prefixes to allow | - |
| `JUST_BASH_ALLOWED_URLS_JSON` | JSON array of URL strings or `{url, transform:[{headers}]}` entries | - |
| `JUST_BASH_ALLOWED_METHODS` | Comma-separated HTTP methods to allow | `GET,HEAD` |
| `JUST_BASH_DENY_PRIVATE_RANGES` | Reject private/loopback network ranges | upstream default (`true` in production, otherwise `false`) |
| `JUST_BASH_MAX_REDIRECTS` | Maximum HTTP redirects | `20` |
| `JUST_BASH_NETWORK_TIMEOUT_MS` | Network timeout in milliseconds | `30000` |
| `JUST_BASH_MAX_RESPONSE_SIZE` | Max network response body size (bytes) | `10485760` |
| `JUST_BASH_MAX_OUTPUT_LENGTH` | Maximum output length | `30000` |
| `JUST_BASH_MAX_CALL_DEPTH` | Maximum function recursion depth | `100` |
| `JUST_BASH_MAX_COMMAND_COUNT` | Maximum total commands per execution | `10000` |
| `JUST_BASH_MAX_LOOP_ITERATIONS` | Maximum iterations per loop | `10000` |
| `JUST_BASH_MAX_AWK_ITERATIONS` | Maximum AWK loop iterations | `10000` |
| `JUST_BASH_MAX_SED_ITERATIONS` | Maximum sed branch iterations | `10000` |
| `JUST_BASH_MAX_JQ_ITERATIONS` | Maximum jq loop iterations | `10000` |
| `JUST_BASH_MAX_JS_TIMEOUT_MS` | Maximum JavaScript/js-exec timeout | `10000` |
| `JUST_BASH_MAX_GLOB_OPERATIONS` | Maximum glob filesystem operations | `100000` |
| `JUST_BASH_MAX_STRING_LENGTH` | Maximum string length (bytes) | `10485760` |
| `JUST_BASH_MAX_ARRAY_ELEMENTS` | Maximum array elements | `100000` |
| `JUST_BASH_MAX_HEREDOC_SIZE` | Maximum heredoc size (bytes) | `10485760` |
| `JUST_BASH_MAX_SUBSTITUTION_DEPTH` | Maximum command substitution depth | `50` |
| `JUST_BASH_MAX_BRACE_EXPANSION_RESULTS` | Maximum brace expansion results | `10000` |
| `JUST_BASH_MAX_EXEC_OUTPUT_SIZE` | Maximum upstream stdout+stderr size (bytes) | `10485760` |
| `JUST_BASH_MAX_FILE_DESCRIPTORS` | Maximum open file descriptors | `1024` |
| `JUST_BASH_MAX_SOURCE_DEPTH` | Maximum `source`/`.` nesting depth | `100` |
| `JUST_BASH_MAX_SQLITE_TIMEOUT_MS` | SQLite timeout | `5000` |
| `JUST_BASH_MAX_PYTHON_TIMEOUT_MS` | Python timeout | `10000` |
| `JUST_BASH_ENABLE_PYTHON` | Enable Python3 via emscripten CPython (`true`/`false`) | `false` |
| `JUST_BASH_ENABLE_JAVASCRIPT` | Enable upstream `js-exec` via QuickJS (`true`/`false`) | `false` |
| `JUST_BASH_JAVASCRIPT_BOOTSTRAP` | Bootstrap JavaScript code before each `js-exec` invocation | - |
| `JUST_BASH_DEFENSE_IN_DEPTH` | Enable defense-in-depth mode (`true`/`false`) | `true` |
| `JUST_BASH_DEFENSE_IN_DEPTH_AUDIT` | Audit mode: log violations but don't block | `false` |
| `JUST_BASH_DEFENSE_IN_DEPTH_LOG` | Log violations to console | `false` |
| `JUST_BASH_MAX_FILE_READ_SIZE` | Max file read size for OverlayFs/ReadWriteFs | `10485760` |
| `JUST_BASH_PROCESS_INFO` | JSON object overriding virtual `{pid,ppid,uid,gid}` | - |
| `JUST_BASH_PID` / `JUST_BASH_PPID` / `JUST_BASH_UID` / `JUST_BASH_GID` | Individual virtual process-info overrides | - |
| `JUST_BASH_SANDBOX_TIMEOUT_MS` | Default timeout for `bash_sandbox_*` commands | - |
| `JUST_BASH_ALLOWED_COMMANDS` | Comma-separated command allow-list | all |
| `JUST_BASH_ENABLE_LOGGING` | Enable execution logging | `false` |
| `JUST_BASH_ENABLE_TRACING` | Enable performance tracing | `false` |

## Tools

### `bash`

Execute bash commands in the sandbox environment. This is the upstream-compatible MCP exposure of the `just-bash`/`bash-tool` execute interface and accepts the same single `command` argument.

```json
{
  "name": "bash",
  "arguments": {
    "command": "ls -la && cat package.json | head -5"
  }
}
```

### `bash_exec`

Execute a bash command in a fresh sandboxed environment. Supports upstream `exec()` options: `cwd`, `env`, `replaceEnv`, `stdin`, `stdinKind`, `args`, `rawScript`, and `timeoutMs` (plus MCP-friendly `stdinBase64` for byte stdin); initial files can be strings or `{content, encoding, mode, mtime}` objects.

```json
{
  "name": "bash_exec",
  "arguments": {
    "command": "echo 'Hello World' && ls -la",
    "files": { "/tmp/data.json": "{\"key\": \"value\"}" }
  }
}
```

### `bash_exec_persistent`

Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls and supports the same upstream `exec()` options as `bash_exec`.

### `bash_reset`

Reset the persistent bash environment, clearing all files and state.

### `bash_write_file` / `bash_read_file` / `bash_list_files`

File operations in the persistent environment. Read/write support `encoding: "utf-8" | "base64"` for byte-safe content.

### `bash_direct_read` / `bash_direct_write`

Direct filesystem read/write operations (bypass shell execution).

### `bash_info`

Get information about the bash environment configuration, including defense-in-depth violation stats.

### `bash_get_cwd` / `bash_get_env`

Get current working directory or environment variables.

### `bash_sandbox_*`

Persistent isolated-environment helpers:

- `bash_sandbox_run` - Run a command with optional structured output/logs
- `bash_sandbox_domain` - Get the current sandbox domain/identifier
- `bash_sandbox_write_files` - Write multiple files at once
- `bash_sandbox_read_file` - Read a file (supports base64 encoding)
- `bash_sandbox_mkdir` - Create a directory
- `bash_sandbox_extend_timeout` - Extend the sandbox timeout budget
- `bash_sandbox_stop` - Stop and clean up the sandbox state
- `bash_sandbox_reset` - Reset the sandbox state

### `bash_transform`

Transform a bash script with the upstream AST transform pipeline without executing it. Supports `CommandCollectorPlugin` and `TeePlugin` through `collectCommands` and `teeOutputDir`.

## Supported Commands

### File Operations
`cat`, `cp`, `file`, `ln`, `ls`, `mkdir`, `mv`, `readlink`, `rm`, `split`, `stat`, `touch`, `tree`

### Text Processing
`awk`, `base64`, `column`, `comm`, `cut`, `diff`, `expand`, `fold`, `grep` (+ `egrep`, `fgrep`), `head`, `join`, `md5sum`, `nl`, `od`, `paste`, `printf`, `rev`, `rg` (ripgrep), `sed`, `sha1sum`, `sha256sum`, `sort`, `strings`, `tac`, `tail`, `tr`, `unexpand`, `uniq`, `wc`, `xargs`

### Data Processing
`jq` (JSON), `js-exec` (JavaScript/TypeScript via QuickJS when enabled; `node` is a compatibility notice), `python3`/`python` (when enabled), `sqlite3` (SQLite), `xan` (CSV), `yq` (YAML/XML/TOML/CSV)

### Compression & Archives
`gzip` (+ `gunzip`, `zcat`), `tar`

### Navigation & Environment
`basename`, `cd`, `dirname`, `du`, `echo`, `env`, `export`, `find`, `hostname`, `printenv`, `pwd`, `tee`, `whoami`

### Shell Utilities
`alias`, `bash`, `chmod`, `clear`, `date`, `expr`, `false`, `help`, `history`, `seq`, `sh`, `sleep`, `time`, `timeout`, `true`, `unalias`, `which`

### Network Commands (when enabled)
`curl`, `html-to-markdown`

## Shell Features

- Pipes: `cmd1 | cmd2`
- Redirections: `>`, `>>`, `2>`, `2>&1`, `<`
- Command chaining: `&&`, `||`, `;`
- Variables: `$VAR`, `${VAR}`, `${VAR:-default}`
- Glob patterns: `*`, `?`, `[...]`, `**/*.ts`
- If/else, functions, loops (`for`, `while`, `until`)
- Symbolic and hard links

## Filesystem Examples

### OverlayFS (read from disk, write to memory)

```json
{
  "env": {
    "JUST_BASH_OVERLAY_ROOT": "/path/to/your/project"
  }
}
```

### ReadWriteFS (direct disk access)

```json
{
  "env": {
    "JUST_BASH_READ_WRITE_ROOT": "/path/to/sandbox"
  }
}
```

### MountableFS (multiple mounts)

```json
{
  "env": {
    "JUST_BASH_MOUNTS": "[{\"mountPoint\":\"/data\",\"root\":\"/shared/data\",\"type\":\"overlay\"},{\"mountPoint\":\"/workspace\",\"root\":\"/tmp/work\",\"type\":\"readwrite\"}]"
  }
}
```

## Network Access Examples

```json
{
  "env": {
    "JUST_BASH_ALLOW_NETWORK": "true",
    "JUST_BASH_ALLOWED_URLS": "https://api.github.com,https://api.example.com"
  }
}
```

Credential transforms from upstream `allowedUrlPrefixes` are available through `JUST_BASH_ALLOWED_URLS_JSON`:

```json
{
  "env": {
    "JUST_BASH_ALLOW_NETWORK": "true",
    "JUST_BASH_ALLOWED_URLS_JSON": "[{\"url\":\"https://api.example.com\",\"transform\":[{\"headers\":{\"Authorization\":\"Bearer token\"}}]}]"
  }
}
```

Setting `JUST_BASH_ALLOW_NETWORK=true` without either URL allow-list enables upstream's explicitly dangerous full-internet mode. Prefer an allow-list. Private/loopback blocking follows upstream's production default unless `JUST_BASH_DENY_PRIVATE_RANGES` is set explicitly.

## Security Model

- Virtual filesystem isolation (no real filesystem access by default)
- Execution limits protect against infinite loops and recursion
- No host binary execution; optional WASM runtimes (Python, JS, SQLite) are controlled by feature flags
- Network disabled by default; when configured, URL and method allow-lists are enforced
- **Defense-in-depth mode** (enabled by default, matching upstream): Monkey-patches dangerous JS globals (`Function`, `eval`, `setTimeout`, `process`, etc.) during script execution to block escape vectors
- **SecurityViolationLogger**: Tracks all defense-in-depth violations with full stats accessible via `bash_info`
- **Rich network error classification**: `NetworkAccessDeniedError`, `TooManyRedirectsError`, `RedirectNotAllowedError` for precise error messages

## Upstream API Coverage

This wrapper integrates the full public API surface of `just-bash` v3.1.0:

| Category | Exports Used |
|----------|-------------|
| Core | `Bash`, `BashOptions`, `ExecOptions`, `BashExecResult` |
| Commands | `CommandName`, `AllCommandName`, `getCommandNames`, `getNetworkCommandNames`, `getPythonCommandNames`, `getJavaScriptCommandNames` |
| Custom Commands | `defineCommand`, `CustomCommand`, `LazyCommand` |
| Encoding | `ByteString`, `decodeBytesToUtf8`, `encodeUtf8ToBytes`, `bytesOutput`, `textOutput`, `stdoutAsBytes`, `stdoutKind` |
| Filesystem | `InMemoryFs`, `OverlayFs`, `ReadWriteFs`, `MountableFs`, `IFileSystem` |
| Network | `NetworkConfig`, `AllowedUrlEntry`, `RequestTransform`, `SecureFetch`, `NetworkAccessDeniedError`, `TooManyRedirectsError`, `RedirectNotAllowedError` |
| Sandbox | `Sandbox`, `SandboxCommand`, `SandboxOptions`, `OutputMessage` |
| Security | `DefenseInDepthBox`, `SecurityViolationLogger`, `SecurityViolationError`, `createConsoleViolationCallback` |
| Transform | `BashTransformPipeline`, `CommandCollectorPlugin`, `TeePlugin`, `serialize`, transform result/types |
| Trace | `TraceCallback`, `TraceEvent` |

The package root re-exports the installed upstream `just-bash` public API for downstream consumers, and `src/types.ts` remains a direct wildcard passthrough.

## License

Apache-2.0
