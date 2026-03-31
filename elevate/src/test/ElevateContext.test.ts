import * as assert from 'assert';
import { ElevateContext } from '../backend/ElevateContext';

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

    test('prompt is undefined by default', () => {
        const ctx = new ElevateContext('some code');
        assert.strictEqual(ctx.prompt, undefined);
    });

    test('modelResponse is undefined by default', () => {
        const ctx = new ElevateContext('some code');
        assert.strictEqual(ctx.modelResponse, undefined);
    });

    test('cursorLine can be set and retrieved', () => {
        const ctx = new ElevateContext('some code');
        ctx.cursorLine = 5;
        assert.strictEqual(ctx.cursorLine, 5);
    });

    test('prompt can be set directly', () => {
        const ctx = new ElevateContext('some code');
        ctx.prompt = [{ role: 'user', content: 'hello' }];
        assert.strictEqual(ctx.prompt!.length, 1);
        assert.strictEqual(ctx.prompt![0].content, 'hello');
    });
});
