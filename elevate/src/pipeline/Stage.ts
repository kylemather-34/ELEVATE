import * as vscode from "vscode";
import { ElevateContext } from "../backend/ElevateContext";
import { BlockEvent } from "../backend/parserTypes";
import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import * as os from "os";
import * as path from "path";
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

    constructor(private readonly binPath: string) {}

    async run(ctx: ElevateContext): Promise<void> {
        const code = ctx.analysisTarget ?? ctx.snapshot?.text ?? ctx.text;
        if (!code) {
            throw new Error("ParseStage: no code to parse");
        }

        const inputPath = path.join(os.tmpdir(), `elevate_in_${Date.now()}.py`);
        const outputPath = path.join(os.tmpdir(), `elevate_out_${Date.now()}.json`);

        await writeFile(inputPath, code, "utf-8");

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(this.binPath, [inputPath, outputPath]);
            let stderr = "";
            proc.stderr.on("data", (d) => (stderr += d.toString()));
            proc.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`Parser exited with code ${code}: ${stderr}`));
                } else {
                    resolve();
                }
            });
            proc.on("error", reject);
        });

        const raw = await readFile(outputPath, "utf-8");
        ctx.parsed = JSON.parse(raw) as BlockEvent[];

        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
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