import * as assert from 'assert';
import { ElevateContext } from '../backend/ElevateContext';
import { OllamaStage } from '../pipeline/Stage';
import { OllamaClient } from '../backend/OllamaClient';
import { Logger } from '../util/Logger';

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

    test('accumulates many chunks correctly', async () => {
        const mockClient = {
            chatStream: async function* () {
                for (const word of ['one', ' ', 'two', ' ', 'three']) {
                    yield { delta: word, raw: {} };
                }
                yield { delta: '', raw: { done: true } };
            },
        } as any as OllamaClient;
        const stage = new OllamaStage(mockClient);
        const ctx = new ElevateContext('test');
        ctx.prompt = [{ role: 'user', content: 'count' }];
        await stage.run(ctx, logger);
        assert.strictEqual(ctx.modelResponse, 'one two three');
    });
});
