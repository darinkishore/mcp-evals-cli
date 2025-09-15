#!/usr/bin/env -S deno run -A --config cli/deno/deno.jsonc
// deno-lint-ignore-file no-explicit-any
import chalk from "chalk";

import { Command } from "@cliffy/command";
import { CompletionsCommand } from "@cliffy/command/completions";
import { UpgradeCommand } from "@cliffy/command/upgrade";
import { GithubProvider } from "@cliffy/command/upgrade/provider/github";

import { getStatus, importBatch, importOne, postAsk } from "./src/api.ts";
import {
  type EvalConfig,
  getConfigPath,
  mask,
  openConfigInEditor,
  readConfig,
  resolveLangsmithConfig,
  setConfigKey,
  unsetConfigKey,
} from "./src/config.ts";

const VERSION = "v0.1.0";

async function runReview(opts?: { failuresOnly?: boolean }) {
  // Ensure consistent dev/prod selection for React/Reconciler
  const procEnv = (globalThis as any)?.process?.env;
  try {
    if (procEnv && !("NODE_ENV" in procEnv)) procEnv.NODE_ENV = "development";
  } catch { /* ignore */ }

  // Lazy-load Ink, React, and fullscreen-ink
  const [{ default: React }, { withFullScreen }, { default: FullScreenApp }] =
    await Promise.all([
      import("react"),
      import("fullscreen-ink"),
      import("./src/ui/FullScreenApp.tsx"),
    ]);

  // Guard against mismatched React version (Ink v6 needs React 19)
  if (!(React as any)?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) {
    throw new Error(
      "React 19 not resolved at runtime (missing __CLIENT_INTERNALS...). " +
        "Try: deno cache --reload cli/deno/main.ts, then reinstall with deno install -f -A --config cli/deno/deno.jsonc -n evals cli/deno/main.ts.",
    );
  }

  const wrapper = withFullScreen(
    React.createElement(FullScreenApp, { failuresOnly: !!opts?.failuresOnly }),
    { exitOnCtrlC: false }, // we manage exit within the app
  );
  await wrapper.start();
  await wrapper.waitUntilExit();
}

const cmd = new Command()
  .name("evals")
  .version(VERSION)
  .description("Evals CLI (Deno + Ink)")
  // Use Cliffy's default help/version so it can show upgrade hints
  .globalOption("-r, --review", "Open the trace viewer (read-only)")
  .globalOption(
    "-f, --failures",
    "Show only failed requirements or CRITICAL/HIGH/MEDIUM issues with priority",
  )
  .action(async (options) => {
    if (options.review) {
      await runReview({ failuresOnly: !!options.failures });
    } else {
      await cmd.showHelp();
    }
  });

cmd
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
        `Imported ${res.imported} trace(s) from ${
          res.projectName ?? "(default)"
        }`,
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
  });

cmd
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
  });

cmd
  .command("status <traceId:string>")
  .description("Show analysis/review readiness for a trace")
  .action(async (_options, traceId: string) => {
    const s = await getStatus(traceId);
    console.log(chalk.bold("Trace ID:"), s.trace_id);
    console.log(chalk.bold("Analysis:"), s.analysis_status);
    console.log(
      chalk.bold("Has Analyzer:"),
      s.has_analyzer_eval ? "yes" : "no",
    );
    console.log(
      chalk.bold("Has Correctness:"),
      s.has_correctness_eval ? "yes" : "no",
    );
    console.log(
      chalk.bold("Ready for Review:"),
      s.ready_for_review ? chalk.green("yes") : chalk.yellow("no"),
    );
    if (s.created_at) console.log(chalk.bold("Created:"), s.created_at);
  });

cmd
  .command("ask <traceId:string> <question...:string>")
  .description("Ask a question about a stored trace")
  .action(async (_options, traceId: string, ...qparts: string[]) => {
    const question = qparts.join(" ").trim();
    const r = await postAsk(traceId, question);
    console.log(chalk.cyan("Ask:"));
    console.log(r.answer);
  });

cmd
  .command("review")
  .description("Interactive trace viewer (read-only navigation)")
  .option(
    "-f, --failures",
    "Show only failed requirements or CRITICAL/HIGH/MEDIUM issues with priority",
  )
  .action(async (options) => {
    await runReview({ failuresOnly: !!options.failures });
  });

const configCmd = new Command()
  .description("View and edit persistent config");

configCmd
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
    ];
    if (!allowed.includes(key)) {
      console.log(
        "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl",
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
    ];
    if (!allowed.includes(key)) {
      console.log(
        "Allowed keys: langsmithApiKey, langsmithProjectId, langsmithProjectName, evalApiUrl",
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
