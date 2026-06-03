#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RESULT_DIR="${ROOT_DIR}/bench/results"
RUNS="${RUNS:-40}"
WARMUP="${WARMUP:-5}"
SHELL_BIN="${SHELL_BIN:-bash}"

mkdir -p "${RESULT_DIR}"

run_suite() {
	local name="$1"
	local script_path="$2"
	local markdown_path="${RESULT_DIR}/${name}.md"
	local json_path="${RESULT_DIR}/${name}.json"

	hyperfine \
		--warmup "${WARMUP}" \
		--runs "${RUNS}" \
		--export-markdown "${markdown_path}" \
		--export-json "${json_path}" \
		--command-name "bash -lc" \
		"bash \"${ROOT_DIR}/bench/run-scenario.sh\" bash-lc \"${script_path}\"" \
		--command-name "bash < stdin" \
		"bash \"${ROOT_DIR}/bench/run-scenario.sh\" bash-stdin \"${script_path}\"" \
		--command-name "bun stdin -> bash -lc" \
		"bash \"${ROOT_DIR}/bench/run-scenario.sh\" bun-stdin-lc \"${script_path}\"" \
		--command-name "bun stdin -> bash < stdin" \
		"bash \"${ROOT_DIR}/bench/run-scenario.sh\" bun-stdin-shell-stdin \"${script_path}\""
}

cat > "${RESULT_DIR}/scenario-trivial.sh" <<'EOF'
:
EOF

cat > "${RESULT_DIR}/scenario-builtins.sh" <<'EOF'
pwd >/dev/null
printf '%s\n' alpha beta gamma delta >/dev/null
EOF

cat > "${RESULT_DIR}/scenario-pipeline.sh" <<'EOF'
seq 1 5000 | paste -sd+ - | wc -c >/dev/null
seq 1 5000 | wc -l >/dev/null
EOF

cat > "${RESULT_DIR}/scenario-file-io.sh" <<'EOF'
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT
for n in $(seq 1 50); do
	printf 'line-%s\n' "$n" >> "${tmp_dir}/data.txt"
done
sort "${tmp_dir}/data.txt" >/dev/null
wc -l < "${tmp_dir}/data.txt" >/dev/null
rm -rf "${tmp_dir}"
trap - EXIT
EOF

cat > "${RESULT_DIR}/scenario-batch-50.sh" <<'EOF'
for _ in $(seq 1 50); do
	pwd >/dev/null
done
EOF

run_suite "trivial" "${RESULT_DIR}/scenario-trivial.sh"
run_suite "builtins" "${RESULT_DIR}/scenario-builtins.sh"
run_suite "pipeline" "${RESULT_DIR}/scenario-pipeline.sh"
run_suite "file-io" "${RESULT_DIR}/scenario-file-io.sh"
run_suite "batch-50" "${RESULT_DIR}/scenario-batch-50.sh"

printf 'Wrote benchmark artifacts to %s\n' "${RESULT_DIR}"
