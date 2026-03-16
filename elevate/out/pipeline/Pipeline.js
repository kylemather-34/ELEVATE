"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pipeline = void 0;
class Pipeline {
    stages;
    logger;
    constructor(stages, logger) {
        this.stages = stages;
        this.logger = logger;
    }
    async execute(ctx) {
        this.logger.info("Starting pipeline execution");
        for (const stage of this.stages) {
            try {
                this.logger.info(`Running stage: ${stage.name}`);
                await stage.run(ctx);
                this.logger.info(`Completed stage: ${stage.name}`);
            }
            catch (error) {
                this.logger.error(`Error in stage ${stage.name}: ${error}`);
                throw error; // rethrow to stop pipeline execution
            }
        }
        this.logger.info("Pipeline execution completed");
    }
}
exports.Pipeline = Pipeline;
//# sourceMappingURL=Pipeline.js.map