import * as assert from 'assert';
import { saveElevateState, loadElevateState, ElevatePersistedState } from '../backend/StorageLayer';

function makeContext(initial?: ElevatePersistedState) {
    const store: Record<string, unknown> = {};
    if (initial !== undefined) {
        store['elevate.state'] = initial;
    }
    return {
        globalState: {
            get<T>(key: string, defaultValue: T): T {
                return key in store ? (store[key] as T) : defaultValue;
            },
            update(key: string, value: unknown): Thenable<void> {
                store[key] = value;
                return Promise.resolve();
            },
        },
    } as any;
}

suite('StorageLayer', () => {
    suite('loadElevateState', () => {
        test('returns default when nothing persisted', () => {
            const ctx = makeContext();
            const state = loadElevateState(ctx);
            assert.deepStrictEqual(state, { recentFeedback: [] });
        });

        test('returns persisted state', () => {
            const persisted: ElevatePersistedState = {
                recentFeedback: [{ timestamp: 't', filePath: 'f', response: 'r' }],
            };
            const ctx = makeContext(persisted);
            const state = loadElevateState(ctx);
            assert.deepStrictEqual(state, persisted);
        });

        test('returns persisted state with lastActiveFile', () => {
            const persisted: ElevatePersistedState = {
                recentFeedback: [],
                lastActiveFile: { uri: 'file:///a.ts', language: 'typescript', version: 3, text: 'x' },
            };
            const ctx = makeContext(persisted);
            assert.deepStrictEqual(loadElevateState(ctx), persisted);
        });
    });

    suite('saveElevateState', () => {
        test('persisted state can be loaded back', () => {
            const ctx = makeContext();
            const state: ElevatePersistedState = {
                recentFeedback: [{ timestamp: 't', filePath: 'f', response: 'r' }],
            };
            saveElevateState(ctx, state);
            assert.deepStrictEqual(loadElevateState(ctx), state);
        });

        test('caps recentFeedback at 50 entries', () => {
            const ctx = makeContext();
            const feedback = Array.from({ length: 60 }, (_, i) => ({
                timestamp: `t${i}`,
                filePath: 'f',
                response: `r${i}`,
            }));
            saveElevateState(ctx, { recentFeedback: feedback });
            const loaded = loadElevateState(ctx);
            assert.strictEqual(loaded.recentFeedback.length, 50);
        });

        test('keeps the most recent entries when capping', () => {
            const ctx = makeContext();
            const feedback = Array.from({ length: 60 }, (_, i) => ({
                timestamp: `t${i}`,
                filePath: 'f',
                response: `r${i}`,
            }));
            saveElevateState(ctx, { recentFeedback: feedback });
            const loaded = loadElevateState(ctx);
            assert.strictEqual(loaded.recentFeedback[0].response, 'r10');
            assert.strictEqual(loaded.recentFeedback[49].response, 'r59');
        });

        test('does not mutate the input state', () => {
            const ctx = makeContext();
            const feedback = Array.from({ length: 60 }, (_, i) => ({
                timestamp: `t${i}`,
                filePath: 'f',
                response: `r${i}`,
            }));
            const state: ElevatePersistedState = { recentFeedback: feedback };
            saveElevateState(ctx, state);
            assert.strictEqual(state.recentFeedback.length, 60);
        });

        test('preserves lastActiveFile', () => {
            const ctx = makeContext();
            const state: ElevatePersistedState = {
                recentFeedback: [],
                lastActiveFile: { uri: 'file:///b.ts', language: 'typescript', version: 1, text: '' },
            };
            saveElevateState(ctx, state);
            assert.deepStrictEqual(loadElevateState(ctx).lastActiveFile, state.lastActiveFile);
        });

        test('overwrites previously saved state', () => {
            const ctx = makeContext();
            saveElevateState(ctx, {
                recentFeedback: [{ timestamp: 't1', filePath: 'f', response: 'first' }],
            });
            saveElevateState(ctx, {
                recentFeedback: [{ timestamp: 't2', filePath: 'f', response: 'second' }],
            });
            const loaded = loadElevateState(ctx);
            assert.strictEqual(loaded.recentFeedback.length, 1);
            assert.strictEqual(loaded.recentFeedback[0].response, 'second');
        });
    });
});
