import * as vscode from 'vscode';

interface AnalysisIssue {
    line: number;
    severity: 'error' | 'warning' | 'info';
    description: string;
}

interface AnalysisImprovement {
    description: string;
    reasoning: string;
}

interface AnalysisResponse {
    structural_summary: string;
    issues: AnalysisIssue[];
    complexity: string;
    improvements: AnalysisImprovement[];
}

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

    private parseResponse(raw: string): AnalysisResponse | null {
        try {
            const parsed = JSON.parse(raw);
            if (
                typeof parsed.structural_summary === 'string' &&
                Array.isArray(parsed.issues) &&
                typeof parsed.complexity === 'string' &&
                Array.isArray(parsed.improvements)
            ) {
                return parsed as AnalysisResponse;
            }
            return null;
        } catch {
            return null;
        }
    }

    private escape(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private buildHtml(content: string): string {
        const data = this.parseResponse(content);
        const body = data ? this.buildStructuredBody(data) : this.buildFallbackBody(content);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
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
            margin: 0;
        }
        h2 {
            font-size: 0.85em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--vscode-descriptionForeground);
            margin: 20px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        h2:first-child { margin-top: 0; }
        p { margin: 0 0 8px 0; }
        .issue {
            display: flex;
            align-items: baseline;
            gap: 8px;
            padding: 4px 0;
        }
        .badge {
            font-size: 0.75em;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 3px;
            text-transform: uppercase;
            flex-shrink: 0;
        }
        .badge-error   { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); color: var(--vscode-inputValidation-errorForeground, #f48771); }
        .badge-warning { background: var(--vscode-inputValidation-warningBackground, #352a05); color: var(--vscode-inputValidation-warningForeground, #cca700); }
        .badge-info    { background: var(--vscode-inputValidation-infoBackground, #063b49); color: var(--vscode-inputValidation-infoForeground, #75beff); }
        .line-num { color: var(--vscode-descriptionForeground); font-size: 0.85em; flex-shrink: 0; }
        .improvement { margin-bottom: 10px; }
        .improvement .reasoning { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-top: 2px; }
        .raw { white-space: pre-wrap; word-wrap: break-word; }
        .parse-warning {
            font-size: 0.8em;
            color: var(--vscode-inputValidation-warningForeground, #cca700);
            margin-bottom: 12px;
        }
    </style>
</head>
<body>${body}</body>
</html>`;
    }

    private buildStructuredBody(data: AnalysisResponse): string {
        const issues = data.issues.map(issue => {
            const badge = `<span class="badge badge-${this.escape(issue.severity)}">${this.escape(issue.severity)}</span>`;
            const line = `<span class="line-num">line ${issue.line}</span>`;
            return `<div class="issue">${badge}${line}<span>${this.escape(issue.description)}</span></div>`;
        }).join('') || '<p>No issues found.</p>';

        const improvements = data.improvements.map(imp => `
            <div class="improvement">
                <div>${this.escape(imp.description)}</div>
                <div class="reasoning">${this.escape(imp.reasoning)}</div>
            </div>`
        ).join('') || '<p>No improvements suggested.</p>';

        return `
            <h2>Summary</h2>
            <p>${this.escape(data.structural_summary)}</p>
            <h2>Issues</h2>
            ${issues}
            <h2>Complexity</h2>
            <p>${this.escape(data.complexity)}</p>
            <h2>Improvements</h2>
            ${improvements}`;
    }

    private buildFallbackBody(content: string): string {
        return `
            <p class="parse-warning">Could not parse structured response — showing raw output.</p>
            <div class="raw">${this.escape(content)}</div>`;
    }

    public dispose(): void {
        this.panel?.dispose();
    }
}
