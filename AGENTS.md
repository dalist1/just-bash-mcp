# Agent Instructions

<!-- tia-runtime-guidance:start -->
## Pi / tia usage guidance

- Prefer FFF-backed search tools: `find` for paths, `grep` for content, and `multi_grep` for OR searches. Use short bare identifiers plus constraints like `src/`, `*.ts`, or `*.{ts,tsx} !test/`; avoid shelling out to `rg`/`fd`/`find` unless FFF is unavailable.
- Use `tia pi` for full coding sessions: tools, sessions, extensions, FFF, fast-tools, skills/templates/themes, and normal pi behavior.
- Use `tia pi --mode json --no-session ...` only for stateless model-only streaming calls; it auto-routes to the slim `pi-stream-fast` path and skips tools/resources plus stock pi JSON compatibility.
- Do not force tool-using coding subagents through slim mode. For subagents that need tools or stock pi JSON events, use full JSON pi and reduce overhead with `--no-session --no-skills --no-prompt-templates --no-themes --no-context-files` where safe.
- For compatibility tests or consumers that need stock JSON events, disable the slim path with `TIA_DISABLE_FAST_STREAM=1`.
<!-- tia-runtime-guidance:end -->

## Comment Policy

- NEVER add comments to deleted code blocks.
- Do not add comments that reference context from the transcript.
- Avoid adding comments where not necessary.
