export interface ImportTraceOut {
  traceId: string;
  task: string;
  firstUserMessage: string;
  createdAt?: string;
}

export interface ImportBatchResponse {
  success: boolean;
  imported: number;
  traces: ImportTraceOut[];
  projectName?: string;
  importedAt: string;
}

export interface ImportOneResponse {
  success: boolean;
  created: boolean;
  updated: boolean;
  trace: ImportTraceOut;
}

export interface StatusResponse {
  trace_id: string;
  analysis_status: string;
  review_status?: string | null;
  has_analyzer_eval: boolean;
  has_correctness_eval: boolean;
  ready_for_review: boolean;
  created_at?: string;
}

export interface AskResponse {
  traceId: string;
  answer: string;
}

export interface ReviewIssue {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  description: string;
  summary?: string;
}

export interface ReviewRequirement {
  requirement_summary: string;
  satisfied: boolean;
  failure_summary: string | null;
}

export interface TraceBrowseItem {
  trace_id: string;
  task: string;
  messages: string;
  correctness?: boolean | null;
  requirements: ReviewRequirement[];
  issues: ReviewIssue[];
  position: number; // 1-based index in the full list
  total_pending: number; // reuse field name for header display (overall total)
}

export interface TraceBrowseResponse {
  items: TraceBrowseItem[];
  offset: number;
  limit: number;
  total: number;
}

export interface ImportExperimentResponse {
  success: boolean;
  imported: number;
  evaluationId: string;
  datasetId: string | null;
  experimentName: string;
  importedAt: string;
  status: string;
  totalTraces: number;
  completedTraces: number;
  projectId?: string | null;
  projectName?: string | null;
  langsmithDatasetId?: string | null;
  workspaceId?: string | null;
  reviewUrl?: string | null;
}

export interface ExperimentStatusResponse {
  evaluationId: string;
  status: string;
  totalTraces: number;
  completedTraces: number;
  datasetId?: string | null;
  experimentName: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  langsmithApiKey?: string | null;
  langsmithProjectId?: string | null;
  langsmithProjectName?: string | null;
  autoSyncEnabled: boolean;
  createdAt: string;
}

export interface AdminEmitResponse {
  ok: boolean;
  emitted: string;
  data: unknown;
}
