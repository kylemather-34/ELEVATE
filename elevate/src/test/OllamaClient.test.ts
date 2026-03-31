import * as assert from 'assert';
import { OllamaClient } from '../backend/OllamaClient';

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

    test('chatStream() yields empty delta when message content is empty string', async () => {
        const ndjson = JSON.stringify({ message: { content: '' }, done: true }) + '\n';
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
        const chunks: any[] = [];
        const abort = new AbortController();
        for await (const chunk of client.chatStream({
            model: 'test',
            messages: [],
            signal: abort.signal,
        })) {
            chunks.push(chunk);
        }
        assert.ok(chunks.length > 0);
    });

    test('chatStream() throws when fetch returns non-ok', async () => {
        (globalThis as any).fetch = async () => ({ ok: false, status: 500 });
        const client = new OllamaClient('http://localhost:11434');
        const abort = new AbortController();
        await assert.rejects(async () => {
            for await (const _ of client.chatStream({ model: 'test', messages: [], signal: abort.signal })) {
                // should not get here
            }
        }, /500/);
    });
});
