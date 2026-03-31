import * as assert from 'assert';
import { safeJsonParse, safeJsonStringify } from '../util/json';

suite('safeJsonParse', () => {
    test('parses valid JSON object', () => {
        const result = safeJsonParse<{ a: number }>('{"a":1}', { a: 0 });
        assert.strictEqual(result.a, 1);
    });

    test('parses valid JSON array', () => {
        const result = safeJsonParse<number[]>('[1,2,3]', []);
        assert.deepStrictEqual(result, [1, 2, 3]);
    });

    test('returns fallback for invalid JSON', () => {
        const result = safeJsonParse<string>('not json', 'default');
        assert.strictEqual(result, 'default');
    });

    test('returns fallback for empty string', () => {
        const result = safeJsonParse('', null);
        assert.strictEqual(result, null);
    });

    test('returns fallback for partially valid JSON', () => {
        const result = safeJsonParse<object>('{invalid}', {});
        assert.deepStrictEqual(result, {});
    });

    test('parses JSON null', () => {
        const result = safeJsonParse<null>('null', 'fallback' as any);
        assert.strictEqual(result, null);
    });

    test('parses JSON number', () => {
        const result = safeJsonParse<number>('42', 0);
        assert.strictEqual(result, 42);
    });
});

suite('safeJsonStringify', () => {
    test('produces indented JSON', () => {
        const output = safeJsonStringify({ key: 'value' });
        assert.ok(output.includes('\n'), 'should be multi-line');
        assert.ok(output.includes('  '), 'should be indented');
    });

    test('round-trips with safeJsonParse', () => {
        const obj = { x: 1, y: [2, 3] };
        const parsed = safeJsonParse(safeJsonStringify(obj), null);
        assert.deepStrictEqual(parsed, obj);
    });

    test('stringifies arrays', () => {
        const output = safeJsonStringify([1, 2, 3]);
        assert.ok(output.includes('1'));
        assert.ok(output.includes('3'));
    });

    test('stringifies nested objects', () => {
        const output = safeJsonStringify({ outer: { inner: true } });
        assert.ok(output.includes('"inner"'));
        assert.ok(output.includes('true'));
    });
});
