import * as assert from 'assert';
import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { Pipeline } from '../pipeline/Pipeline';
import { Stage, SanitizationStage } from '../pipeline/Stage';
import { Logger } from '../util/Logger';

suite('Pipeline', () => {
    vscode.window.showInformationMessage('Start Pipeline tests.');

    test('executes stages in order', async () => {
        const order: number[] = [];

        const makeStage = (n: number): Stage => ({
            name: `stage-${n}`,
            run: async (_ctx, _logger) => { order.push(n); }
        });

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([makeStage(1), makeStage(2), makeStage(3)], logger);
        const ctx = new ElevateContext('test');
        await pipeline.execute(ctx);

        assert.deepStrictEqual(order, [1, 2, 3]);
    });

    test('stops execution and throws when a stage fails', async () => {
        const ran: string[] = [];

        const good: Stage = { name: 'good', run: async (_ctx, _logger) => { ran.push('good'); } };
        const bad: Stage = { name: 'bad', run: async (_ctx, _logger) => { throw new Error('stage failed'); } };
        const after: Stage = { name: 'after', run: async (_ctx, _logger) => { ran.push('after'); } };

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([good, bad, after], logger);
        const ctx = new ElevateContext('test');

        await assert.rejects(() => pipeline.execute(ctx), /stage failed/);
        assert.deepStrictEqual(ran, ['good']);
    });

    test('runs without throwing on SanitizationStage alone', async () => {
        const ctx = new ElevateContext('test context');
        const logger = new Logger('test', false);
        const pipeline = new Pipeline([new SanitizationStage()], logger);
        await assert.doesNotReject(() => pipeline.execute(ctx));
    });

    test('executes successfully with empty stage list', async () => {
        const logger = new Logger('test', false);
        const pipeline = new Pipeline([], logger);
        const ctx = new ElevateContext('test');
        await assert.doesNotReject(() => pipeline.execute(ctx));
    });

    test('passes the same ctx instance through every stage', async () => {
        const seen: ElevateContext[] = [];
        const makeStage = (): Stage => ({
            name: 'recorder',
            run: async (ctx, _logger) => { seen.push(ctx); }
        });

        const logger = new Logger('test', false);
        const ctx = new ElevateContext('test');
        const pipeline = new Pipeline([makeStage(), makeStage()], logger);
        await pipeline.execute(ctx);

        assert.strictEqual(seen[0], ctx);
        assert.strictEqual(seen[1], ctx);
    });

    test('stage can mutate ctx and next stage sees the change', async () => {
        const writer: Stage = {
            name: 'writer',
            run: async (ctx, _logger) => { ctx.analysisTarget = 'mutated'; }
        };
        const reader: Stage = {
            name: 'reader',
            run: async (ctx, _logger) => {
                assert.strictEqual(ctx.analysisTarget, 'mutated');
            }
        };

        const logger = new Logger('test', false);
        const pipeline = new Pipeline([writer, reader], logger);
        await pipeline.execute(new ElevateContext('test'));
    });
});
