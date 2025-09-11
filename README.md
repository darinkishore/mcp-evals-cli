Evals CLI (Deno + Ink)

Overview

- Purpose: Review and improve agent trace evaluations via a fast TUI.
- Stack: Deno v2, npm:ink (React TUI), fetch-based HTTP client.
- Parity: Mirrors the Python CLI commands and interaction principles in
  cli/python/cli.md.

Commands

- import: Import a batch of traces (LangSmith → backend).
- import-one <trace_id>: Import a single trace by id.
- status <trace_id>: Show analysis/review readiness for a trace.
- ask <trace_id> <question...>: Ask about a stored trace.
- review: Interactive TUI viewer for traces (read-only navigation).
- config: View/edit persistent config (API URL, LangSmith keys).
- completions: Generate shell completions (bash, zsh, fish).
- upgrade: Self-upgrade from GitHub (after first tag).

Install

1. Ensure Deno v2+ is installed.
2. Public (stable) install from tag: deno install -g -A -n evals
   https://raw.githubusercontent.com/darinkishore/mcp-evals-cli/v0.1.0/main.ts
   # Replace v0.1.0 with the latest release tag
3. Monorepo (dev) install from this repo: deno install -g -A -n evals
   cli/deno/main.ts

Run

- Import batch: evals import --project-id=... --project-name=... --api-key=...
- Import single: evals import-one <trace_id>
- Status: evals status <trace_id>
- Ask: evals ask <trace_id> "What tools were available?"
- Review (TUI): evals review
  # or
  evals -r
  # failures-only mode (failed requirements or CRITICAL/HIGH/MEDIUM issues, prioritized):
  evals review -f
  # or
  evals -r -f

Shell Completions

- Bash: source <(evals completions bash)
- Fish: source (evals completions fish | psub)
- Zsh: source <(evals completions zsh)
  # or write to fpath: evals completions zsh > /path/to/zsh/site-functions/_evals

Upgrade

- After the first tagged release (e.g., v0.1.0):
  - Latest: evals upgrade
  - List versions: evals upgrade -l
  - Specific: evals upgrade --version v0.1.0 Note: evals upgrade requires at
    least one Git tag in the public repo.

Permissions

- Network: backend API (EVAL_API_URL, default http://127.0.0.1:8001)
- Env: reads LANGSMITH_API_KEY, LANGSMITH_PROJECT_ID, EVAL_API_URL
- FS: optional config at ~/.eval/config.json

Config

- If LANGSMITH_API_KEY / project aren’t provided, import will prompt and store:
  ~/.eval/config.json Manage via:
  - evals config view
  - evals config set evalApiUrl http://127.0.0.1:8001
  - evals config set langsmithApiKey sk-...
  - evals config set langsmithProjectId <id>
  - evals config set langsmithProjectName <name>
  - evals config edit # opens in $EDITOR (falls back to vi/notepad)
  - evals config path # prints the config file path

Notes

- Colors/icons: ❌ failures, ✓ success, 🔧 issues, 📜 trace excerpt
- Viewer keys: h/← (prev), l/→ (next), f (feedback), a (ask), q (quit)
- Skip/next workflow actions are disabled; navigation uses H/L only.
- Ordering: chronological by creation time (newest first by default).
- Failures-only mode (-f): includes traces with any failed requirements OR any
  CRITICAL/HIGH/MEDIUM issues; excludes LOW-only. Priority within -f: Tier 0
  (failed requirements or CRITICAL), then Tier 1 (HIGH), then Tier 2 (MEDIUM).
  Ties: in Tier 0, more failed requirements first, then more CRITICAL; in Tier
  1, more HIGH; in Tier 2, more MEDIUM; otherwise keep arrival order.
