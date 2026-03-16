"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseHub = void 0;
class SseHub {
    listeners = new Map();
    history = new Map(); // small in-memory ring per job
    emit(evt) {
        const arr = this.history.get(evt.job_id) ?? [];
        arr.push(evt);
        // keep last 500 events
        if (arr.length > 500)
            arr.splice(0, arr.length - 500);
        this.history.set(evt.job_id, arr);
        const set = this.listeners.get(evt.job_id);
        if (!set)
            return;
        for (const fn of set)
            fn(evt);
    }
    subscribe(jobId, fn) {
        const set = this.listeners.get(jobId) ?? new Set();
        set.add(fn);
        this.listeners.set(jobId, set);
        return () => {
            const s = this.listeners.get(jobId);
            if (!s)
                return;
            s.delete(fn);
            if (s.size === 0)
                this.listeners.delete(jobId);
        };
    }
    getHistory(jobId, afterIndex) {
        const arr = this.history.get(jobId) ?? [];
        return arr.slice(Math.max(0, afterIndex));
    }
}
exports.SseHub = SseHub;
//# sourceMappingURL=SSEHub.js.map