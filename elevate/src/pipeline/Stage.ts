import * as vscode from "vscode";
import { ElevateContext } from "../backend/ElevateContext";
import { OllamaClient } from "../backend/OllamaClient";

export interface Stage {
    name: string;
    run(ctx: ElevateContext): Promise<void>;
}

export class SanitizationStage implements Stage {
    name = "Sanitization Stage";
    async run(ctx: ElevateContext): Promise<void> {

    }
}

export class ParseStage implements Stage {
    name = "Parse Stage";
    async run(ctx: ElevateContext): Promise<void> {
        // run parse stage here
        // ctx.parsed = parse()
    }
}

export class PromptBuilderStage implements Stage {
    name = "Prompt Builder Stage";
    async run(ctx: ElevateContext): Promise<void> {

    }
}

export class OllamaStage implements Stage {
    name = "Ollama Stage";

    constructor(private readonly client: OllamaClient) {}

    async run(ctx: ElevateContext): Promise<void> {
        /*
         * Requires ctx.prompt to be populated by PromptBuilderStage.
         * Reads the target model from VSCode settings (elevate.defaultModel),
         * falling back to llama3.2:3b.
         * Streams the response from Ollama chunk by chunk, accumulating
         * the full text, then stores it in ctx.modelResponse for the caller.
         */
        if (!ctx.prompt || ctx.prompt.length === 0) {
            throw new Error("OllamaStage: no prompt set on context");
        }

        const model = vscode.workspace
            .getConfiguration("elevate")
            .get<string>("defaultModel") ?? "llama3.2:3b";

        const abort = new AbortController();
        let response = "";

        for await (const chunk of this.client.chatStream({
            model,
            messages: ctx.prompt,
            signal: abort.signal,
        })) {
            if (chunk.delta) {
                response += chunk.delta;
            }
        }

        ctx.modelResponse = response;
    }
}