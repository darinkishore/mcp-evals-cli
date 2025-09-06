import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
// Avoid Node's readline-sync to prevent TTY rawMode issues under Deno's
// Node-compat layer. Use Deno's native prompt instead.

function homeDir(): string {
  // Robust home directory resolution without relying on std/os,
  // which keeps this module self-contained and portable.
  if (Deno.build.os === "windows") {
    const userProfile = Deno.env.get("USERPROFILE");
    if (userProfile && userProfile.trim()) return userProfile;
    const drive = Deno.env.get("HOMEDRIVE") ?? "C:";
    const path = Deno.env.get("HOMEPATH") ?? "\\";
    return `${drive}${path}`;
  }
  return Deno.env.get("HOME") || "/";
}

export interface EvalConfig {
  langsmithApiKey?: string;
  langsmithProjectId?: string;
  langsmithProjectName?: string;
  evalApiUrl?: string;
}

const configDir = join(homeDir(), ".eval");
const configPath = join(configDir, "config.json");

export function getConfigPath(): string {
  return configPath;
}

export async function readConfig(): Promise<EvalConfig> {
  try {
    const data = await Deno.readTextFile(configPath);
    try {
      const parsed = JSON.parse(data);
      // Ensure we always return an object of the right shape
      if (parsed && typeof parsed === "object") {
        return parsed as EvalConfig;
      }
      return {};
    } catch {
      // If the file exists but is invalid JSON, return a blank config
      return {};
    }
  } catch {
    return {};
  }
}

export async function writeConfig(cfg: EvalConfig): Promise<void> {
  await Deno.mkdir(configDir, { recursive: true });
  await Deno.writeTextFile(configPath, JSON.stringify(cfg, null, 2));
}

export async function resolveLangsmithConfig(
  options: { apiKey?: string | null; projectId?: string | null; projectName?: string | null },
): Promise<{ apiKey: string; projectId: string | undefined; projectName: string }>
{
  const envApiKey = Deno.env.get("LANGSMITH_API_KEY") || undefined;
  const envProjectId = Deno.env.get("LANGSMITH_PROJECT_ID") || undefined;
  const envProjectName = Deno.env.get("LANGSMITH_PROJECT") || Deno.env.get("LANGSMITH_PROJECT_NAME") || undefined;

  const cfg = await readConfig();

  let apiKey = options.apiKey ?? envApiKey ?? cfg.langsmithApiKey;
  let projectId = options.projectId ?? envProjectId ?? cfg.langsmithProjectId;
  let projectName = options.projectName ?? envProjectName ?? cfg.langsmithProjectName ?? "default";

  if (!apiKey) {
    // Prompt minimally on first run; store for next time
    const input = prompt("No API key found. Enter LangSmith API key:") ?? "";
    apiKey = input.trim();
    if (!apiKey) throw new Error("LANGSMITH_API_KEY is required");
  }

  if (!projectId && !options.projectName && !envProjectName && !cfg.langsmithProjectName) {
    const input = prompt("Enter project ID (or leave blank to use project name 'default'):") ?? "";
    projectId = input.trim() || undefined;
  }

  // Persist config for later runs (don't overwrite evalApiUrl)
  await writeConfig({
    langsmithApiKey: apiKey,
    langsmithProjectId: projectId,
    langsmithProjectName: projectName,
    evalApiUrl: cfg.evalApiUrl,
  });

  return { apiKey, projectId, projectName };
}

export async function setConfigKey(key: keyof EvalConfig, value: string | undefined) {
  const curr = await readConfig();
  const next: EvalConfig = { ...curr, [key]: value } as EvalConfig;
  await writeConfig(next);
}

export async function unsetConfigKey(key: keyof EvalConfig) {
  const curr = await readConfig();
  const next: EvalConfig = { ...curr };
  // deno-lint-ignore no-explicit-any
  delete (next as any)[key];
  await writeConfig(next);
}

export function mask(value?: string): string | undefined {
  if (!value) return value;
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export async function openConfigInEditor(): Promise<void> {
  const path = getConfigPath();
  await Deno.mkdir(configDir, { recursive: true });
  try {
    await Deno.stat(path);
  } catch {
    await Deno.writeTextFile(path, JSON.stringify(await readConfig(), null, 2));
  }
  const editor = Deno.env.get("VISUAL") || Deno.env.get("EDITOR") || (Deno.build.os === "windows" ? "notepad" : "vi");
  const cmd = new Deno.Command(editor, { args: [path], stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const p = cmd.spawn();
  const status = await p.status;
  if (!status.success) {
    throw new Error(`Editor exited with code ${status.code}`);
  }
}
