import { randomUUID } from "crypto";
import { JobRecord, JobStatus, JobEvent, ChatMessage } from "./types";
import { isoNow } from "../util/time";
import { JobStore } from "./JobStore";
import { SseHub } from "./SSEHub";
import { OllamaClient } from "./OllamaClient";

export interface QueueConfig {
  concurrency: number; // 1..4
}

type Enqueued = {
  jobId: string;
  priority: number;
  enqueuedAt: number;
};

export class JobQueue {
  private running = false;
  private workers: Promise<void>[] = [];
  private queue: Enqueued[] = [];
  private controllers = new Map<string, AbortController>();
  private inMemoryJobs = new Map<string, JobRecord>();
  private activeByKey = new Map<string, string>(); // optional: key -> job_id for active jobs with that key (to enforce single active per key)

  constructor(
    private readonly store: JobStore,
    private readonly hub: SseHub,
    private readonly ollama: OllamaClient,
    private readonly cfg: QueueConfig
  ) {}

  async start(): Promise<void> {
    this.running = true;
    const n = Math.max(1, Math.min(4, this.cfg.concurrency));
    for (let i = 0; i < n; i++) this.workers.push(this.workerLoop(i));
  }

  stop(): void {
    this.running = false;
    for (const [, c] of this.controllers) c.abort();
    this.controllers.clear();
  }

  private emit(job_id: string, event_type: JobEvent["event_type"], payload: any) {
    const evt: JobEvent = {
      id: randomUUID(),
      job_id,
      ts: isoNow(),
      event_type,
      payload,
    };
    this.hub.emit(evt);
  }

  private async setJob(job: JobRecord): Promise<void> {
    this.inMemoryJobs.set(job.job_id, job);
    await this.store.upsert(job);
  }

  async listJobs(limit = 50): Promise<JobRecord[]> {
    // persistent list is the source of truth
    const all = await this.store.loadAll();
    const jobs = all.slice(0, Math.max(1, Math.min(200, limit)));
    // add a preview convenience field (non-stored)
    return jobs.map((j) => ({
      ...j,
      preview: (j.result_text ?? "").slice(0, 120),
    })) as any;
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const mem = this.inMemoryJobs.get(jobId);
    if (mem) return mem;

    const all = await this.store.loadAll();
    const found = all.find((j) => j.job_id === jobId);
    if (!found) return null;

    // load result text if present
    if (!found.result_text) {
      const txt = await this.store.getResultText(jobId);
      if (txt) found.result_text = txt;
    }
    this.inMemoryJobs.set(jobId, found);
    return found;
  }

  async enqueueChatJob(args: {
    priority: number;
    model: string;
    messages: ChatMessage[];
    analysis_key?: string; // optional: if provided, will ensure only one active job with the same key (cancels previous)
    keep_alive?: string;
    options?: Record<string, any>;
  }): Promise<JobRecord> {
    
    // STEP 3 — Cancel previous job for same analysis key
  if (args.analysis_key) {
    const existingJobId = this.activeByKey.get(args.analysis_key);
    if (existingJobId) {
      await this.cancelJob(existingJobId);
    }
  }

    const job_id = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, "0");

    
    const now = isoNow();
    const job: JobRecord = {
      job_id,
      type: "OLLAMA_CHAT",
      priority: Math.max(0, Math.min(9, args.priority)),
      model: args.model,
      status: JobStatus.QUEUED,
      created_at: now,
      updated_at: now,
      started_at: null,
      finished_at: null,
      keep_alive: args.keep_alive ?? "5m",
      options: args.options ?? {},
      payload: { messages: args.messages, analysis_key: args.analysis_key},
      result_text: null,
      error: null,
      metrics: null,
    };

    await this.setJob(job);

    if (args.analysis_key) {
      this.activeByKey.set(args.analysis_key, job_id);
    }

    this.queue.push({ jobId: job_id, priority: job.priority, enqueuedAt: Date.now() });
    this.sortQueue();

    this.emit(job_id, "STATUS", { status: JobStatus.QUEUED });
    return job;
  }

  async cancelJob(jobId: string): Promise<{ job_id: string; previous_status: JobStatus; new_status: JobStatus }> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const prev = job.status;

    // queued -> canceled
    if (job.status === JobStatus.QUEUED) {
      // remove from queue
      this.queue = this.queue.filter((x) => x.jobId !== jobId);
      job.status = JobStatus.CANCELED;
      job.updated_at = isoNow();
      job.finished_at = isoNow();
      await this.setJob(job);
      this.emit(jobId, "STATUS", { status: JobStatus.CANCELED });
      return { job_id: jobId, previous_status: prev, new_status: job.status };
    }

    // running -> cancel_requested and abort
    if (job.status === JobStatus.RUNNING) {
      job.status = JobStatus.CANCEL_REQUESTED;
      job.updated_at = isoNow();
      await this.setJob(job);
      this.emit(jobId, "STATUS", { status: JobStatus.CANCEL_REQUESTED });

      const c = this.controllers.get(jobId);
      if (c) c.abort();

      return { job_id: jobId, previous_status: prev, new_status: JobStatus.CANCEL_REQUESTED };
    }

    return { job_id: jobId, previous_status: prev, new_status: job.status };
  }

  private sortQueue() {
    // higher priority first; then FIFO
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  private async workerLoop(workerIdx: number): Promise<void> {
    while (this.running) {
      const next = this.queue.shift();
      if (!next) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      const job = await this.getJob(next.jobId);
      if (!job) continue;

      const key = job.payload?.analysis_key;
      if (key && this.activeByKey.get(key) !== job.job_id) {
      continue; // stale job — skip it
      }

      // Might have been canceled while waiting
      if (job.status === JobStatus.CANCELED) continue;

      // claim
      job.status = JobStatus.RUNNING;
      job.started_at = isoNow();
      job.updated_at = isoNow();
      await this.setJob(job);
      this.emit(job.job_id, "STATUS", { status: JobStatus.RUNNING, worker: workerIdx });

      const controller = new AbortController();
      this.controllers.set(job.job_id, controller);

      try {
        let full = "";
        let finalMetrics: any = null;

        const messages = job.payload?.messages ?? [];
        for await (const part of this.ollama.chatStream({
          model: job.model,
          messages,
          options: job.options ?? {},
          keep_alive: job.keep_alive ?? "5m",
          signal: controller.signal,
        })) {
        
          const currentKey = job.payload?.analysis_key;
          if (currentKey && this.activeByKey.get(currentKey) !== job.job_id) {
          controller.abort();
          throw new Error("stale_job");
          }

          if (controller.signal.aborted) throw new Error("aborted");

          const delta = part.delta ?? "";
          if (delta) {
            full += delta;
            this.emit(job.job_id, "OUTPUT_CHUNK", { delta });
          }
          if (part.raw?.done) {
            finalMetrics = part.raw;
            break;
          }
        }

        // if cancel requested, mark canceled even if stream ended
        const refreshed = await this.getJob(job.job_id);
        const wasCancelRequested = refreshed?.status === JobStatus.CANCEL_REQUESTED;

        if (wasCancelRequested || controller.signal.aborted) {
          job.status = JobStatus.CANCELED;
          job.updated_at = isoNow();
          job.finished_at = isoNow();
          await this.setJob(job);
          this.emit(job.job_id, "STATUS", { status: JobStatus.CANCELED });
          continue;
        }

        job.status = JobStatus.SUCCEEDED;
        job.updated_at = isoNow();
        job.finished_at = isoNow();
        job.result_text = full;
        job.metrics = finalMetrics ?? null;

        await this.store.setResultText(job.job_id, full);
        await this.setJob(job);

        this.emit(job.job_id, "METRIC", { metrics: job.metrics });
        this.emit(job.job_id, "STATUS", { status: JobStatus.SUCCEEDED });
      } catch (err: any) {
        const refreshed = await this.getJob(job.job_id);
        const canceling = refreshed?.status === JobStatus.CANCEL_REQUESTED || controller.signal.aborted;

        if (canceling) {
          job.status = JobStatus.CANCELED;
          job.updated_at = isoNow();
          job.finished_at = isoNow();
          await this.setJob(job);
          this.emit(job.job_id, "STATUS", { status: JobStatus.CANCELED });
        } else {
          job.status = JobStatus.FAILED;
          job.updated_at = isoNow();
          job.finished_at = isoNow();
          job.error = String(err?.message ?? err ?? "unknown error");
          await this.setJob(job);
          this.emit(job.job_id, "ERROR", { message: job.error });
          this.emit(job.job_id, "STATUS", { status: JobStatus.FAILED });
        }
      } finally {
        const key = job.payload?.analysis_key;
        if (key && this.activeByKey.get(key) === job.job_id) {
        this.activeByKey.delete(key);
        }
        
        this.controllers.delete(job.job_id);
      }
    }
  }
}