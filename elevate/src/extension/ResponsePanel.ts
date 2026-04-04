import * as vscode from 'vscode';

// ResponsePanel renders model analysis output in a VS Code Webview panel beside
// the active editor. Call update() to create or refresh it without stealing focus.
export class ResponsePanel implements vscode.Disposable {
    private static readonly viewType = 'elevate.responsePanel';
    private panel: vscode.WebviewPanel | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public update(modelResponse: string): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                ResponsePanel.viewType,
                'ELEVATE: Analysis',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                { enableScripts: false, retainContextWhenHidden: true },
            );
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside, /* preserveFocus */ true);
        }
        this.panel.webview.html = this.buildHtml(modelResponse);
    }

    public show(): void {
        this.panel?.reveal(vscode.ViewColumn.Beside, true);
    }

    private buildHtml(content: string): string {
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ELEVATE Analysis</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
            padding: 16px 20px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 0;
        }
        h1 {
            font-size: 1em;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            margin: 0 0 12px 0;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <h1>ELEVATE Analysis</h1>
    <div>${escaped}</div>
</body>
</html>`;
    }

    public dispose(): void {
        this.panel?.dispose();
    }
}
