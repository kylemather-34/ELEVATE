"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyedDebouncer = void 0;
/**
 * KeyedDebouncer: debounce independent streams (per document URI) without deps.
 * - trailing debounce always
 * - optional maxWait prevents starvation during continuous typing
 */
class KeyedDebouncer {
    cfg;
    pending = new Map();
    timers = new Map();
    maxTimers = new Map();
    constructor(cfg) {
        this.cfg = cfg;
    }
    schedule(key, fn) {
        this.pending.set(key, fn);
        const existing = this.timers.get(key);
        if (existing)
            clearTimeout(existing);
        this.timers.set(key, setTimeout(() => this.fire(key), this.cfg.delayMs));
        if (this.cfg.maxWaitMs && !this.maxTimers.has(key)) {
            this.maxTimers.set(key, setTimeout(() => this.fire(key), this.cfg.maxWaitMs));
        }
    }
    flush(key) {
        this.fire(key);
    }
    cancel(key) {
        const t = this.timers.get(key);
        if (t)
            clearTimeout(t);
        this.timers.delete(key);
        const mt = this.maxTimers.get(key);
        if (mt)
            clearTimeout(mt);
        this.maxTimers.delete(key);
        this.pending.delete(key);
    }
    dispose() {
        for (const k of this.timers.keys())
            this.cancel(k);
    }
    fire(key) {
        const t = this.timers.get(key);
        if (t)
            clearTimeout(t);
        this.timers.delete(key);
        const mt = this.maxTimers.get(key);
        if (mt)
            clearTimeout(mt);
        this.maxTimers.delete(key);
        const fn = this.pending.get(key);
        this.pending.delete(key);
        if (fn)
            fn();
    }
}
exports.KeyedDebouncer = KeyedDebouncer;
//# sourceMappingURL=debounce.js.map