import * as assert from 'assert';
import * as path from 'path';
import { access } from 'fs/promises';
import { ElevateContext } from '../backend/ElevateContext';
import { ParseStage, PromptBuilderStage } from '../pipeline/Stage';
import { Logger } from '../util/Logger';

suite('PromptBuilderStage (integration)', () => {
    const logger = new Logger('test', false);
    const promptBuilderBin = path.resolve(__dirname, '../../cpp_native/build/bin/prompt_builder');
    const parserBin = path.resolve(__dirname, '../../cpp_native/build/bin/parser');

    async function binAvailable(p: string): Promise<boolean> {
        try { await access(p); return true; } catch { return false; }
    }

    test('throws when ctx.parsed is not set', async () => {
        const stage = new PromptBuilderStage(promptBuilderBin);
        const ctx = new ElevateContext('def foo(): pass');
        await assert.rejects(() => stage.run(ctx, logger), /ctx.parsed is not set/);
    });

    test('populates ctx.prompt from real parser output', async () => {
        if (!await binAvailable(promptBuilderBin)) {
            console.log('PromptBuilderStage test skipped: binary not found');
            return;
        }

        const ctx = new ElevateContext('def add(a, b):\n    return a + b\n');
        await new ParseStage(parserBin).run(ctx, logger);
        await new PromptBuilderStage(promptBuilderBin).run(ctx, logger);

        assert.ok(Array.isArray(ctx.prompt) && ctx.prompt!.length > 0, 'ctx.prompt should be set');
        assert.ok(ctx.prompt![0].content.includes('Role:'), 'prompt should include Role section');
    });

    test('throws when binary does not exist', async () => {
        const stage = new PromptBuilderStage('/nonexistent/prompt_builder');
        const ctx = new ElevateContext('def foo(): pass');
        ctx.parsed = [];
        await assert.rejects(() => stage.run(ctx, logger));
    });
});
