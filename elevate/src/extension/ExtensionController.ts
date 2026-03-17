import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { ElevateCore } from '../backend/ElevateCore';
import { Logger } from '../Logger';
import { EditListener } from '../editListener';

export class ExtensionController {
    private logger = new Logger();

    constructor(private readonly backend: ElevateCore) {}

    public activateOpenFileListener(context: vscode.ExtensionContext): void {
        const openFileListener = vscode.workspace.onDidOpenTextDocument(
            async (document: vscode.TextDocument) => {
                if (document.uri.scheme !== 'file') return;

                const ctx = new ElevateContext(document);
                await this.backend.runPipeline(ctx);
            }
        );

        context.subscriptions.push(openFileListener);
    }

    public activateSaveListener(context: vscode.ExtensionContext): void {
        const listener = new EditListener(this.logger, {
            debounceMs: 0,  // no debouncing, immediate
            fsWatcherEnabled: false, //optional, skip file system watcher
            onEdit: (doc) => {
                const ctx = new ElevateContext(doc);
                this.backend.runPipeline(ctx);
                this.logger.info('[analysis] ran on save: ' + doc.uri.toString() + ' (version=' + doc.version + ')');
            },
        });

        listener.start();
        context.subscriptions.push(listener);
    }
}
