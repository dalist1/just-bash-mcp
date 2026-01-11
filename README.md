# just-bash-mcp

[![npm version](https://badge.fury.io/js/just-bash-mcp.svg)](https://www.npmjs.com/package/just-bash-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An MCP (Model Context Protocol) server that provides a sandboxed bash environment for AI agents.

Execute bash commands in a secure, isolated environment with an in-memory virtual filesystem.

Built on top of the [`just-bash`](https://github.com/vercel-labs/just-bash) library.

## Features

- **Sandboxed Execution**: Commands run in an isolated virtual filesystem
- **Stateless & Stateful Modes**: Choose between isolated executions or persistent filesystem
- **Network Access Control**: Optional network access with URL allow-lists
- **Execution Limits**: Protection against infinite loops and deep recursion
- **OverlayFS Support**: Mount real directories as read-only with copy-on-write

## Installation

### From npm (recommended)

```bash
# Using npm
npm install -g just-bash-mcp

# Using pnpm
pnpm add -g just-bash-mcp

# Using yarn
yarn global add just-bash-mcp
```

### From source

```bash
git clone https://github.com/dalist1/just-bash-mcp.git
cd just-bash-mcp
npm install
npm run build
```

## Usage

### Running the Server

```bash
# If installed globally
just-bash-mcp

# From source with npm
npm start

# From source with npm (development)
npm run dev
```

## MCP Client Configuration

### Using npx (no installation required)

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
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
      "args": ["-y", "just-bash-mcp"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (Settings → MCP Servers):

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

### VS Code (Roo Code / Cline)

Add to your MCP settings file:
- **Roo Code**: `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-code/settings/mcp_settings.json`
- **Cline**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "npx",
      "args": ["-y", "just-bash-mcp"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

### Using Global Installation

If you've installed globally, you can use the binary directly:

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "just-bash-mcp",
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

### Using Local Installation

For development or local installations:

```json
{
  "mcpServers": {
    "just-bash": {
      "command": "node",
      "args": ["/path/to/just-bash-mcp/build/index.js"],
      "env": {
        "JUST_BASH_ALLOW_NETWORK": "false"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JUST_BASH_CWD` | Initial working directory | `/home/user` |
| `JUST_BASH_OVERLAY_ROOT` | Real directory to mount as overlay (read-only) | - |
| `JUST_BASH_ALLOW_NETWORK` | Enable network access (`true`/`false`) | `false` |
| `JUST_BASH_ALLOWED_URLS` | Comma-separated URL prefixes to allow | - |
| `JUST_BASH_ALLOWED_METHODS` | Comma-separated HTTP methods to allow | `GET,HEAD` |
| `JUST_BASH_MAX_CALL_DEPTH` | Maximum function recursion depth | `100` |
| `JUST_BASH_MAX_COMMAND_COUNT` | Maximum total commands per execution | `10000` |
| `JUST_BASH_MAX_LOOP_ITERATIONS` | Maximum iterations per loop | `10000` |

## Tools

### `bash_exec`

Execute a bash command in a sandboxed environment. Each execution is isolated.

**Parameters:**
- `command` (required): The bash command to execute
- `cwd` (optional): Working directory for the command
- `env` (optional): Environment variables to set
- `files` (optional): Files to create before execution (path → content)

**Example:**
```json
{
  "name": "bash_exec",
  "arguments": {
    "command": "echo 'Hello World' && ls -la",
    "files": {
      "/tmp/data.json": "{\"key\": \"value\"}"
    }
  }
}
```

### `bash_exec_persistent`

Execute a bash command in a persistent sandboxed environment. The filesystem persists across calls.

**Parameters:**
- `command` (required): The bash command to execute
- `cwd` (optional): Working directory for the command
- `env` (optional): Environment variables to set

### `bash_reset`

Reset the persistent bash environment, clearing all files and state.

### `bash_write_file`

Write content to a file in the persistent bash environment.

**Parameters:**
- `path` (required): The file path to write to
- `content` (required): The content to write

### `bash_read_file`

Read content from a file in the persistent bash environment.

**Parameters:**
- `path` (required): The file path to read

### `bash_list_files`

List files and directories in the persistent bash environment.

**Parameters:**
- `path` (optional): Directory path to list (defaults to `.`)
- `recursive` (optional): Whether to list recursively
- `showHidden` (optional): Whether to show hidden files

### `bash_info`

Get information about the bash environment configuration.

## Supported Commands

### File Operations
`cat`, `cp`, `file`, `ln`, `ls`, `mkdir`, `mv`, `readlink`, `rm`, `stat`, `touch`, `tree`

### Text Processing
`awk`, `base64`, `comm`, `cut`, `diff`, `grep` (+ `egrep`, `fgrep`), `head`, `jq`, `md5sum`, `od`, `paste`, `printf`, `sed`, `sha1sum`, `sha256sum`, `sort`, `tac`, `tail`, `tr`, `uniq`, `wc`, `xargs`

### Database
`sqlite3`

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
- Positional parameters: `$1`, `$2`, `$@`, `$#`
- Glob patterns: `*`, `?`, `[...]`
- If statements: `if COND; then CMD; elif COND; then CMD; else CMD; fi`
- Functions: `function name { ... }` or `name() { ... }`
- Local variables: `local VAR=value`
- Loops: `for`, `while`, `until`
- Symbolic links: `ln -s target link`
- Hard links: `ln target link`

## Network Access Examples

### Allow specific URLs (safest)

```json
{
  "env": {
    "JUST_BASH_ALLOW_NETWORK": "true",
    "JUST_BASH_ALLOWED_URLS": "https://api.github.com,https://api.example.com/v1/"
  }
}
```

### Allow specific URLs with POST

```json
{
  "env": {
    "JUST_BASH_ALLOW_NETWORK": "true",
    "JUST_BASH_ALLOWED_URLS": "https://api.example.com",
    "JUST_BASH_ALLOWED_METHODS": "GET,HEAD,POST"
  }
}
```

### Full internet access (use with caution)

```json
{
  "env": {
    "JUST_BASH_ALLOW_NETWORK": "true"
  }
}
```

## OverlayFS Example

Mount a real project directory as read-only:

```json
{
  "env": {
    "JUST_BASH_OVERLAY_ROOT": "/path/to/your/project"
  }
}
```

The agent can read files from the real filesystem, but all writes stay in memory.

## Security Model

- The shell only has access to the provided virtual filesystem
- Execution is protected against infinite loops and deep recursion
- No binary or WASM execution support
- Network access is disabled by default
- When enabled, network requests are checked against URL and HTTP method allow-lists

## License

Apache-2.0
