import { JobEvent } from "./types";

type Listener = (evt: JobEvent) => void;

const MAX_HISTORY_JOBS = 200;

export class SseHub {
  private listeners = new Map<string, Set<Listener>>();
  private history = new Map<string, JobEvent[]>(); // small in-memory ring per job

  emit(evt: JobEvent) {
    if (!this.history.has(evt.job_id) && this.history.size >= MAX_HISTORY_JOBS) {
      // Evict oldest job that has no active listeners (i.e. already done)
      let evicted = false;
      for (const key of this.history.keys()) {
        if (!this.listeners.has(key) || this.listeners.get(key)!.size === 0) {
          this.history.delete(key);
          evicted = true;
          break;
        }
      }
      // Fall back to evicting the oldest job if all have active listeners
      if (!evicted) {
        const oldest = this.history.keys().next().value as string;
        this.history.delete(oldest);
      }
    }
    const arr = this.history.get(evt.job_id) ?? [];
    arr.push(evt);
    // keep last 500 events
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    this.history.set(evt.job_id, arr);

    const set = this.listeners.get(evt.job_id);
    if (!set) return;
    for (const fn of set) fn(evt);
  }

  subscribe(jobId: string, fn: Listener): () => void {
    const set = this.listeners.get(jobId) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(jobId, set);
    return () => {
      const s = this.listeners.get(jobId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.listeners.delete(jobId);
    };
  }

  prune(jobId: string): void {
    this.history.delete(jobId);
    this.listeners.delete(jobId);
  }

  getHistory(jobId: string, afterIndex: number): JobEvent[] {
    const arr = this.history.get(jobId) ?? [];
    return arr.slice(Math.max(0, afterIndex));
  }
}