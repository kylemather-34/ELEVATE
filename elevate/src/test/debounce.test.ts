import * as assert from 'assert';
import { KeyedDebouncer } from '../util/debounce';

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

suite('KeyedDebouncer', () => {
    test('fires function after the configured delay', async () => {
        let fired = false;
        const d = new KeyedDebouncer({ delayMs: 20 });
        d.schedule('k', () => { fired = true; });
        assert.strictEqual(fired, false, 'should not fire before delay');
        await delay(50);
        assert.strictEqual(fired, true, 'should fire after delay');
    });

    test('multiple rapid calls only fire once (trailing edge)', async () => {
        let count = 0;
        const d = new KeyedDebouncer({ delayMs: 30 });
        d.schedule('k', () => count++);
        d.schedule('k', () => count++);
        d.schedule('k', () => count++);
        await delay(70);
        assert.strictEqual(count, 1);
    });

    test('cancel prevents the function from firing', async () => {
        let fired = false;
        const d = new KeyedDebouncer({ delayMs: 20 });
        d.schedule('k', () => { fired = true; });
        d.cancel('k');
        await delay(50);
        assert.strictEqual(fired, false);
    });

    test('flush fires immediately without waiting', () => {
        let fired = false;
        const d = new KeyedDebouncer({ delayMs: 1000 });
        d.schedule('k', () => { fired = true; });
        assert.strictEqual(fired, false);
        d.flush('k');
        assert.strictEqual(fired, true);
    });

    test('flush on a key with no pending callback does nothing', () => {
        const d = new KeyedDebouncer({ delayMs: 20 });
        assert.doesNotThrow(() => d.flush('no-such-key'));
    });

    test('cancel on a key with no pending callback does nothing', () => {
        const d = new KeyedDebouncer({ delayMs: 20 });
        assert.doesNotThrow(() => d.cancel('no-such-key'));
    });

    test('different keys are debounced independently', async () => {
        const results: string[] = [];
        const d = new KeyedDebouncer({ delayMs: 20 });
        d.schedule('a', () => results.push('a'));
        d.schedule('b', () => results.push('b'));
        await delay(50);
        assert.ok(results.includes('a'));
        assert.ok(results.includes('b'));
        assert.strictEqual(results.length, 2);
    });

    test('dispose cancels all pending callbacks', async () => {
        let firedA = false;
        let firedB = false;
        const d = new KeyedDebouncer({ delayMs: 30 });
        d.schedule('a', () => { firedA = true; });
        d.schedule('b', () => { firedB = true; });
        d.dispose();
        await delay(70);
        assert.strictEqual(firedA, false);
        assert.strictEqual(firedB, false);
    });

    test('maxWait fires before delay when calls keep coming in', async () => {
        let count = 0;
        // delayMs is long, maxWaitMs is short — maxWait should fire first
        const d = new KeyedDebouncer({ delayMs: 200, maxWaitMs: 40 });
        const reschedule = () => {
            d.schedule('k', () => count++);
        };
        // Keep rescheduling every 20ms (faster than delayMs, slower than maxWait)
        reschedule();
        const interval = setInterval(reschedule, 20);
        await delay(80);
        clearInterval(interval);
        d.dispose();
        assert.ok(count >= 1, `expected at least one maxWait fire, got ${count}`);
    });

    test('schedule after flush works correctly', async () => {
        let count = 0;
        const d = new KeyedDebouncer({ delayMs: 20 });
        d.schedule('k', () => count++);
        d.flush('k');
        assert.strictEqual(count, 1);

        d.schedule('k', () => count++);
        await delay(50);
        assert.strictEqual(count, 2);
    });
});
