#!/usr/bin/env -S deno run -A --config cli/deno/deno.jsonc
// deno-lint-ignore-file no-explicit-any
import chalk from "chalk";

import { Command } from "@cliffy/command";
import { CompletionsCommand } from "@cliffy/command/completions";
import { UpgradeCommand } from "@cliffy/command/upgrade";
import { GithubProvider } from "@cliffy/command/upgrade/provider/github";

import {
  createWorkspace,
  getCurrentWorkspace as fetchCurrentWorkspace,
  getExperimentStatus,
  importBatch,
  importExperiment,
  listWorkspaces as fetchWorkspaces,
  syncWorkspace,
} from "./src/api.ts";
import {
  type EvalConfig,
  getConfigPath,
  mask,
  openConfigInEditor,
  readConfig,
  resolveEvalAuth,
  setConfigKey,
  unsetConfigKey,
  updateConfig,
} from "./src/config.ts";
import type { WorkspaceSummary } from "./src/types.ts";

const VERSION = "v0.2.0";

async function runReview(opts?: { failuresOnly?: boolean }) {
  // Ensure consistent dev/prod selection for React/Reconciler
  const procEnv = (globalThis as any)?.process?.env;
  try {
    if (procEnv && !("NODE_ENV" in procEnv)) procEnv.NODE_ENV = "development";
  } catch { /* ignore */ }

  // Lazy-load Ink and React only when needed to avoid TTY rawMode issues
  const [{ default: React }, { render }, { default: FullScreenApp }] =
    await Promise.all([
      import("react"),
      import("ink"),
      import("./src/ui/FullScreenApp.tsx"),
    ]);

  // Guard against mismatched React version (Ink v6 needs React 19)
  if (
    !(React as any)
      ?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  ) {
    throw new Error(
      "React 19 not resolved at runtime (missing __CLIENT_INTERNALS...). " +
        "Try: deno cache --reload cli/deno/main.ts, then reinstall with deno install -f -A --config cli/deno/deno.jsonc -n evals cli/deno/main.ts.",
    );
  }

  const proc: any = (globalThis as any).process;
  const write = (s: string) => {
    try {
      if (proc?.stdout?.isTTY && proc?.stdout?.write) proc.stdout.write(s);
    } catch {
      // ignore
    }
  };
  const enterAlt = () => write("\x1b[?1049h");
  const leaveAlt = () => write("\x1b[?1049l");

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    leaveAlt();
  };

  // Install signal handlers for robust restore
  const denoHasSignals = typeof (Deno as any)?.addSignalListener === "function";
  const denoAdd = (sig: string, fn: () => void) => {
    try {
      (Deno as any).addSignalListener?.(sig, fn);
    } catch { /* ignore */ }
  };
  const denoRemove = (sig: string, fn: () => void) => {
    try {
      (Deno as any).removeSignalListener?.(sig, fn);
    } catch { /* ignore */ }
  };
  const nodeOn = (ev: string, fn: () => void) => {
    try {
      proc?.on?.(ev, fn);
    } catch { /* ignore */ }
  };
  const nodeOff = (ev: string, fn: () => void) => {
    try {
      proc?.off?.(ev, fn);
    } catch { /* ignore */ }
  };

  const onSigInt = () => cleanup();
  const onSigTerm = () => cleanup();
  if (denoHasSignals) {
    denoAdd("SIGINT", onSigInt);
    denoAdd("SIGTERM", onSigTerm);
  }
  nodeOn("SIGINT", onSigInt);
  nodeOn("SIGTERM", onSigTerm);

  enterAlt();
  const ink = render(
    React.createElement(FullScreenApp, { failuresOnly: !!opts?.failuresOnly }),
  );
  try {
    await (ink as any).waitUntilExit?.();
  } finally {
    cleanup();
    if (denoHasSignals) {
      denoRemove("SIGINT", onSigInt);
      denoRemove("SIGTERM", onSigTerm);
    }
    nodeOff("SIGINT", onSigInt);
    nodeOff("SIGTERM", onSigTerm);
  }
}

function printWorkspaceSummary(
  workspace: WorkspaceSummary,
  currentId?: string,
) {
  const isCurrent = currentId && workspace.id === currentId;
  const bullet = isCurrent ? chalk.green("•") : " ";
  const name = isCurrent ? chalk.green(workspace.name) : workspace.name;
  const sync = workspace.autoSyncEnabled ? chalk.cyan(" [auto-sync]") : "";
  console.log(`${bullet} ${name} (${workspace.id})${sync}`);
}

const cmd = new Command()
  .name("evals")
  .version(VERSION)
  .description("Evals CLI (Deno + Ink)")
  .globalOption("-r, --review", "Open the trace viewer (read-only)")
  .globalOption(
    "-f, --failures",
    "Show only failed requirements or CRITICAL/HIGH/MEDIUM issues with priority",
  )
  .action(async (options) => {
    if (options.review) {
      await resolveEvalAuth(); // ensure workspace/API key configured
      await runReview({ failuresOnly: !!options.failures });
    } else {
      await cmd.showHelp();
    }
  });

cmd
  .command("import")
  .description("Import LangSmith data into the selected workspace")
  .option(
    "--experiment <name:string>",
    "Import a LangSmith experiment run (project name)",
  )
  .option(
    "--label <label:string>",
    "Evaluation label when importing an experiment",
  )
  .option("--workspace <id:string>", "Override workspace for this command")
  .action(async (options) => {
    const cfg = await readConfig();
    if (options.experiment) {
      const res = await importExperiment(
        {
          experimentName: options.experiment,
          label: options.label,
        },
        { workspaceOverride: options.workspace },
      );
      console.log(
        chalk.bold(
          `Imported experiment ${res.experimentName} (evaluation ${res.evaluationId})`,
        ),
      );
      console.log(
        `Imported ${res.imported} trace(s); status ${res.status} (${res.completedTraces}/${res.totalTraces} ready).`,
      );
      const workspaceHint = res.workspaceId ?? options.workspace ??
        cfg.workspaceId;
      if (workspaceHint) {
        console.log(`Workspace: ${chalk.cyan(workspaceHint)}`);
      }
      const projectParts: string[] = [];
      if (res.projectName) projectParts.push(res.projectName);
      if (res.projectId) projectParts.push(`(${res.projectId})`);
      if (projectParts.length) {
        console.log(`Project: ${projectParts.join(" ")}`);
      }
      if (res.langsmithDatasetId) {
        console.log(`LangSmith dataset: ${res.langsmithDatasetId}`);
      }
      if (res.reviewUrl) {
        console.log(`Review URL: ${chalk.cyan(res.reviewUrl)}`);
      }
      return;
    }

    const res = await importBatch(
      {},
      { workspaceOverride: options.workspace },
    );
    console.log(
      chalk.bold(
        `Imported ${res.imported} trace(s) from ${
          res.projectName ?? "(default)"
        }`,
      ),
    );
    const workspaceHint = options.workspace ?? cfg.workspaceId;
    if (workspaceHint) {
      console.log(`Workspace: ${chalk.cyan(workspaceHint)}`);
    }
    if (res.traces?.length) {
      console.log("Examples:");
      for (const t of res.traces.slice(0, Math.min(5, res.traces.length))) {
        console.log(
          `  • ${t.traceId}  ${t.firstUserMessage?.slice(0, 60) ?? ""}`,
        );
      }
    }
    console.log(`\nOpen viewer: ${chalk.cyan("evals review")}`);
  });

cmd
  .command("review")
  .description("Interactive trace viewer (read-only navigation)")
  .option(
    "-f, --failures",
    "Show only failed requirements or CRITICAL/HIGH/MEDIUM issues with priority",
  )
  .option(
    "--experiment <name:string>",
    "Only launch when the experiment's latest run is completed",
  )
  .action(async (options) => {
    await resolveEvalAuth();
    const experimentName = options.experiment as string | undefined;
    if (experimentName) {
      try {
        const status = await getExperimentStatus(experimentName);
        if (status.status !== "completed") {
          console.log(
            chalk.yellow(
              `Experiment ${experimentName} is ${status.status} (${status.completedTraces}/${status.totalTraces} traces ready). Retry once processing finishes.`,
            ),
          );
          return;
        }
      } catch (err) {
        console.error(
          chalk.red(
            `Unable to load experiment status: ${(err as Error).message}`,
          ),
        );
        return;
      }
    }
    await runReview({ failuresOnly: !!options.failures });
  });

const configCmd = new Command()
  .description("View and edit persistent config");

configCmd
  .command("view")
  .description("Print config path and current values")
  .action(async () => {
    const cfg = await readConfig();
    const masked: EvalConfig = {
      ...cfg,
      langsmithApiKey: mask(cfg.langsmithApiKey),
      evalApiKey: mask(cfg.evalApiKey),
    };
    console.log(chalk.bold("Config path:"), getConfigPath());
    console.log(JSON.stringify(masked, null, 2));
  });

configCmd
  .command("set <key:string> <value...:string>")
  .description("Set a config key to a value")
  .action(async (_options, key: string, ...vparts: string[]) => {
    const allowed = [
      "langsmithApiKey",
      "langsmithProjectId",
      "langsmithProjectName",
      "evalApiUrl",
      "evalApiKey",
      "workspaceId",
    ];
    if (!allowed.includes(key)) {
      console.log(
        "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl, evalApiKey, workspaceId",
      );
      return;
    }
    const value = vparts.join(" ");
    await setConfigKey(key as keyof EvalConfig, value);
    console.log("Updated", key);
  });

configCmd
  .command("unset <key:string>")
  .description("Unset a config key")
  .action(async (_options, key: string) => {
    const allowed = [
      "langsmithApiKey",
      "langsmithProjectId",
      "langsmithProjectName",
      "evalApiUrl",
      "evalApiKey",
      "workspaceId",
    ];
    if (!allowed.includes(key)) {
      console.log(
        "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl, evalApiKey, workspaceId",
      );
      return;
    }
    await unsetConfigKey(key as keyof EvalConfig);
    console.log("Removed", key);
  });

configCmd
  .command("edit")
  .description("Open the config file in $EDITOR")
  .action(async () => {
    try {
      await openConfigInEditor();
    } catch (e) {
      console.error("Failed to open editor:", (e as Error).message);
      console.log("Edit manually:", getConfigPath());
    }
  });

configCmd
  .command("path")
  .description("Print the config file path")
  .action(() => {
    console.log(getConfigPath());
  });

cmd.command("config", configCmd);

const workspaceCmd = new Command()
  .description("Manage backend workspaces");

workspaceCmd
  .command("list")
  .description("List available workspaces")
  .action(async () => {
    await resolveEvalAuth({ requireWorkspace: false });
    const cfg = await readConfig();
    const workspaces = await fetchWorkspaces();
    if (!workspaces.length) {
      console.log(
        "No workspaces found. Use `evals workspace create` to add one.",
      );
      return;
    }
    for (const ws of workspaces) {
      printWorkspaceSummary(ws, cfg.workspaceId);
    }
  });

workspaceCmd
  .command("current")
  .description("Show the currently selected workspace")
  .action(async () => {
    const { workspaceId } = await resolveEvalAuth();
    const info = await fetchCurrentWorkspace();
    printWorkspaceSummary(info, workspaceId);
  });

workspaceCmd
  .command("use <workspaceId:string>")
  .description("Set the current workspace ID")
  .action(async (_options, workspaceId: string) => {
    await updateConfig({ workspaceId });
    console.log("Current workspace set to", workspaceId);
  });

workspaceCmd
  .command("sync")
  .description("Trigger a manual LangSmith sync for a workspace")
  .option("--workspace <id:string>", "Workspace to sync (defaults to current)")
  .option("--lookback-hours <h:number>", "Lookback window in hours")
  .option("--limit <n:number>", "Limit number of runs")
  .option(
    "--project-id <id:string>",
    "Override LangSmith project ID for this sync",
  )
  .option(
    "--project-name <name:string>",
    "Override LangSmith project name for this sync",
  )
  .action(async (options) => {
    const workspaceId = options.workspace ??
      (await resolveEvalAuth()).workspaceId;
    if (!workspaceId) {
      throw new Error(
        "No workspace selected. Use `evals workspace use <id>` first.",
      );
    }
    const payload: {
      lookbackHours?: number;
      limit?: number;
      projectId?: string;
      projectName?: string;
    } = {};
    if (options.lookbackHours !== undefined) {
      payload.lookbackHours = Number(options.lookbackHours);
    }
    if (options.limit !== undefined) payload.limit = Number(options.limit);
    if (options.projectId !== undefined) {
      payload.projectId = String(options.projectId);
    }
    if (options.projectName !== undefined) {
      payload.projectName = String(options.projectName);
    }
    const res = await syncWorkspace(workspaceId, payload);
    console.log(
      chalk.bold(
        `Sync requested for workspace ${workspaceId} (event ${res.emitted})`,
      ),
    );
    if (payload.projectId || payload.projectName) {
      const parts: string[] = [];
      if (payload.projectId) parts.push(`id=${payload.projectId}`);
      if (payload.projectName) parts.push(`name=${payload.projectName}`);
      console.log(`Project override: ${parts.join(", ")}`);
    }
  });

workspaceCmd
  .command("create")
  .description("Create or update a workspace without rotating the API key")
  .option("--name <name:string>", "Workspace name")
  .option("--langsmith-api-key <key:string>", "LangSmith API key to associate")
  .option("--auto-sync", "Enable auto sync for this workspace")
  .option("--project-id <id:string>", "Default LangSmith project ID")
  .option("--project-name <name:string>", "Default LangSmith project name")
  .option("--use", "Set the created workspace as current")
  .action(async (options) => {
    const name = options.name ?? prompt("Workspace name:") ?? "";
    if (!name.trim()) throw new Error("Workspace name is required");
    const lsKey = options.langsmithApiKey ?? prompt("LangSmith API key:") ?? "";
    if (!lsKey.trim()) throw new Error("LangSmith API key is required");
    if (options.autoSync && !options.projectId && !options.projectName) {
      throw new Error(
        "Auto sync requires --project-id or --project-name so we know which LangSmith project to watch.",
      );
    }
    const res = await createWorkspace({
      workspaceName: name.trim(),
      langsmithApiKey: lsKey.trim(),
      autoSync: !!options.autoSync,
      langsmithProjectId: options.projectId,
      langsmithProjectName: options.projectName,
    });
    if (options.use || !(await readConfig()).workspaceId) {
      await updateConfig({ workspaceId: res.id });
    }
    console.log(chalk.bold("Workspace created."));
    console.log("Workspace ID:", res.id);
    console.log("Name:", res.name);
    if (res.langsmithProjectName || res.langsmithProjectId) {
      console.log(
        "Default project:",
        res.langsmithProjectName ?? res.langsmithProjectId,
      );
    }
    if (options.use || !(await readConfig()).workspaceId) {
      console.log("Config updated to use this workspace.");
    }
  });

cmd.command("workspace", workspaceCmd);

cmd.command("completions", new CompletionsCommand());

cmd.command(
  "upgrade",
  new UpgradeCommand({
    main: "main.ts",
    args: ["-A", "--config", "deno.jsonc"],
    provider: new GithubProvider({
      repository: "darinkishore/mcp-evals-cli",
    }),
  }),
);

if (import.meta.main) {
  const DEBUG = (Deno.env.get("EVALS_DEBUG") ?? "").toLowerCase() === "1";
  try {
    await cmd.parse(Deno.args);
  } catch (e) {
    const err = e as any;
    console.error(chalk.red("Error:"), err?.message ?? String(err));
    if (DEBUG) {
      console.error("Stack:");
      console.error(err?.stack ?? "<no stack>");
    }
    Deno.exit(1);
  }
}
