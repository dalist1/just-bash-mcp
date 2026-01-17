# just-bash-mcp

[![npm version](https://img.shields.io/npm/v/just-bash-mcp.svg)](https://www.npmjs.com/package/just-bash-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An MCP (Model Context Protocol) server that provides a sandboxed bash environment for AI agents.

Execute bash commands in a secure, isolated environment with an in-memory virtual filesystem.

Built on top of [`just-bash`](https://github.com/vercel-labs/just-bash) v2.5.2.

## What's New in v2.1.0

- **`rg` (ripgrep)** - Fast regex search with `--files`, `-d`, `--stats`, `-t markdown`
- **`tar`** - Archive support with compression
- **MountableFS** - Mount multiple filesystems at different paths
- **ReadWriteFS** - Direct read-write access to real directories
- **Multi-level glob patterns** - Improved `**/*.ts` style matching

## Features

- **Sandboxed Execution**: Commands run in an isolated virtual filesystem
- **Stateless & Stateful Modes**: Choose between isolated executions or persistent filesystem
- **Network Access Control**: Optional network access with URL allow-lists
- **Execution Limits**: Protection against infinite loops and deep recursion
- **OverlayFS Support**: Mount real directories as read-only with copy-on-write
- **MountableFS Support**: Mount multiple filesystems at different paths
- **ReadWriteFS Support**: Direct read-write access to real directories

## Installation

### From npm (recommended)

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
bun run build
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
| `JUST_BASH_OVERLAY_ROOT` | Real directory to mount as overlay (read-only) | - |
| `JUST_BASH_READ_WRITE_ROOT` | Real directory with read-write access | - |
| `JUST_BASH_MOUNTS` | JSON array of mount configurations | - |
| `JUST_BASH_ALLOW_NETWORK` | Enable network access (`true`/`false`) | `false` |
| `JUST_BASH_ALLOWED_URLS` | Comma-separated URL prefixes to allow | - |
| `JUST_BASH_ALLOWED_METHODS` | Comma-separated HTTP methods to allow | `GET,HEAD` |
| `JUST_BASH_MAX_REDIRECTS` | Maximum HTTP redirects | `20` |
| `JUST_BASH_NETWORK_TIMEOUT_MS` | Network timeout in milliseconds | `30000` |
| `JUST_BASH_MAX_OUTPUT_LENGTH` | Maximum output length | `30000` |
| `JUST_BASH_MAX_CALL_DEPTH` | Maximum function recursion depth | `100` |
| `JUST_BASH_MAX_COMMAND_COUNT` | Maximum total commands per execution | `10000` |
| `JUST_BASH_MAX_LOOP_ITERATIONS` | Maximum iterations per loop | `10000` |

## Tools

### `bash_exec`

Execute a bash command in a sandboxed environment. Each execution is isolated.

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

Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls.

### `bash_reset`

Reset the persistent bash environment, clearing all files and state.

### `bash_write_file` / `bash_read_file` / `bash_list_files`

File operations in the persistent environment.

### `bash_info`

Get information about the bash environment configuration.

## Supported Commands

### File Operations
`cat`, `cp`, `file`, `ln`, `ls`, `mkdir`, `mv`, `readlink`, `rm`, `split`, `stat`, `touch`, `tree`

### Text Processing
`awk`, `base64`, `column`, `comm`, `cut`, `diff`, `expand`, `fold`, `grep` (+ `egrep`, `fgrep`), `head`, `join`, `md5sum`, `nl`, `od`, `paste`, `printf`, `rev`, `rg` (ripgrep), `sed`, `sha1sum`, `sha256sum`, `sort`, `strings`, `tac`, `tail`, `tr`, `unexpand`, `uniq`, `wc`, `xargs`

### Data Processing
`jq` (JSON), `sqlite3` (SQLite), `xan` (CSV), `yq` (YAML/XML/TOML)

### Compression & Archives
`gzip` (+ `gunzip`, `zcat`), `tar`

### Navigation & Environment
`basename`, `cd`, `dirname`, `du`, `echo`, `env`, `export`, `find`, `hostname`, `printenv`, `pwd`, `tee`

### Shell Utilities
`alias`, `bash`, `chmod`, `clear`, `date`, `expr`, `false`, `help`, `history`, `seq`, `sh`, `sleep`, `timeout`, `true`, `unalias`, `which`

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

## Security Model

- Virtual filesystem isolation (no real filesystem access by default)
- Execution limits protect against infinite loops and recursion
- No binary/WASM execution
- Network disabled by default; when enabled, URL and method allow-lists enforced

## License

Apache-2.0
