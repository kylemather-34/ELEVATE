import * as assert from 'assert';
import { ElevateContext } from '../backend/ElevateContext';
import { CoreStateManager } from '../backend/CoreStateManager';
import { SessionContext } from '../backend/SessionContext';

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

    test('isInitialized returns false before initialize()', () => {
        const manager = new CoreStateManager();
        assert.strictEqual(manager.isInitialized(), false);
    });

    test('isInitialized returns true after initialize()', () => {
        const manager = new CoreStateManager();
        manager.initialize();
        assert.strictEqual(manager.isInitialized(), true);
    });

    test('saveState overwrites previous state', () => {
        const manager = new CoreStateManager();
        manager.initialize();
        const ctx1 = new ElevateContext('first');
        const ctx2 = new ElevateContext('second');
        manager.saveState(ctx1);
        manager.saveState(ctx2);
        assert.strictEqual(manager.loadState(), ctx2);
    });

    test('getSession returns the same instance on repeated calls', () => {
        const manager = new CoreStateManager();
        assert.strictEqual(manager.getSession(), manager.getSession());
    });
});
