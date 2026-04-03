import { ChatMessage } from "./types";
import { Logger, Component } from "../util/Logger";

export class OllamaClient {
    private logger: Logger;

    constructor(
    private readonly baseUrl: string,
    logger?: Logger
    ) {
    this.logger = logger
        ? logger.forComponent(Component.Ollama)
        : new Logger("ELEVATE", true, Component.Ollama);
    }

    async tags(): Promise<any> {
        this.logger.debug(`tags(): GET ${this.baseUrl}/api/tags`);
        const r = await fetch(`${this.baseUrl}/api/tags`);
        if (!r.ok) {
            this.logger.error(`tags(): failed with status ${r.status}`);
            throw new Error(`Ollama /api/tags failed: ${r.status}`);
        }
        const result = await r.json();
        this.logger.debug(`tags(): received ${(result as any)?.models?.length ?? 0} model(s)`);
        return result;
    }

    async ps(): Promise<any> {
        this.logger.debug(`ps(): GET ${this.baseUrl}/api/ps`);
        const r = await fetch(`${this.baseUrl}/api/ps`);
        if (!r.ok) {
            this.logger.error(`ps(): failed with status ${r.status}`);
            throw new Error(`Ollama /api/ps failed: ${r.status}`);
        }
        const result = await r.json();
        this.logger.debug(`ps(): received response`);
        return result;
    }

    async *chatStream(args: {
        model: string;
        messages: ChatMessage[];
        options?: Record<string, any>;
        keep_alive?: string;
        signal: AbortSignal;
    }): AsyncGenerator<{ delta?: string; raw: any }, void, void> {
        this.logger.info(`chatStream(): starting request — model="${args.model}" messages=${args.messages.length}`);

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
            this.logger.error(`chatStream(): request failed — status=${r.status} body="${text}"`);
            throw new Error(`Ollama /api/chat failed: ${r.status} ${text}`);
        }

        this.logger.debug(`chatStream(): connection established, streaming response`);

        const reader = r.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let totalChars = 0;
        let chunkCount = 0;

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

                const raw = JSON.parse(line);
                const delta = raw?.message?.content ?? "";

                if (delta) {
                    totalChars += delta.length;
                    chunkCount++;
                }

                yield { delta, raw };

                if (raw?.done) {
                    this.logger.info(`chatStream(): complete — ${chunkCount} chunk(s), ${totalChars} total char(s)`);
                    return;
                }
            }
        }

        this.logger.warn(`chatStream(): stream ended without done=true`);
    }
}