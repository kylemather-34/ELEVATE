import { ElevateContext } from "../core/ElevateContext";
import { Stage } from "./Stage";

export class Pipeline {
    private stages: Stage[];

    constructor(stages: Stage[]) {

    }

    async execute(ctx: ElevateContext) {
        for (const stage of this.stages) {
            await stage.run(ctx);
        }
    }
}