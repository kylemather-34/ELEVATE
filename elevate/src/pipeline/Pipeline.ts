import { ElevateContext } from "../core/ElevateContext";
import { Stage } from "./Stage";
import { Logger } from "../Logger";

export class Pipeline {
    private stages: Stage[];
    private logger: Logger;

    constructor(stages: Stage[], logger: Logger) {
        this.stages = stages;
        this.logger = logger;
    }

    async execute(ctx: ElevateContext) {
        this.logger.info("Starting pipeline execution");

        for (const stage of this.stages) {
            
            try {
                this.logger.info(`Running stage: ${stage.name}`);
                await stage.run(ctx);
                this.logger.info(`Completed stage: ${stage.name}`);
            } catch (error) {

                this.logger.error(`Error in stage ${stage.name}: ${error}`);
                throw error; // rethrow to stop pipeline execution
            }
        }
        this.logger.info("Pipeline execution completed");
    }
}