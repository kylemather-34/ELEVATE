import * as assert from 'assert';
import { OllamaClient } from '../backend/OllamaClient';
import { JobQueue } from '../backend/JobQueue';
import { JobStatus, JobRecord } from '../backend/types';
import { SseHub } from '../backend/SSEHub';

class MemStore {
    private jobs: JobRecord[] = [];
    private texts = new Map<string, string>();
    async loadAll() { return [...this.jobs]; }
    async upsert(job: JobRecord) {
        const i = this.jobs.findIndex(j => j.job_id === job.job_id);
        if (i >= 0) { this.jobs[i] = { ...job }; } else { this.jobs.unshift({ ...job }); }
    }
    async setResultText(jobId: string, text: string) { this.texts.set(jobId, text); }
    async getResultText(jobId: string) { return this.texts.get(jobId) ?? null; }
}

async function waitForStatus(queue: JobQueue, jobId: string, status: JobStatus, timeout = 2000): Promise<JobRecord> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const job = await queue.getJob(jobId);
        if (job?.status === status) { return job; }
        await new Promise(r => setTimeout(r, 20));
    }
    const job = await queue.getJob(jobId);
    throw new Error(`Job ${jobId} stuck at ${job?.status}, expected ${status}`);
}

suite('JobQueue', () => {
    test('enqueueChatJob creates a job with QUEUED status', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = { chatStream: async function* () {} } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        const job = await queue.enqueueChatJob({ priority: 5, model: 'llama3.2:3b', messages: [] });
        assert.strictEqual(job.status, JobStatus.QUEUED);
        assert.strictEqual(job.model, 'llama3.2:3b');
    });

    test('cancelJob transitions a QUEUED job to CANCELED', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = { chatStream: async function* () {} } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        const job = await queue.enqueueChatJob({ priority: 5, model: 'llama3.2:3b', messages: [] });
        const result = await queue.cancelJob(job.job_id);
        assert.strictEqual(result.new_status, JobStatus.CANCELED);
        const updated = await queue.getJob(job.job_id);
        assert.strictEqual(updated?.status, JobStatus.CANCELED);
    });

    test('worker runs a job to SUCCEEDED when stream completes', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = {
            chatStream: async function* () {
                yield { delta: 'result', raw: { done: true } };
            },
        } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        await queue.start();
        const job = await queue.enqueueChatJob({ priority: 5, model: 'llama3.2:3b', messages: [] });
        const finished = await waitForStatus(queue, job.job_id, JobStatus.SUCCEEDED);
        queue.stop();

        assert.strictEqual(finished.status, JobStatus.SUCCEEDED);
        assert.strictEqual(finished.result_text, 'result');
    });

    test('worker marks job FAILED when stream throws', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = {
            chatStream: async function* () {
                throw new Error('ollama exploded');
                yield; // make TypeScript happy that this is a generator
            },
        } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        await queue.start();
        const job = await queue.enqueueChatJob({ priority: 5, model: 'llama3.2:3b', messages: [] });
        const finished = await waitForStatus(queue, job.job_id, JobStatus.FAILED);
        queue.stop();

        assert.strictEqual(finished.status, JobStatus.FAILED);
        assert.ok(finished.error?.includes('ollama exploded'));
    });

    test('getJob returns undefined for unknown job id', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = { chatStream: async function* () {} } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        const result = await queue.getJob('nonexistent-id');
        assert.strictEqual(result, undefined);
    });

    test('listJobs returns all enqueued jobs', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = { chatStream: async function* () {} } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        await queue.enqueueChatJob({ priority: 5, model: 'llama3.2:3b', messages: [] });
        await queue.enqueueChatJob({ priority: 3, model: 'llama3.2:3b', messages: [] });
        const jobs = await queue.listJobs(10);
        assert.ok(jobs.length >= 2);
    });

    test('enqueued job has expected model field', async () => {
        const store = new MemStore() as any;
        const hub = new SseHub();
        const ollama = { chatStream: async function* () {} } as any as OllamaClient;
        const queue = new JobQueue(store, hub, ollama, { concurrency: 1 });

        const job = await queue.enqueueChatJob({ priority: 1, model: 'mistral:7b', messages: [] });
        assert.strictEqual(job.model, 'mistral:7b');
    });
});
