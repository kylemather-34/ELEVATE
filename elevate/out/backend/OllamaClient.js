"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = void 0;
class OllamaClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async tags() {
        const r = await fetch(`${this.baseUrl}/api/tags`);
        if (!r.ok)
            throw new Error(`Ollama /api/tags failed: ${r.status}`);
        return r.json();
    }
    async ps() {
        const r = await fetch(`${this.baseUrl}/api/ps`);
        if (!r.ok)
            throw new Error(`Ollama /api/ps failed: ${r.status}`);
        return r.json();
    }
    async *chatStream(args) {
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
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // NDJSON: split on newlines
            let idx;
            while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line)
                    continue;
                const raw = JSON.parse(line);
                const delta = raw?.message?.content ?? "";
                yield { delta, raw };
                if (raw?.done)
                    return;
            }
        }
    }
}
exports.OllamaClient = OllamaClient;
//# sourceMappingURL=OllamaClient.js.map