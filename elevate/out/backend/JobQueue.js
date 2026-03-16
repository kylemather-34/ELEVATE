"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobQueue = void 0;
const crypto_1 = require("crypto");
const types_1 = require("./types");
const time_1 = require("../util/time");
class JobQueue {
    store;
    hub;
    ollama;
    cfg;
    running = false;
    workers = [];
    queue = [];
    controllers = new Map();
    inMemoryJobs = new Map();
    activeByKey = new Map(); // optional: key -> job_id for active jobs with that key (to enforce single active per key)
    constructor(store, hub, ollama, cfg) {
        this.store = store;
        this.hub = hub;
        this.ollama = ollama;
        this.cfg = cfg;
    }
    async start() {
        this.running = true;
        const n = Math.max(1, Math.min(4, this.cfg.concurrency));
        for (let i = 0; i < n; i++)
            this.workers.push(this.workerLoop(i));
    }
    stop() {
        this.running = false;
        for (const [, c] of this.controllers)
            c.abort();
        this.controllers.clear();
    }
    emit(job_id, event_type, payload) {
        const evt = {
            id: (0, crypto_1.randomUUID)(),
            job_id,
            ts: (0, time_1.isoNow)(),
            event_type,
            payload,
        };
        this.hub.emit(evt);
    }
    async setJob(job) {
        this.inMemoryJobs.set(job.job_id, job);
        await this.store.upsert(job);
    }
    async listJobs(limit = 50) {
        // persistent list is the source of truth
        const all = await this.store.loadAll();
        const jobs = all.slice(0, Math.max(1, Math.min(200, limit)));
        // add a preview convenience field (non-stored)
        return jobs.map((j) => ({
            ...j,
            preview: (j.result_text ?? "").slice(0, 120),
        }));
    }
    async getJob(jobId) {
        const mem = this.inMemoryJobs.get(jobId);
        if (mem)
            return mem;
        const all = await this.store.loadAll();
        const found = all.find((j) => j.job_id === jobId);
        if (!found)
            return null;
        // load result text if present
        if (!found.result_text) {
            const txt = await this.store.getResultText(jobId);
            if (txt)
                found.result_text = txt;
        }
        this.inMemoryJobs.set(jobId, found);
        return found;
    }
    async enqueueChatJob(args) {
        // STEP 3 — Cancel previous job for same analysis key
        if (args.analysis_key) {
            const existingJobId = this.activeByKey.get(args.analysis_key);
            if (existingJobId) {
                await this.cancelJob(existingJobId);
            }
        }
        const job_id = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        const now = (0, time_1.isoNow)();
        const job = {
            job_id,
            type: "OLLAMA_CHAT",
            priority: Math.max(0, Math.min(9, args.priority)),
            model: args.model,
            status: types_1.JobStatus.QUEUED,
            created_at: now,
            updated_at: now,
            started_at: null,
            finished_at: null,
            keep_alive: args.keep_alive ?? "5m",
            options: args.options ?? {},
            payload: { messages: args.messages, analysis_key: args.analysis_key },
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
        this.emit(job_id, "STATUS", { status: types_1.JobStatus.QUEUED });
        return job;
    }
    async cancelJob(jobId) {
        const job = await this.getJob(jobId);
        if (!job)
            throw new Error(`Job not found: ${jobId}`);
        const prev = job.status;
        // queued -> canceled
        if (job.status === types_1.JobStatus.QUEUED) {
            // remove from queue
            this.queue = this.queue.filter((x) => x.jobId !== jobId);
            job.status = types_1.JobStatus.CANCELED;
            job.updated_at = (0, time_1.isoNow)();
            job.finished_at = (0, time_1.isoNow)();
            await this.setJob(job);
            this.emit(jobId, "STATUS", { status: types_1.JobStatus.CANCELED });
            return { job_id: jobId, previous_status: prev, new_status: job.status };
        }
        // running -> cancel_requested and abort
        if (job.status === types_1.JobStatus.RUNNING) {
            job.status = types_1.JobStatus.CANCEL_REQUESTED;
            job.updated_at = (0, time_1.isoNow)();
            await this.setJob(job);
            this.emit(jobId, "STATUS", { status: types_1.JobStatus.CANCEL_REQUESTED });
            const c = this.controllers.get(jobId);
            if (c)
                c.abort();
            return { job_id: jobId, previous_status: prev, new_status: types_1.JobStatus.CANCEL_REQUESTED };
        }
        return { job_id: jobId, previous_status: prev, new_status: job.status };
    }
    sortQueue() {
        // higher priority first; then FIFO
        this.queue.sort((a, b) => {
            if (a.priority !== b.priority)
                return b.priority - a.priority;
            return a.enqueuedAt - b.enqueuedAt;
        });
    }
    async workerLoop(workerIdx) {
        while (this.running) {
            const next = this.queue.shift();
            if (!next) {
                await new Promise((r) => setTimeout(r, 50));
                continue;
            }
            const job = await this.getJob(next.jobId);
            if (!job)
                continue;
            const key = job.payload?.analysis_key;
            if (key && this.activeByKey.get(key) !== job.job_id) {
                continue; // stale job — skip it
            }
            // Might have been canceled while waiting
            if (job.status === types_1.JobStatus.CANCELED)
                continue;
            // claim
            job.status = types_1.JobStatus.RUNNING;
            job.started_at = (0, time_1.isoNow)();
            job.updated_at = (0, time_1.isoNow)();
            await this.setJob(job);
            this.emit(job.job_id, "STATUS", { status: types_1.JobStatus.RUNNING, worker: workerIdx });
            const controller = new AbortController();
            this.controllers.set(job.job_id, controller);
            try {
                let full = "";
                let finalMetrics = null;
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
                    if (controller.signal.aborted)
                        throw new Error("aborted");
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
                const wasCancelRequested = refreshed?.status === types_1.JobStatus.CANCEL_REQUESTED;
                if (wasCancelRequested || controller.signal.aborted) {
                    job.status = types_1.JobStatus.CANCELED;
                    job.updated_at = (0, time_1.isoNow)();
                    job.finished_at = (0, time_1.isoNow)();
                    await this.setJob(job);
                    this.emit(job.job_id, "STATUS", { status: types_1.JobStatus.CANCELED });
                    continue;
                }
                job.status = types_1.JobStatus.SUCCEEDED;
                job.updated_at = (0, time_1.isoNow)();
                job.finished_at = (0, time_1.isoNow)();
                job.result_text = full;
                job.metrics = finalMetrics ?? null;
                await this.store.setResultText(job.job_id, full);
                await this.setJob(job);
                this.emit(job.job_id, "METRIC", { metrics: job.metrics });
                this.emit(job.job_id, "STATUS", { status: types_1.JobStatus.SUCCEEDED });
            }
            catch (err) {
                const refreshed = await this.getJob(job.job_id);
                const canceling = refreshed?.status === types_1.JobStatus.CANCEL_REQUESTED || controller.signal.aborted;
                if (canceling) {
                    job.status = types_1.JobStatus.CANCELED;
                    job.updated_at = (0, time_1.isoNow)();
                    job.finished_at = (0, time_1.isoNow)();
                    await this.setJob(job);
                    this.emit(job.job_id, "STATUS", { status: types_1.JobStatus.CANCELED });
                }
                else {
                    job.status = types_1.JobStatus.FAILED;
                    job.updated_at = (0, time_1.isoNow)();
                    job.finished_at = (0, time_1.isoNow)();
                    job.error = String(err?.message ?? err ?? "unknown error");
                    await this.setJob(job);
                    this.emit(job.job_id, "ERROR", { message: job.error });
                    this.emit(job.job_id, "STATUS", { status: types_1.JobStatus.FAILED });
                }
            }
            finally {
                const key = job.payload?.analysis_key;
                if (key && this.activeByKey.get(key) === job.job_id) {
                    this.activeByKey.delete(key);
                }
                this.controllers.delete(job.job_id);
            }
        }
    }
}
exports.JobQueue = JobQueue;
//# sourceMappingURL=JobQueue.js.map