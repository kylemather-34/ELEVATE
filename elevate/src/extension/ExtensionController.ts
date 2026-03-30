import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { ElevateCore } from '../backend/ElevateCore';
import { FileSnapshot } from '../backend/FileSnapshot';
import { Logger } from '../Logger';
import { EditListener } from '../editListener';

// The result produced after a full pipeline run — passed to VSCode via the event below.
export interface AnalysisResult {
    uri: string;           // file that was analysed
    modelResponse: string; // text returned by Ollama
    snapshot?: FileSnapshot;
}

// ExtensionController is the communication layer between VSCode events (file open, save)
// and the backend pipeline. It listens for editor events, sends the file content through
// the pipeline, then fires onAnalysisComplete so the rest of the extension can react.
export class ExtensionController implements vscode.Disposable {
    // Internal emitter — only this class fires it.
    private readonly _onAnalysisComplete = new vscode.EventEmitter<AnalysisResult>();

    // Public event — next sprint the response panel and diagnostics provider subscribe here
    // to receive analysis results without needing to know how they were produced.
    public readonly onAnalysisComplete = this._onAnalysisComplete.event;

    constructor(
        private readonly backend: ElevateCore,
        private readonly logger: Logger,
    ) {}

    // Called every time a pipeline run succeeds and produces a model response.
    // Fires onAnalysisComplete so all subscribers are notified.
    // Next sprint: add response panel update and diagnostics/squiggles here.
    private handleAnalysisComplete(result: AnalysisResult): void {
        this._onAnalysisComplete.fire(result);
        // TODO next sprint: update response panel, push diagnostics/squiggles
    }

    public dispose(): void {
        this._onAnalysisComplete.dispose();
    }

    public activateOpenFileListener(context: vscode.ExtensionContext): void {
        const openFileListener = vscode.workspace.onDidOpenTextDocument(
            async (document: vscode.TextDocument) => {
                this.logger.info(`[open-file] fired: scheme=${document.uri.scheme} uri=${document.uri.toString()}`);
                if (document.uri.scheme !== 'file') return;

                this.logger.info(`[analysis] started for: ${document.uri.toString()}`);
                const ctx = new ElevateContext(document);

                try {
                    await this.backend.runPipeline(ctx);
                } catch (err: any) {
                    this.logger.error(`[analysis] pipeline error: ${err?.message ?? String(err)}`);
                    return;
                }

                if (ctx.modelResponse) {
                    this.logger.logResponseFinal(ctx.modelResponse);
                    this.handleAnalysisComplete({
                        uri: ctx.snapshot?.uri ?? document.uri.toString(),
                        modelResponse: ctx.modelResponse,
                        snapshot: ctx.snapshot,
                    });
                } else {
                    this.logger.info('[analysis] pipeline completed with no model response.');
                }
            }
        );

        context.subscriptions.push(openFileListener);
    }

    public activateSaveListener(context: vscode.ExtensionContext): void {
        const listener = new EditListener(this.logger, {
            debounceMs: 0,
            fsWatcherEnabled: false,
            onEdit: async (doc) => {
                this.logger.info(`[analysis] started on save: ${doc.uri.toString()} (version=${doc.version})`);
                const ctx = new ElevateContext(doc);

                try {
                    await this.backend.runPipeline(ctx);
                } catch (err: any) {
                    this.logger.error(`[analysis] pipeline error: ${err?.message ?? String(err)}`);
                    return;
                }

                if (ctx.modelResponse) {
                    this.logger.logResponseFinal(ctx.modelResponse);
                    this.handleAnalysisComplete({
                        uri: ctx.snapshot?.uri ?? doc.uri.toString(),
                        modelResponse: ctx.modelResponse,
                        snapshot: ctx.snapshot,
                    });
                } else {
                    this.logger.info('[analysis] pipeline completed with no model response.');
                }
            },
        });

        listener.start();
        context.subscriptions.push(listener);
    }
}
