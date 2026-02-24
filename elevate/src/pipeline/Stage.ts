import { ElevateContext } from "../core/ElevateContext";

export interface Stage {
    name: string;
    run(ctx: ElevateContext): Promise<void>;
}

export class ContextBuilderStage implements Stage {
    name = "Context Builder Stage";
    async run(ctx: ElevateContext): Promise<void> {

    }
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
    async run(ctx: ElevateContext): Promise<void> {

    }
}