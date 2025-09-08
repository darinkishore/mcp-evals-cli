#!/usr/bin/env -S deno run -A
// deno-lint-ignore-file no-explicit-any
import chalk from "npm:chalk@5";

import { Command } from "jsr:@cliffy/command@1.0.0-rc.7";
import { CompletionsCommand } from "jsr:@cliffy/command@1.0.0-rc.7/completions";
import { UpgradeCommand } from "jsr:@cliffy/command@1.0.0-rc.7/upgrade";
import { GithubProvider } from "jsr:@cliffy/command@1.0.0-rc.7/upgrade/provider/github";

import { importBatch, importOne, getStatus, postAsk } from "./src/api.ts";
import {
  resolveLangsmithConfig,
  readConfig,
  getConfigPath,
  setConfigKey,
  unsetConfigKey,
  mask,
  openConfigInEditor,
} from "./src/config.ts";

const VERSION = "0.1.0";

async function runReview() {
  // Ensure consistent dev/prod selection for React/Reconciler
  const procEnv = (globalThis as any)?.process?.env;
  try {
    if (procEnv && !("NODE_ENV" in procEnv)) procEnv.NODE_ENV = "development";
  } catch {}

  // Lazy-load Ink and React only when needed to avoid TTY rawMode issues
  const [{ default: React }, { render }, { default: FullScreenApp }] = await Promise.all([
    import("npm:react@19"),
    import("npm:ink@6"),
    import("./src/ui/FullScreenApp.tsx"),
  ]);

  // Guard against mismatched React version (Ink v6 needs React 19)
  // react-reconciler@0.32 expects __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  if (!(React as any)?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
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
    } catch {}
  };
  const denoRemove = (sig: string, fn: () => void) => {
    try {
      (Deno as any).removeSignalListener?.(sig, fn);
    } catch {}
  };
  const nodeOn = (ev: string, fn: () => void) => {
    try {
      proc?.on?.(ev, fn);
    } catch {}
  };
  const nodeOff = (ev: string, fn: () => void) => {
    try {
      proc?.off?.(ev, fn);
    } catch {}
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
  const ink = render(React.createElement(FullScreenApp));
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

const cmd = new Command()
  .name("evals")
  .version(VERSION)
  .description("Evals CLI (Deno + Ink)")
  // Override built-in help/version to avoid auto upgrade checks on --help/--version
  .helpOption(false)
  .versionOption(false)
  .option(
    "-V, --version",
    "Show the version number for this program.",
    {
      standalone: true,
      prepend: true,
      action: function () {
        const long = this.getRawArgs().includes("--version");
        if (long) this.showLongVersion();
        else this.showVersion();
        this.exit();
      },
    },
  )
  .option("-h, --help", "Show this help.", {
    standalone: true,
    global: true,
    prepend: true,
    action: function () {
      const long = this.getRawArgs().includes("--help");
      this.showHelp({ long });
      this.exit();
    },
  })
  .globalOption("-r, --review", "Open the trace viewer (read-only)")
  .action(async (options) => {
    if (options.review) {
      await runReview();
    } else {
      await cmd.showHelp();
    }
  })
  // import
  .command("import")
  .description("Import a batch of traces from LangSmith")
  .option("--api-key <key:string>", "LangSmith API key")
  .option("--project-id <id:string>", "LangSmith project ID")
  .option("--project-name <name:string>", "LangSmith project name")
  .option("--start-date <iso:string>", "Start date (ISO)")
  .option("--end-date <iso:string>", "End date (ISO)")
  .option("--limit <n:number>", "Limit number of traces")
  .action(async (options) => {
    const { apiKey, projectId, projectName } = await resolveLangsmithConfig({
      apiKey: options.apiKey,
      projectId: options.projectId,
      projectName: options.projectName,
    });
    const res = await importBatch({
      apiKey,
      projectId,
      projectName,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit,
    });
    console.log(
      chalk.bold(
        `Imported ${res.imported} trace(s) from ${res.projectName ?? "(default)"}`,
      ),
    );
    if (res.traces?.length) {
      console.log("Examples:");
      for (const t of res.traces.slice(0, Math.min(5, res.traces.length))) {
        console.log(
          `  • ${t.traceId}  ${t.firstUserMessage?.slice(0, 60) ?? ""}`,
        );
      }
    }
    console.log(`\nOpen viewer: ${chalk.cyan("evals review")}`);
  })
  .reset()
  // import-one
  .command("import-one <traceId:string>")
  .description("Import a single trace by id")
  .option("--api-key <key:string>", "LangSmith API key")
  .option("--project-id <id:string>", "LangSmith project ID")
  .option("--project-name <name:string>", "LangSmith project name")
  .action(async (options, traceId: string) => {
    const { apiKey, projectId, projectName } = await resolveLangsmithConfig({
      apiKey: options.apiKey,
      projectId: options.projectId,
      projectName: options.projectName,
    });
    const res = await importOne({ traceId, apiKey, projectId, projectName });
    const status = res.created
      ? "created"
      : res.updated
      ? "updated"
      : "unchanged";
    console.log(chalk.bold(`Trace ${res.trace.traceId} ${status}.`));
  })
  .reset()
  // status
  .command("status <traceId:string>")
  .description("Show analysis/review readiness for a trace")
  .action(async (_options, traceId: string) => {
    const s = await getStatus(traceId);
    console.log(chalk.bold("Trace ID:"), s.trace_id);
    console.log(chalk.bold("Analysis:"), s.analysis_status);
    console.log(chalk.bold("Has Analyzer:"), s.has_analyzer_eval ? "yes" : "no");
    console.log(
      chalk.bold("Has Correctness:"),
      s.has_correctness_eval ? "yes" : "no",
    );
    console.log(
      chalk.bold("Ready for Review:"),
      s.ready_for_review ? chalk.green("yes") : chalk.yellow("no"),
    );
    if (s.created_at) console.log(chalk.bold("Created:"), s.created_at);
  })
  .reset()
  // ask
  .command("ask <traceId:string> <question...:string>")
  .description("Ask a question about a stored trace")
  .action(async (_options, traceId: string, ...qparts: string[]) => {
    const question = qparts.join(" ").trim();
    const r = await postAsk(traceId, question);
    console.log(chalk.cyan("Ask:"));
    console.log(r.answer);
  })
  .reset()
  // review
  .command("review")
  .description("Interactive trace viewer (read-only navigation)")
  .action(async () => {
    await runReview();
  })
  .reset()
  // config group
  .command(
    "config",
    new Command()
      .description("View and edit persistent config")
      .command("view")
      .description("Print config path and current values")
      .action(async () => {
        const cfg = await readConfig();
        console.log(chalk.bold("Config path:"), getConfigPath());
        console.log(
          JSON.stringify(
            { ...cfg, langsmithApiKey: mask(cfg.langsmithApiKey) },
            null,
            2,
          ),
        );
      })
      .command("set <key:string> <value...:string>")
      .description("Set a config key to a value")
      .action(async (_options, key: string, ...vparts: string[]) => {
        const allowed = [
          "langsmithApiKey",
          "langsmithProjectId",
          "langsmithProjectName",
          "evalApiUrl",
        ];
        if (!allowed.includes(key)) {
          console.log(
            "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl",
          );
          return;
        }
        const value = vparts.join(" ");
        // deno-lint-ignore no-explicit-any
        await setConfigKey(key as any, value);
        console.log("Updated", key);
      })
      .command("unset <key:string>")
      .description("Unset a config key")
      .action(async (_options, key: string) => {
        const allowed = [
          "langsmithApiKey",
          "langsmithProjectId",
          "langsmithProjectName",
          "evalApiUrl",
        ];
        if (!allowed.includes(key)) {
          console.log(
            "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl",
          );
          return;
        }
        // deno-lint-ignore no-explicit-any
        await unsetConfigKey(key as any);
        console.log("Removed", key);
      })
      .command("edit")
      .description("Open the config file in $EDITOR")
      .action(async () => {
        try {
          await openConfigInEditor();
        } catch (e) {
          console.error("Failed to open editor:", (e as Error).message);
          console.log("Edit manually:", getConfigPath());
        }
      })
      .command("path")
      .description("Print the config file path")
      .action(() => {
        console.log(getConfigPath());
      })
      .reset(),
  )
  .command("completions", new CompletionsCommand())
  .reset()
  .command(
    "upgrade",
    new UpgradeCommand({
      name: "evals",
      main: "main.ts",
      args: ["-A", "--config", "deno.jsonc"],
      provider: new GithubProvider({ repository: "darinkishore/mcp-evals-cli" }),
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
