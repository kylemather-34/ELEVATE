import * as vscode from "vscode";
import { ElevateContext } from "../backend/ElevateContext";
import { BlockEvent } from "../backend/parserTypes";
import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import * as os from "os";
import * as path from "path";
import { OllamaClient } from "../backend/OllamaClient";
import { ModelAnalysisResult } from "../backend/types";
import { Logger } from "../util/Logger";

export interface Stage {
    name: string;
    run(ctx: ElevateContext, logger: Logger): Promise<void>;
}

export class SanitizationStage implements Stage {
    name = "Sanitization Stage";
    async run(_ctx: ElevateContext, _logger: Logger): Promise<void> {

    }
}

export class ParseStage implements Stage {
    name = "Parse Stage";

    constructor(private readonly binPath: string) {}

    async run(ctx: ElevateContext, logger: Logger): Promise<void> {
        const code = ctx.analysisTarget ?? ctx.snapshot?.text ?? ctx.text;
        if (!code) {
            throw new Error("ParseStage: no code to parse");
        }

        logger.debug(`ParseStage: parsing ${code.length} chars`);

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

        logger.debug(`ParseStage: produced ${ctx.parsed.length} block event(s)`);

        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
    }
}

function filterToActiveBlock(events: BlockEvent[], cursorLine?: number): BlockEvent[] {
    if (cursorLine === undefined) return events;

    let blockStart = -1;
    let blockEnd = events.length;

    for (let i = 0; i < events.length; i++) {
        if (events[i].event === "start" && events[i].line <= cursorLine) {
            blockStart = i;
        }
        if (events[i].event === "end" && events[i].line >= cursorLine && blockStart !== -1) {
            blockEnd = i + 1;
            break;
        }
    }

    return blockStart === -1 ? events : events.slice(blockStart, blockEnd);
}

export class PromptBuilderStage implements Stage {
    name = "Prompt Builder Stage";

    constructor(private readonly binPath: string) {}

    async run(ctx: ElevateContext, logger: Logger): Promise<void> {
        if (!ctx.parsed) {
            throw new Error("PromptBuilderStage: ctx.parsed is not set — ParseStage must run first");
        }

        const events = filterToActiveBlock(ctx.parsed, ctx.cursorLine);
        logger.debug(`PromptBuilderStage: building prompt from ${events.length}/${ctx.parsed.length} block event(s) (cursorLine=${ctx.cursorLine})`);

        const inputPath = path.join(os.tmpdir(), `elevate_prompt_in_${Date.now()}.json`);
        const outputPath = path.join(os.tmpdir(), `elevate_prompt_out_${Date.now()}.txt`);

        await writeFile(inputPath, JSON.stringify(events), "utf-8");

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(this.binPath, [inputPath, outputPath]);
            let stderr = "";
            proc.stderr.on("data", (d) => (stderr += d.toString()));
            proc.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`PromptBuilder exited with code ${code}: ${stderr}`));
                } else {
                    resolve();
                }
            });
            proc.on("error", reject);
        });

        const promptText = await readFile(outputPath, "utf-8");

        ctx.prompt = [{ role: "user", content: promptText }];

        logger.logPrompt(promptText);

        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
    }
}

function parseModelResponse(raw: string): ModelAnalysisResult | undefined{
    // Extract the first complete JSON object from the response.
    // Models sometimes prepend prose before the JSON, so we find the
    // first '{' and last '}' rather than parsing the whole string.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return undefined;

    try{
        const parsed = JSON.parse(raw.slice(start, end + 1));

        // Validate that all required fields are present and have the correct types
        if (typeof parsed.structural_summary !== "string")  return undefined;
        if (!Array.isArray(parsed.issues))                  return undefined;
        if (typeof parsed.complexity !== "string")          return undefined;
        if (!Array.isArray(parsed.improvements))            return undefined;

        for (const issue of parsed.issues) {
            if (typeof issue.line !== "number")             return undefined;
            if (typeof issue.description !== "string")     return undefined;
            if (issue.severity !== "error" &&
                issue.severity !== "warning" &&
                issue.severity !== "info")                  return undefined;
        }

        return parsed as ModelAnalysisResult;
    }catch{
        //Model doesn't return valid JSON - fail gracefully to prevent crashes
        return undefined;
    }
}

export class OllamaStage implements Stage {
    name = "Ollama Stage";

    constructor(private readonly client: OllamaClient) {}

    async run(ctx: ElevateContext, logger: Logger): Promise<void> {
        /*
         * Requires ctx.prompt to be populated by PromptBuilderStage.
         * Reads the target model from VSCode settings (elevate.defaultModel),
         * falling back to llama3.2:3b.
         * Streams the response from Ollama chunk by chunk, accumulating
         * the full text, then stores it in ctx.modelResponse for the caller.
         * If the response fails JSON validation, retries once with a correction message.
         */
        if (!ctx.prompt || ctx.prompt.length === 0) {
            throw new Error("OllamaStage: no prompt set on context");
        }

        const model = vscode.workspace
            .getConfiguration("elevate")
            .get<string>("defaultModel") ?? "llama3.2:3b";

        logger.info(`OllamaStage: sending prompt to model "${model}"`);

        const response = await this.streamResponse(ctx.prompt, model);
        ctx.modelResponse = response;
        ctx.analysisResult = parseModelResponse(response);

        if (ctx.analysisResult) {
            logger.info(`OllamaStage: parsed ${ctx.analysisResult.issues.length} issue(s) from model response`);
            return;
        }

        // Retry: send the bad response back and ask the model to correct it
        logger.info("OllamaStage: response was not valid JSON — retrying with correction message");

        const correctionMessages: import("../backend/types").ChatMessage[] = [
            ...ctx.prompt,
            { role: "assistant", content: response },
            { role: "user", content:
                "Your previous response was not valid JSON. " +
                "Respond with ONLY the raw JSON object — no explanation, no prose, no markdown. " +
                "Start your response with '{' and end with '}'."
            },
        ];

        const retryResponse = await this.streamResponse(correctionMessages, model);
        ctx.modelResponse = retryResponse;
        ctx.analysisResult = parseModelResponse(retryResponse);

        if (ctx.analysisResult) {
            logger.info(`OllamaStage: retry succeeded, parsed ${ctx.analysisResult.issues.length} issue(s)`);
        } else {
            logger.info("OllamaStage: retry failed — analysisResult not set");
        }
    }

    private async streamResponse(messages: import("../backend/types").ChatMessage[], model: string): Promise<string> {
        const abort = new AbortController();
        let response = "";
        for await (const chunk of this.client.chatStream({
            model,
            messages,
            signal: abort.signal,
        })) {
            if (chunk.delta) response += chunk.delta;
        }
        return response;
    }
}
