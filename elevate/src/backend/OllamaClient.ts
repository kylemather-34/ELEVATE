import { ChatMessage } from "./types";

export class OllamaClient {
  constructor(private readonly baseUrl: string) {}

  async tags(): Promise<any> {
    const r = await fetch(`${this.baseUrl}/api/tags`);
    if (!r.ok) throw new Error(`Ollama /api/tags failed: ${r.status}`);
    return r.json();
  }

  async ps(): Promise<any> {
    const r = await fetch(`${this.baseUrl}/api/ps`);
    if (!r.ok) throw new Error(`Ollama /api/ps failed: ${r.status}`);
    return r.json();
  }

  async *chatStream(args: {
    model: string;
    messages: ChatMessage[];
    options?: Record<string, any>;
    keep_alive?: string;
    signal?: AbortSignal;
  }): AsyncGenerator<{ delta?: string; raw: any }, void, void> {
    const body = {
      model: args.model,
      messages: args.messages,
      stream: true,
      keep_alive: args.keep_alive ?? "5m",
      options: args.options ?? {},
    };

    const r = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: args.signal,
    });

    if (!r.ok || !r.body) {
      const text = await r.text().catch(() => "");
      throw new Error(`Ollama /api/chat failed: ${r.status} ${text}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // NDJSON: split on newlines
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;

        let raw: any;
        try {
          raw = JSON.parse(line);
        } catch {
          console.warn(`[OllamaClient] Skipping malformed NDJSON line: ${line}`);
          continue;
        }
        const delta = raw?.message?.content ?? "";
        yield { delta, raw };

        if (raw?.done) return;
      }
    }
  }
}