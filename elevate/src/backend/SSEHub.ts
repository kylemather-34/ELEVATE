import { JobEvent } from "./types";

type Listener = (evt: JobEvent) => void;

export class SseHub {
  private listeners = new Map<string, Set<Listener>>();
  private history = new Map<string, JobEvent[]>(); // small in-memory ring per job

  emit(evt: JobEvent) {
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

  getHistory(jobId: string, afterIndex: number): JobEvent[] {
    const arr = this.history.get(jobId) ?? [];
    return arr.slice(Math.max(0, afterIndex));
  }
}