import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { ElevateCore } from '../backend/ElevateCore';

export class ExtensionController {

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
}