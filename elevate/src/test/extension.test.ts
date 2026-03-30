import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { access } from 'fs/promises';
import { ElevateContext } from '../backend/ElevateContext';
import { CoreStateManager } from '../backend/CoreStateManager';
import { SessionContext } from '../backend/SessionContext';
import { Pipeline } from '../pipeline/Pipeline';
import { Stage, SanitizationStage, PromptBuilderStage, OllamaStage, ParseStage } from '../pipeline/Stage';
import { Logger } from '../Logger';
import { OllamaClient } from '../backend/OllamaClient';
import { JobQueue } from '../backend/JobQueue';
import { JobStatus, JobRecord } from '../backend/types';
import { SseHub } from '../backend/SSEHub';

suite('ElevateContext', () => {
    test('constructs from text string', () => {
        const ctx = new ElevateContext('hello world');
        assert.strictEqual(ctx.text, 'hello world');
        assert.strictEqual(ctx.snapshot, undefined);
    });

    test('analysisTarget is undefined by default', () => {
        const ctx = new ElevateContext('some code');
        assert.strictEqual(ctx.analysisTarget, undefined);
    });

    test('parsed is undefined by default', () => {
        const ctx = new ElevateContext('some code');
        assert.strictEqual(ctx.parsed, undefined);
    });
});

suite('CoreStateManager', () => {
    test('throws if not initialized before saveState', () => {
        const manager = new CoreStateManager();
        const ctx = new ElevateContext('test');
        assert.throws(() => manager.saveState(ctx));
    });

    test('throws if not initialized before loadState', () => {
        const manager = new CoreStateManager();
        assert.throws(() => manager.loadState());
    });

    test('loadState returns undefined before any state is saved', () => {
        const manager = new CoreStateManager();
        manager.initialize();
        assert.strictEqual(manager.loadState(), undefined);
    });

    test('saveState and loadState round-trip', () => {
        const manager = new CoreStateManager();
        manager.initialize();
        const ctx = new ElevateContext('test code');
        manager.saveState(ctx);
        assert.strictEqual(manager.loadState(), ctx);
    });

    test('getSnapshot returns undefined when no state saved', () => {
        const manager = new CoreStateManager();
        manager.initialize();
        assert.strictEqual(manager.getSnapshot(), undefined);
    });

    test('getSession returns a SessionContext instance', () => {
        const manager = new CoreStateManager();
        assert.ok(manager.getSession() instanceof SessionContext);
    });
});

suite('SessionContext', () => {
    test('getActiveFile returns undefined by default', () => {
        const session = new SessionContext();
        assert.strictEqual(session.getActiveFile(), undefined);
    });

    test('setActiveFile and getActiveFile round-trip', () => {
        const session = new SessionContext();
        const snapshot = { uri: 'file:///test.py', language: 'python', version: 1, text: 'print()' };
        session.setActiveFile(snapshot);
        assert.strictEqual(session.getActiveFile(), snapshot);
    });

    test('getRecentFeedback returns empty array by default', () => {
        const session = new SessionContext();
        assert.deepStrictEqual(session.getRecentFeedback(), []);
    });

    test('addFeedback stores response with timestamp and filePath', () => {
        const session = new SessionContext();
        const snapshot = { uri: 'file:///test.py', language: 'python', version: 1, text: 'print()' };
        session.setActiveFile(snapshot);
        session.addFeedback('response text');
        const feedback = session.getRecentFeedback();
        assert.strictEqual(feedback.length, 1);
        assert.strictEqual(feedback[0].response, 'response text');
        assert.strictEqual(feedback[0].filePath, 'file:///test.py');
        assert.ok(feedback[0].timestamp);
    });

    test('addFeedback uses unknown filePath when no active file set', () => {
        const session = new SessionContext();
        session.addFeedback('some response');
        assert.strictEqual(session.getRecentFeedback()[0].filePath, 'unknown');
    });

    test('clearFeedback empties the feedback list', () => {
        const session = new SessionContext();
        session.addFeedback('response 1');
        session.addFeedback('response 2');
        session.clearFeedback();
        assert.deepStrictEqual(session.getRecentFeedback(), []);
    });

    test('accumulates multiple feedback entries', () => {
        const session = new SessionContext();
        session.addFeedback('first');
        session.addFeedback('second');
        assert.strictEqual(session.getRecentFeedback().length, 2);
    });
});

suite('Pipeline', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('executes stages in order', async () => {
        const order: number[] = [];

        const makeStage = (n: number): Stage => ({
            name: `stage-${n}`,
            run: async (_ctx, _logger) => { order.push(n); }
        });

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([makeStage(1), makeStage(2), makeStage(3)], logger);
        const ctx = new ElevateContext('test');
        await pipeline.execute(ctx);

        assert.deepStrictEqual(order, [1, 2, 3]);
    });

    test('stops execution and throws when a stage fails', async () => {
        const ran: string[] = [];

        const good: Stage = { name: 'good', run: async (_ctx, _logger) => { ran.push('good'); } };
        const bad: Stage = { name: 'bad', run: async (_ctx, _logger) => { throw new Error('stage failed'); } };
        const after: Stage = { name: 'after', run: async (_ctx, _logger) => { ran.push('after'); } };

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([good, bad, after], logger);
        const ctx = new ElevateContext('test');

        await assert.rejects(() => pipeline.execute(ctx), /stage failed/);
        assert.deepStrictEqual(ran, ['good']);
    });

    test('runs without throwing on SanitizationStage alone', async () => {
        const ctx = new ElevateContext('test context');
        const logger = new Logger('test', false);
        const pipeline = new Pipeline([new SanitizationStage()], logger);
        await assert.doesNotReject(() => pipeline.execute(ctx));
    });
});

suite('OllamaClient', () => {
    let savedFetch: typeof globalThis.fetch;
    setup(() => { savedFetch = globalThis.fetch; });
    teardown(() => { globalThis.fetch = savedFetch; });

    test('tags() resolves with parsed JSON', async () => {
        (globalThis as any).fetch = async () => ({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3.2:3b' }] }),
        });
        const client = new OllamaClient('http://localhost:11434');
        const result = await client.tags();
        assert.deepStrictEqual(result, { models: [{ name: 'llama3.2:3b' }] });
    });

    test('tags() throws on non-ok status', async () => {
        (globalThis as any).fetch = async () => ({ ok: false, status: 503 });
        const client = new OllamaClient('http://localhost:11434');
        await assert.rejects(() => client.tags(), /503/);
    });

    test('chatStream() yields deltas and stops at done:true', async () => {
        const ndjson = [
            JSON.stringify({ message: { content: 'foo' }, done: false }),
            JSON.stringify({ message: { content: 'bar' }, done: true }),
        ].join('\n') + '\n';

        const bytes = new TextEncoder().encode(ndjson);
        let sent = false;
        (globalThis as any).fetch = async () => ({
            ok: true,
            body: {
                getReader: () => ({
                    read: async () => {
                        if (!sent) { sent = true; return { value: bytes, done: false }; }
                        return { value: undefined, done: true };
                    },
                }),
            },
        });

        const client = new OllamaClient('http://localhost:11434');
        const deltas: string[] = [];
        const abort = new AbortController();
        for await (const chunk of client.chatStream({
            model: 'test',
            messages: [{ role: 'user', content: 'hi' }],
            signal: abort.signal,
        })) {
            if (chunk.delta) { deltas.push(chunk.delta); }
        }
        assert.deepStrictEqual(deltas, ['foo', 'bar']);
    });
});

suite('OllamaStage', () => {
    const logger = new Logger('test', false);

    test('throws when ctx.prompt is not set', async () => {
        const mockClient = { chatStream: async function* () {} } as any as OllamaClient;
        const stage = new OllamaStage(mockClient);
        const ctx = new ElevateContext('test');
        await assert.rejects(() => stage.run(ctx, logger), /OllamaStage: no prompt set on context/);
    });

    test('throws when ctx.prompt is an empty array', async () => {
        const mockClient = { chatStream: async function* () {} } as any as OllamaClient;
        const stage = new OllamaStage(mockClient);
        const ctx = new ElevateContext('test');
        ctx.prompt = [];
        await assert.rejects(() => stage.run(ctx, logger), /OllamaStage: no prompt set on context/);
    });

    test('accumulates chunk deltas into ctx.modelResponse', async () => {
        const mockClient = {
            chatStream: async function* () {
                yield { delta: 'Hello', raw: {} };
                yield { delta: ' world', raw: { done: true } };
            },
        } as any as OllamaClient;
        const stage = new OllamaStage(mockClient);
        const ctx = new ElevateContext('test');
        ctx.prompt = [{ role: 'user', content: 'analyze this' }];
        await stage.run(ctx, logger);
        assert.strictEqual(ctx.modelResponse, 'Hello world');
    });

    test('ctx.modelResponse is empty string when stream yields no deltas', async () => {
        const mockClient = {
            chatStream: async function* () {
                yield { delta: '', raw: { done: true } };
            },
        } as any as OllamaClient;
        const stage = new OllamaStage(mockClient);
        const ctx = new ElevateContext('test');
        ctx.prompt = [{ role: 'user', content: 'hi' }];
        await stage.run(ctx, logger);
        assert.strictEqual(ctx.modelResponse, '');
    });
});

suite('ParseStage (integration)', () => {
    const logger = new Logger('test', false);

    test('parses a minimal Python function and populates ctx.parsed', async () => {
        const parserBin = path.resolve(__dirname, '../../cpp_native/build/bin/parser');
        try {
            await access(parserBin);
        } catch {
            console.log(`ParseStage test skipped: binary not found at ${parserBin}`);
            return;
        }
        const stage = new ParseStage(parserBin);
        const ctx = new ElevateContext('def foo():\n    pass\n');
        await stage.run(ctx, logger);
        assert.ok(Array.isArray(ctx.parsed), 'ctx.parsed should be an array');
        assert.ok(ctx.parsed!.length > 0, 'ctx.parsed should contain at least one event');
    });
});

suite('PromptBuilderStage (integration)', () => {
    const logger = new Logger('test', false);
    const promptBuilderBin = path.resolve(__dirname, '../../cpp_native/build/bin/prompt_builder');
    const parserBin = path.resolve(__dirname, '../../cpp_native/build/bin/parser');

    test('throws when ctx.parsed is not set', async () => {
        const stage = new PromptBuilderStage(promptBuilderBin);
        const ctx = new ElevateContext('def foo(): pass');
        await assert.rejects(() => stage.run(ctx, logger), /ctx.parsed is not set/);
    });

    test('populates ctx.prompt from real parser output', async () => {
        try {
            await access(promptBuilderBin);
        } catch {
            console.log('PromptBuilderStage test skipped: binary not found');
            return;
        }

        const ctx = new ElevateContext('def add(a, b):\n    return a + b\n');
        await new ParseStage(parserBin).run(ctx, logger);
        await new PromptBuilderStage(promptBuilderBin).run(ctx, logger);

        assert.ok(Array.isArray(ctx.prompt) && ctx.prompt!.length > 0, 'ctx.prompt should be set');
        assert.ok(ctx.prompt![0].content.includes('Role:'), 'prompt should include Role section from prompt_builder');
    });
});

suite('SseHub', () => {
    test('emits events to subscribers', () => {
        const hub = new SseHub();
        const received: any[] = [];
        hub.subscribe('job-1', (evt) => received.push(evt));
        const evt = { id: '1', job_id: 'job-1', ts: 'now', event_type: 'STATUS' as const, payload: { status: 'queued' } };
        hub.emit(evt);
        assert.strictEqual(received.length, 1);
        assert.strictEqual(received[0].payload.status, 'queued');
    });

    test('unsubscribe stops receiving events', () => {
        const hub = new SseHub();
        const received: any[] = [];
        const unsub = hub.subscribe('job-2', (evt) => received.push(evt));
        const evt = (n: string) => ({ id: n, job_id: 'job-2', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        hub.emit(evt('a'));
        unsub();
        hub.emit(evt('b'));
        assert.strictEqual(received.length, 1);
    });

    test('getHistory returns events after given index', () => {
        const hub = new SseHub();
        const evt = (n: string) => ({ id: n, job_id: 'job-3', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        hub.emit(evt('1'));
        hub.emit(evt('2'));
        hub.emit(evt('3'));
        const history = hub.getHistory('job-3', 1);
        assert.strictEqual(history.length, 2);
        assert.strictEqual(history[0].id, '2');
    });

    test('does not emit to other job subscribers', () => {
        const hub = new SseHub();
        const received: any[] = [];
        hub.subscribe('job-A', (evt) => received.push(evt));
        hub.emit({ id: '1', job_id: 'job-B', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        assert.strictEqual(received.length, 0);
    });
});

suite('JobQueue', () => {
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
});
