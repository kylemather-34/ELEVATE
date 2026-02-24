import * as vscode from 'vscode';
import { Logger } from '../Logger';
import { ExtensionController } from '../extension/ExtensionController';
import { Pipeline } from '../pipeline/Pipeline';
import { ElevateContext } from './ElevateContext';
import * as stage from '../pipeline/Stage';

const stages = [
    new stage.ContextBuilderStage(),
    new stage.SanitizationStage(),
    new stage.ParseStage(),
    new stage.PromptBuilderStage(),
    new stage.OllamaStage()
];

export class ElevateCore {
    // Members
    DebugLogger: Logger;
    ExtensionController: ExtensionController;
    Pipeline: Pipeline;
    // Job Queue

    constructor() {
        this.DebugLogger = new Logger();
        this.ExtensionController = new ExtensionController();
        this.Pipeline = new Pipeline(stages, this.DebugLogger);
    }

    executePipeline(ctx: ElevateContext) {
        this.Pipeline.execute(ctx);
    }

}

