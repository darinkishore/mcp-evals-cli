Evals CLI (Deno + Ink)

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
- config: View/edit persistent config (API URL, LangSmith keys).
- completions: Generate shell completions (bash, zsh, fish).
- upgrade: (temporarily disabled) Self-upgrade from GitHub releases.

Install
1) Ensure Deno v2+ is installed.
2) From repo root:
   deno install -A -n evals cli/deno/main.ts

Run
- Import batch:
  evals import --project-id=... --project-name=... --api-key=...
- Import single:
  evals import-one <trace_id>
- Status:
  evals status <trace_id>
- Ask:
  evals ask <trace_id> "What tools were available?"
- Review (TUI):
  evals review
  # or
  evals -r

Shell Completions
- Bash: source <(evals completions bash)
- Fish: source (evals completions fish | psub)
- Zsh:  source <(evals completions zsh)
  # or write to fpath: evals completions zsh > /path/to/zsh/site-functions/_evals

Upgrade (disabled for now)
- TODO: Once the public CLI repo exists and has tags/releases, wire
  GithubProvider(repository: "<public-user>/<public-repo>") in cli/deno/main.ts
  and re-enable the UpgradeCommand. For now:
  - evals upgrade  # prints a placeholder message

Permissions
- Network: backend API (EVAL_API_URL, default http://127.0.0.1:8001)
- Env: reads LANGSMITH_API_KEY, LANGSMITH_PROJECT_ID, EVAL_API_URL
- FS: optional config at ~/.eval/config.json

Config
- If LANGSMITH_API_KEY / project aren’t provided, import will prompt and store:
  ~/.eval/config.json
  Manage via:
  - evals config view
  - evals config set evalApiUrl http://127.0.0.1:8001
  - evals config set langsmithApiKey sk-...
  - evals config set langsmithProjectId <id>
  - evals config set langsmithProjectName <name>
  - evals config edit   # opens in $EDITOR (falls back to vi/notepad)
  - evals config path   # prints the config file path

Notes
- Colors/icons: ❌ failures, ✓ success, 🔧 issues, 📜 trace excerpt
- Review keys: f (feedback), s (skip), a (ask), n (next), q (quit)
