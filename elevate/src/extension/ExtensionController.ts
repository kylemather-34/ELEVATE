import * as vscode from 'vscode';
import { ElevateContext } from '../core/ElevateContext';
import { Pipeline } from '../pipeline/Pipeline';
import { Logger } from '../Logger';
import * as stage from '../pipeline/Stage';

export class ExtensionController {

    constructor(){}

public activateOpenFileListener(context: vscode.ExtensionContext): void {
        const openFileListener = vscode.workspace.onDidOpenTextDocument(
            async (document: vscode.TextDocument) => {
                if (document.uri.scheme !== 'file') return;

                const logger = new Logger();
                const pipeline = new Pipeline(
                    [
                        new stage.SanitizationStage(),
                        new stage.ParseStage(),
                        new stage.PromptBuilderStage(),
                        new stage.OllamaStage()
                    ],
                    logger
                );

                const ctx = new ElevateContext(document);
                await pipeline.execute(ctx);
            }
        );

        context.subscriptions.push(openFileListener);
    }
}