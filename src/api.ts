import type {
  AdminEmitResponse,
  AskResponse,
  ExperimentStatusResponse,
  ImportBatchResponse,
  ImportExperimentResponse,
  ImportOneResponse,
  StatusResponse,
  TraceBrowseResponse,
  WorkspaceSummary,
} from "./types.ts";
import { readConfig, resolveEvalAuth } from "./config.ts";

let cachedBaseUrl: string | null = null;
async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const envUrl = Deno.env.get("EVAL_API_URL");
  const cfg = await readConfig();
  const url = envUrl || cfg.evalApiUrl || "http://127.0.0.1:8001";
  cachedBaseUrl = url.replace(/\/$/, "");
  return cachedBaseUrl;
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

interface AuthedOptions {
  requireWorkspace?: boolean;
  workspaceOverride?: string;
}

async function authed<T>(
  path: string,
  init: RequestInit = {},
  options?: AuthedOptions,
): Promise<T> {
  const { apiKey, workspaceId } = await resolveEvalAuth({
    requireWorkspace: options?.requireWorkspace,
    workspaceOverride: options?.workspaceOverride,
  });
  const headers = new Headers(init.headers ?? undefined);
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return http<T>(path, { ...init, headers });
}

export function importBatch(
  payload: {
    projectId?: string;
    projectName?: string;
    apiKey?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
  opts?: { workspaceOverride?: string },
): Promise<ImportBatchResponse> {
  return authed<ImportBatchResponse>(
    `/traces/import/batch`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function importOne(
  payload: {
    traceId: string;
    projectId?: string;
    projectName?: string;
    apiKey?: string;
  },
  opts?: { workspaceOverride?: string },
): Promise<ImportOneResponse> {
  return authed<ImportOneResponse>(
    `/traces/import/one`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function importExperiment(
  payload: {
    experimentName: string;
    label?: string;
    apiKey?: string;
  },
  opts?: { workspaceOverride?: string },
): Promise<ImportExperimentResponse> {
  return authed<ImportExperimentResponse>(
    `/api/v0/experiments/import`,
    {
      method: "POST",
      body: JSON.stringify({
        experimentName: payload.experimentName,
        label: payload.label,
        apiKey: payload.apiKey,
      }),
    },
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function getExperimentStatus(
  experimentName: string,
  opts?: { workspaceOverride?: string },
): Promise<ExperimentStatusResponse> {
  return authed<ExperimentStatusResponse>(
    `/api/v0/experiments/status/${encodeURIComponent(experimentName)}`,
    undefined,
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function getStatus(
  traceId: string,
  opts?: { workspaceOverride?: string },
): Promise<StatusResponse> {
  return authed<StatusResponse>(
    `/traces/status/${encodeURIComponent(traceId)}`,
    undefined,
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export async function postFeedback(
  traceId: string,
  feedback: string,
  opts?: { workspaceOverride?: string },
): Promise<void> {
  await authed(
    `/reviews/${encodeURIComponent(traceId)}/feedback?` +
      new URLSearchParams({ feedback }).toString(),
    { method: "POST" },
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function listTraces(
  offset = 0,
  limit = 50,
  order: "asc" | "desc" = "desc",
  opts?: { workspaceOverride?: string },
): Promise<TraceBrowseResponse> {
  return authed<TraceBrowseResponse>(
    `/traces/list?` + new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      only_completed: "true",
      order,
    }).toString(),
    undefined,
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function postAsk(
  traceId: string,
  question: string,
  opts?: { workspaceOverride?: string },
): Promise<AskResponse> {
  return authed<AskResponse>(
    `/ask/${encodeURIComponent(traceId)}`,
    {
      method: "POST",
      body: JSON.stringify({ question }),
    },
    { workspaceOverride: opts?.workspaceOverride },
  );
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return authed<WorkspaceSummary[]>(
    `/api/v0/workspaces/`,
    undefined,
    { requireWorkspace: false },
  );
}

export function getCurrentWorkspace(): Promise<WorkspaceSummary> {
  return authed<WorkspaceSummary>(`/api/v0/workspaces/current`);
}

export function updateWorkspace(
  workspaceId: string,
  payload: Partial<WorkspaceSummary> & {
    langsmithApiKey?: string | null;
    langsmithProjectId?: string | null;
    langsmithProjectName?: string | null;
    autoSyncEnabled?: boolean;
  },
): Promise<WorkspaceSummary> {
  return authed<WorkspaceSummary>(
    `/api/v0/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: payload.name,
        langsmithApiKey: payload.langsmithApiKey,
        langsmithProjectId: payload.langsmithProjectId,
        langsmithProjectName: payload.langsmithProjectName,
        autoSyncEnabled: payload.autoSyncEnabled,
      }),
    },
    { requireWorkspace: false },
  );
}

export function syncWorkspace(
  workspaceId: string,
  payload: {
    lookbackHours?: number;
    limit?: number;
    projectId?: string;
    projectName?: string;
  } = {},
): Promise<AdminEmitResponse> {
  return authed<AdminEmitResponse>(
    `/api/v0/workspaces/${encodeURIComponent(workspaceId)}/sync`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { requireWorkspace: false },
  );
}

export function createWorkspace(payload: {
  workspaceName: string;
  langsmithApiKey: string;
  autoSync?: boolean;
  langsmithProjectId?: string;
  langsmithProjectName?: string;
}): Promise<WorkspaceSummary> {
  return authed<WorkspaceSummary>(
    `/api/v0/workspaces`,
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.workspaceName,
        langsmithApiKey: payload.langsmithApiKey,
        langsmithProjectId: payload.langsmithProjectId,
        langsmithProjectName: payload.langsmithProjectName,
        autoSyncEnabled: payload.autoSync,
      }),
    },
    { requireWorkspace: false },
  );
}
