export type JobType = "OLLAMA_CHAT" | "OLLAMA_GENERATE";

export enum JobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCEL_REQUESTED = "cancel_requested",
  CANCELED = "canceled",
}

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface CreateChatJobRequest {
  type: "OLLAMA_CHAT";
  priority: number; // 0..9
  model: string;
  payload: { 
    messages: ChatMessage[];
    analysis_key?: string;
   };
  options?: Record<string, any>;
  keep_alive?: string; // e.g. "5m"
  version?: number;
}

export interface JobRecord {
  job_id: string;
  type: JobType;
  priority: number;
  model: string;
  status: JobStatus;

  version: number;
  
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;

  keep_alive?: string;
  options?: Record<string, any>;
  payload?: any;

  result_text?: string | null;
  error?: string | null;
  metrics?: Record<string, any> | null;
}

export type JobEventType = "STATUS" | "OUTPUT_CHUNK" | "ERROR" | "METRIC";

export interface JobEvent {
  id: string;
  job_id: string;
  ts: string;
  event_type: JobEventType;
  payload: any;
}

export interface HealthResponse {
  ok: boolean;
  ollama_url?: string;
}

export interface ModelsResponse {
  tags: any;
  ps: any;
}

export interface ErrorMetadata{
  line: number;
  severity: "error" | "warning" | "info";
  description: string;
}

export interface ModelAnalysisResult{
  structural_summary: string;
  issues: ErrorMetadata[];
  complexity: string;
  improvements: Array<{
    description: string;
    reasoning: string;
  }>;
}
