"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const ElevateContext_1 = require("../backend/ElevateContext");
const CoreStateManager_1 = require("../backend/CoreStateManager");
const Pipeline_1 = require("../pipeline/Pipeline");
const Logger_1 = require("../Logger");
suite('ElevateContext', () => {
    test('constructs from text string', () => {
        const ctx = new ElevateContext_1.ElevateContext('hello world');
        assert.strictEqual(ctx.text, 'hello world');
        assert.strictEqual(ctx.snapshot, undefined);
    });
    test('analysisTarget is undefined by default', () => {
        const ctx = new ElevateContext_1.ElevateContext('some code');
        assert.strictEqual(ctx.analysisTarget, undefined);
    });
    test('parsed is undefined by default', () => {
        const ctx = new ElevateContext_1.ElevateContext('some code');
        assert.strictEqual(ctx.parsed, undefined);
    });
    test('parsed is undefined by default', () => {
        const ctx = new ElevateContext_1.ElevateContext('some code');
        assert.strictEqual(ctx.parsed, undefined);
    });
});
suite('CoreStateManager', () => {
    test('throws if not initialized before saveState', () => {
        const manager = new CoreStateManager_1.CoreStateManager();
        const ctx = new ElevateContext_1.ElevateContext('test');
        assert.throws(() => manager.saveState(ctx));
    });
    test('throws if not initialized before loadState', () => {
        const manager = new CoreStateManager_1.CoreStateManager();
        assert.throws(() => manager.loadState());
    });
    test('loadState returns undefined before any state is saved', () => {
        const manager = new CoreStateManager_1.CoreStateManager();
        manager.initialize();
        assert.strictEqual(manager.loadState(), undefined);
    });
    test('saveState and loadState round-trip', () => {
        const manager = new CoreStateManager_1.CoreStateManager();
        manager.initialize();
        const ctx = new ElevateContext_1.ElevateContext('test code');
        manager.saveState(ctx);
        assert.strictEqual(manager.loadState(), ctx);
    });
    test('getSnapshot returns undefined when no state saved', () => {
        const manager = new CoreStateManager_1.CoreStateManager();
        manager.initialize();
        assert.strictEqual(manager.getSnapshot(), undefined);
    });
});
suite('Pipeline', () => {
    test('executes stages in order', async () => {
        const order = [];
        const makeStage = (n) => ({
            name: `stage-${n}`,
            run: async (_ctx) => { order.push(n); }
        });
        const logger = new Logger_1.Logger('test', false);
        const pipeline = new Pipeline_1.Pipeline([makeStage(1), makeStage(2), makeStage(3)], logger);
        const ctx = new ElevateContext_1.ElevateContext('test');
        await pipeline.execute(ctx);
        assert.deepStrictEqual(order, [1, 2, 3]);
    });
    test('stops execution and throws when a stage fails', async () => {
        const ran = [];
        const good = { name: 'good', run: async () => { ran.push('good'); } };
        const bad = { name: 'bad', run: async () => { throw new Error('stage failed'); } };
        const after = { name: 'after', run: async () => { ran.push('after'); } };
        const logger = new Logger_1.Logger('test', false);
        const pipeline = new Pipeline_1.Pipeline([good, bad, after], logger);
        const ctx = new ElevateContext_1.ElevateContext('test');
        await assert.rejects(() => pipeline.execute(ctx), /stage failed/);
        assert.deepStrictEqual(ran, ['good']);
    });
});
//# sourceMappingURL=extension.test.js.map