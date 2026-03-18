import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { ElevateCore } from '../backend/ElevateCore';
import { Logger } from '../Logger';
import { EditListener } from '../editListener';

export class ExtensionController {
    private logger = new Logger();
    private statusBar!: vscode.StatusBarItem;

    constructor(private readonly backend: ElevateCore) {}

    public activateStatusBar(context: vscode.ExtensionContext): void {
        this.statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBar.text = '$(circle-outline) Elevate: Idle';
        this.statusBar.tooltip = 'Elevate pipeline status';
        this.statusBar.show();
        context.subscriptions.push(this.statusBar);
    }

    public activateOpenFileListener(context: vscode.ExtensionContext): void {
        const openFileListener = vscode.workspace.onDidOpenTextDocument(
            async (document: vscode.TextDocument) => {
                if (document.uri.scheme !== 'file') return;

                this.statusBar.text = '$(sync~spin) Elevate: Analyzing...';
                try {
                    const ctx = new ElevateContext(document);
                    await this.backend.runPipeline(ctx);
                    this.statusBar.text = '$(check) Elevate: Done';
                } catch (err) {
                    this.statusBar.text = '$(error) Elevate: Failed';
                    this.logger.error('[status] pipeline failed: ' + err);
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
                this.statusBar.text = '$(sync~spin) Elevate: Analyzing...';
                try {
                    const ctx = new ElevateContext(doc);
                    await this.backend.runPipeline(ctx);
                    this.statusBar.text = '$(check) Elevate: Done';
                    this.logger.info('[analysis] ran on save: ' + doc.uri.toString() + ' (version=' + doc.version + ')');
                } catch (err) {
                    this.statusBar.text = '$(error) Elevate: Failed';
                    this.logger.error('[status] pipeline failed: ' + err);
                }
            },
        });
        listener.start();
        context.subscriptions.push(listener);
    }
}