
# Evals CLI (Deno + Ink)

## Overview

- **Purpose**: Review and improve agent trace evaluations via a fast TUI.  
- **Stack**: Deno v2, `npm:ink` (React TUI), fetch-based HTTP client.  
- **Parity**: Mirrors the Python CLI commands and interaction principles in [`cli/python/cli.md`](cli/python/cli.md).  

## Commands

- `import` — Import a batch of traces (LangSmith → backend).  
- `import-one <trace_id>` — Import a single trace by ID.  
- `status <trace_id>` — Show analysis/review readiness for a trace.  
- `ask <trace_id> <question...>` — Ask about a stored trace.  
- `review` — Interactive TUI viewer for traces (read-only navigation).  
- `config` — View/edit persistent config (API URL, LangSmith keys).  
- `completions` — Generate shell completions (bash, zsh, fish).  
- `upgrade` — Self-upgrade from GitHub (after first tag).  

## Install

1. Ensure **Deno v2+** is installed.  
2. Public (stable) install from tag:  
   ```sh
   deno install --global --force --allow-all \
     -n evals \
     https://raw.githubusercontent.com/darinkishore/mcp-evals-cli/v0.2.5/main.ts
````

Replace `v0.2.5` with the latest release tag.
*Upgrading from v0.1.x?* Re-run the install command once to enable in-place upgrades.
3\. Monorepo (dev) install from this repo:

```sh
deno install -g -A --config cli/deno/deno.jsonc -n evals cli/deno/main.ts
```

## Run

* Import batch:

  ```sh
  evals import --project-id=... --project-name=... --api-key=...
  ```
* Import single:

  ```sh
  evals import-one <trace_id>
  ```
* Status:

  ```sh
  evals status <trace_id>
  ```
* Ask:

  ```sh
  evals ask <trace_id> "What tools were available?"
  ```
* Review (TUI):

  ```sh
  evals review
  # or
  evals -r
  # failures-only mode:
  evals review -f
  # or
  evals -r -f
  ```

## Shell Completions

* **Bash**:

  ```sh
  source <(evals completions bash)
  ```
* **Fish**:

  ```sh
  source (evals completions fish | psub)
  ```
* **Zsh**:

  ```sh
  source <(evals completions zsh)
  # or write to fpath:
  evals completions zsh > /path/to/zsh/site-functions/_evals
  ```

## Upgrade

After the first tagged release (e.g., `v0.2.5`):

* Latest:

  ```sh
  evals upgrade
  ```
* List versions:

  ```sh
  evals upgrade -l
  ```
* Specific version:

  ```sh
  evals upgrade --version v0.2.5
  ```

> **Note**: `evals upgrade` requires at least one Git tag in the public repo.

## Permissions

* **Network**: backend API (`EVAL_API_URL`, default `http://127.0.0.1:8001`)
* **Env**: reads `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT_ID`, `EVAL_API_URL`
* **FS**: optional config at `~/.eval/config.json`

## Config

If `LANGSMITH_API_KEY` / project aren’t provided, `import` will prompt and store them in `~/.eval/config.json`.

Manage via:

```sh
evals config view
evals config set evalApiUrl http://127.0.0.1:8001
evals config set langsmithApiKey sk-...
evals config set langsmithProjectId <id>
evals config set langsmithProjectName <name>
evals config edit   # opens in $EDITOR (falls back to vi/notepad)
evals config path   # prints the config file path
```

## Notes

* **Colors/icons**:

  * ❌ failures
  * ✓ success
  * 🔧 issues
  * 📜 trace excerpt
* **Viewer keys**:

  * `h`/← (prev)
  * `l`/→ (next)
  * `f` (feedback)
  * `a` (ask)
  * `q` (quit)
* Skip/next workflow actions are disabled; navigation uses `H`/`L` only.
* Ordering: chronological by creation time (newest first by default).
* **Failures-only mode (`-f`)**:

  * Includes traces with any failed requirements **OR** any CRITICAL/HIGH/MEDIUM issues.
  * Excludes LOW-only.
  * Priority within `-f`:

    * **Tier 0**: failed requirements or CRITICAL
    * **Tier 1**: HIGH
    * **Tier 2**: MEDIUM
  * Ties:

    * Tier 0: more failed requirements first, then more CRITICAL
    * Tier 1: more HIGH
    * Tier 2: more MEDIUM
    * Otherwise, arrival order

