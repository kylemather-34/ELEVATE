import * as assert from 'assert';
import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { CoreStateManager } from '../backend/CoreStateManager';
import { Pipeline } from '../pipeline/Pipeline';
import { Stage, SanitizationStage, PromptBuilderStage } from '../pipeline/Stage';
import { Logger } from '../Logger';

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
});

suite('Pipeline', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('executes stages in order', async () => {
        const order: number[] = [];

        const makeStage = (n: number): Stage => ({
            name: `stage-${n}`,
            run: async (_ctx) => { order.push(n); }
        });

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([makeStage(1), makeStage(2), makeStage(3)], logger);
        const ctx = new ElevateContext('test');
        await pipeline.execute(ctx);

        assert.deepStrictEqual(order, [1, 2, 3]);
    });

    test('stops execution and throws when a stage fails', async () => {
        const ran: string[] = [];

        const good: Stage = { name: 'good', run: async () => { ran.push('good'); } };
        const bad: Stage = { name: 'bad', run: async () => { throw new Error('stage failed'); } };
        const after: Stage = { name: 'after', run: async () => { ran.push('after'); } };

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([good, bad, after], logger);
        const ctx = new ElevateContext('test');

        await assert.rejects(() => pipeline.execute(ctx), /stage failed/);
        assert.deepStrictEqual(ran, ['good']);
    });

    test('runs without throwing on stubbed stages', async () => {
        const ctx = new ElevateContext('test context');
        const logger = new Logger('test', false);
        const pipeline = new Pipeline(
            [new SanitizationStage(), new PromptBuilderStage()],
            logger
        );
        await assert.doesNotReject(() => pipeline.execute(ctx));
    });
});
