import type {
  ImportBatchResponse,
  ImportOneResponse,
  StatusResponse,
  AskResponse,
  ReviewsNextResponse,
} from "./types.ts";
import { readConfig } from "./config.ts";

let cachedBaseUrl: string | null = null;
async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const envUrl = Deno.env.get("EVAL_API_URL");
  const cfg = await readConfig();
  const url = envUrl || cfg.evalApiUrl || "http://127.0.0.1:8000";
  cachedBaseUrl = url.replace(/\/$/, "");
  return cachedBaseUrl;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function importBatch(payload: {
  projectId?: string;
  projectName?: string;
  apiKey?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ImportBatchResponse> {
  return http<ImportBatchResponse>(`/traces/import/batch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function importOne(payload: {
  traceId: string;
  projectId?: string;
  projectName?: string;
  apiKey?: string;
}): Promise<ImportOneResponse> {
  return http<ImportOneResponse>(`/traces/import/one`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStatus(traceId: string): Promise<StatusResponse> {
  return http<StatusResponse>(`/traces/status/${encodeURIComponent(traceId)}`);
}

export async function postAsk(traceId: string, question: string): Promise<AskResponse> {
  return http<AskResponse>(`/ask/${encodeURIComponent(traceId)}`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function getNextReview(): Promise<ReviewsNextResponse | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/reviews/next`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<ReviewsNextResponse>;
}

export async function postFeedback(traceId: string, feedback: string): Promise<void> {
  await http(`/reviews/${encodeURIComponent(traceId)}/feedback?` + new URLSearchParams({ feedback }).toString(), {
    method: "POST",
  });
}

export async function postSkip(traceId: string): Promise<void> {
  await http(`/reviews/${encodeURIComponent(traceId)}/skip`, { method: "POST" });
}
