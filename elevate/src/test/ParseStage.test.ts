import * as assert from 'assert';
import * as path from 'path';
import { access } from 'fs/promises';
import { ElevateContext } from '../backend/ElevateContext';
import { ParseStage } from '../pipeline/Stage';
import { Logger } from '../util/Logger';

suite('ParseStage (integration)', () => {
    const logger = new Logger('test', false);
    const parserBin = path.resolve(__dirname, '../../cpp_native/build/bin/parser');

    async function parserAvailable(): Promise<boolean> {
        try { await access(parserBin); return true; } catch { return false; }
    }

    test('parses a minimal Python function and populates ctx.parsed', async () => {
        if (!await parserAvailable()) {
            console.log(`ParseStage test skipped: binary not found at ${parserBin}`);
            return;
        }
        const stage = new ParseStage(parserBin);
        const ctx = new ElevateContext('def foo():\n    pass\n');
        await stage.run(ctx, logger);
        assert.ok(Array.isArray(ctx.parsed), 'ctx.parsed should be an array');
        assert.ok(ctx.parsed!.length > 0, 'ctx.parsed should contain at least one event');
    });

    test('parses a Python class with methods', async () => {
        if (!await parserAvailable()) { return; }
        const stage = new ParseStage(parserBin);
        const ctx = new ElevateContext('class Foo:\n    def bar(self):\n        return 42\n');
        await stage.run(ctx, logger);
        assert.ok(Array.isArray(ctx.parsed));
        assert.ok(ctx.parsed!.length > 0);
    });

    test('throws when binary does not exist', async () => {
        const stage = new ParseStage('/nonexistent/parser');
        const ctx = new ElevateContext('def foo(): pass');
        await assert.rejects(() => stage.run(ctx, logger));
    });
});
