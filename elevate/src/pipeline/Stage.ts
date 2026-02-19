import { ElevateContext } from "../core/ElevateContext";

export interface Stage {
    run(ctx: ElevateContext): Promise<void>;
}

class ParseStage implements Stage {
    async run(ctx: ElevateContext): Promise<void> {
        // run parse stage here
        // ctx.parsed = parse()
    }
}

