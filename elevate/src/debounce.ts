// elevate/src/debounce.ts
export interface DebounceConfig {
  delayMs: number;
  maxWaitMs?: number;
}

/**
 * KeyedDebouncer: debounce independent streams (per document URI) without deps.
 * - trailing debounce always
 * - optional maxWait prevents starvation during continuous typing
 */
export class KeyedDebouncer<K> {
  private pending = new Map<K, () => void>();
  private timers = new Map<K, NodeJS.Timeout>();
  private maxTimers = new Map<K, NodeJS.Timeout>();

  constructor(private cfg: DebounceConfig) {}

  schedule(key: K, fn: () => void): void {
    this.pending.set(key, fn);

    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(
      key,
      setTimeout(() => this.fire(key), this.cfg.delayMs)
    );

    if (this.cfg.maxWaitMs && !this.maxTimers.has(key)) {
      this.maxTimers.set(
        key,
        setTimeout(() => this.fire(key), this.cfg.maxWaitMs)
      );
    }
  }

  flush(key: K): void {
    this.fire(key);
  }

  cancel(key: K): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);

    const mt = this.maxTimers.get(key);
    if (mt) clearTimeout(mt);
    this.maxTimers.delete(key);

    this.pending.delete(key);
  }

  dispose(): void {
    for (const k of this.timers.keys()) this.cancel(k);
  }

  private fire(key: K): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);

    const mt = this.maxTimers.get(key);
    if (mt) clearTimeout(mt);
    this.maxTimers.delete(key);

    const fn = this.pending.get(key);
    this.pending.delete(key);

    if (fn) fn();
  }
}