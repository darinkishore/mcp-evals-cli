# Release vX.Y.Z

Highlights

- Cliffy-based top-level CLI: import, import-one, status, ask, review, config
- Read-only viewer: H/L (←/→) navigation; ask (a); feedback (f)
- Shell completions: bash, zsh, fish
- Self-upgrade via GitHub provider

Install

- Stable (tagged):
  - `deno install -g -A -n evals https://raw.githubusercontent.com/darinkishore/mcp-evals-cli/vX.Y.Z/main.ts`
- Completions:
  - Bash: `source <(evals completions bash)`
  - Fish: `source (evals completions fish | psub)`
  - Zsh: `source <(evals completions zsh)`

Upgrade

- Latest: `evals upgrade`
- List versions: `evals upgrade -l`
- Specific: `evals upgrade --version vX.Y.Z`

Breaking Changes

- N/A

Notes

- `evals upgrade` requires at least one Git tag in this repository.
