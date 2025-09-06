Eval CLI (Deno + Ink)

Overview
- Purpose: Review and improve agent trace evaluations via a fast TUI.
- Stack: Deno v2, npm:ink (React TUI), fetch-based HTTP client.
- Parity: Mirrors the Python CLI commands and interaction principles in cli/python/cli.md.

Commands
- import: Import a batch of traces (LangSmith → backend).
- import-one <trace_id>: Import a single trace by id.
- status <trace_id>: Show analysis/review readiness for a trace.
- ask <trace_id> <question...>: Ask about a stored trace.
- review: Interactive TUI review of pending traces (server-ordered).

Install
1) Ensure Deno v2+ is installed.
2) From repo root:
   deno install -A -n eval cli/deno/main.ts

Run
- Import batch:
  eval import --project-id=... --project-name=... --api-key=...
- Import single:
  eval import-one <trace_id>
- Status:
  eval status <trace_id>
- Ask:
  eval ask <trace_id> "What tools were available?"
- Review (TUI):
  eval review

Permissions
- Network: backend API (EVAL_API_URL, default http://127.0.0.1:8080)
- Env: reads LANGSMITH_API_KEY, LANGSMITH_PROJECT_ID, EVAL_API_URL
- FS: optional config at ~/.eval/config.json

Config
- If LANGSMITH_API_KEY / project aren’t provided, import will prompt and store:
  ~/.eval/config.json

Notes
- Colors/icons: ❌ failures, ✓ success, 🔧 issues, 📜 trace excerpt
- Review keys: f (feedback), s (skip), a (ask), n (next), q (quit)

