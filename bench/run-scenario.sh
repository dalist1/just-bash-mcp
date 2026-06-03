#!/usr/bin/env bash

set -euo pipefail

MODE="${1:?missing mode}"
SCRIPT_PATH="${2:?missing script path}"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SHELL_BIN="${SHELL_BIN:-bash}"

case "${MODE}" in
	bash-lc)
		"${SHELL_BIN}" -lc "$(<"${SCRIPT_PATH}")"
		;;
	bash-stdin)
		cat "${SCRIPT_PATH}" | "${SHELL_BIN}"
		;;
	bun-stdin-lc)
		cat "${SCRIPT_PATH}" | bun "${ROOT_DIR}/bench/command-via-stdin.ts" --mode=spawn-lc --shell="${SHELL_BIN}"
		;;
	bun-stdin-shell-stdin)
		cat "${SCRIPT_PATH}" | bun "${ROOT_DIR}/bench/command-via-stdin.ts" --mode=spawn-stdin --shell="${SHELL_BIN}"
		;;
	*)
		printf 'Unsupported mode: %s\n' "${MODE}" >&2
		exit 1
		;;
esac
