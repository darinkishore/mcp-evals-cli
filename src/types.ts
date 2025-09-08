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
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  description: string;
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
  position: number;        // 1-based index in the full list
  total_pending: number;   // reuse field name for header display (overall total)
}

export interface TraceBrowseResponse {
  items: TraceBrowseItem[];
  offset: number;
  limit: number;
  total: number;
}
