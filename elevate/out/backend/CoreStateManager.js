"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreStateManager = void 0;
class CoreStateManager {
    currentSnapshot;
    currentContext;
    initialized = false;
    initialize() {
        this.currentSnapshot = undefined;
        this.currentContext = undefined;
        this.initialized = true;
    }
    saveState(context) {
        if (!this.initialized) {
            throw new Error('CoreStateManager has not been initialized.');
        }
        this.currentContext = context;
        this.currentSnapshot = context.snapshot;
    }
    loadState() {
        if (!this.initialized) {
            throw new Error('CoreStateManager has not been initialized.');
        }
        return this.currentContext;
    }
    getSnapshot() {
        return this.currentSnapshot;
    }
    isInitialized() {
        return this.initialized;
    }
}
exports.CoreStateManager = CoreStateManager;
//# sourceMappingURL=CoreStateManager.js.map