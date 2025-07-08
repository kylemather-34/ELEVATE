import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const diagnosticCollection = vscode.languages.createDiagnosticCollection('elevate');

async function sendToBackend(code: string): Promise<string> {
  const res = await fetch('http://localhost:5000/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json() as { message?: string };
  return data.message || '[No message]';
}


export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('elevate');

  const disposable = vscode.commands.registerCommand('elv.helloWorld', () => {
    const panel = vscode.window.createWebviewPanel(
      'elevatePanel',
      'ELEVATE',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'ui', 'dist')),
          vscode.Uri.file(path.join(context.extensionPath, 'ui', 'dist', 'assets')),
        ],
      }
    );

    const indexPath = path.join(context.extensionPath, 'ui', 'dist', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    // Rewrite ./assets/... and /assets/...
    html = html.replace(/(["'])(\.\/|\/)?assets\/(.*?)\1/g, (_, quote, slash, assetPath) => {
      const resourceUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'ui', 'dist', 'assets', assetPath))
      );
      return `${quote}${resourceUri.toString()}${quote}`;
    });

    html = html.replace(/(["'])(\.\/|\/)?vite\.svg\1/g, (_, quote, _prefix) => {
      const resourceUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'ui', 'dist', 'assets', 'vite.svg'))
      );
      return `${quote}${resourceUri.toString()}${quote}`;
    });

    panel.webview.html = html;

    context.subscriptions.push(diagnosticCollection);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('Received from Webview: ', message);

        switch (message.command) {
          case 'analyzeCode':
            try {
              const result = await sendToBackend(message.code || '');
              const editor = vscode.window.activeTextEditor;

              panel.webview.postMessage({ command: 'analysisResult', result });

              if (!editor) {
                return;
              }

              const doc = editor.document;
              const issues = JSON.parse(result);
              const diagnostics: vscode.Diagnostic[] = [];

              if (Array.isArray(issues)) {
                for (const issue of issues) {
                  const line = Math.max(0, issue.line - 1);
                  const range = doc.lineAt(line).range;

                  const severityMap = {
                    info: vscode.DiagnosticSeverity.Information,
                    warning: vscode.DiagnosticSeverity.Warning,
                    error: vscode.DiagnosticSeverity.Error,
                  };

                  const diagnostic = new vscode.Diagnostic(
                    range,
                    issue.message,
                    severityMap[issue.severity as keyof typeof severityMap] ?? vscode.DiagnosticSeverity.Information
                  );

                  diagnostics.push(diagnostic);
                }

                diagnosticCollection.set(doc.uri, diagnostics);
                console.log(`[ELEVATE] Applied ${diagnostics.length} diagnostics to ${doc.uri.fsPath}`);
              }
            } catch (err) {
              panel.webview.postMessage({
                command: 'analysisError',
                result: 'Error: ' + (err as Error).message,
              });
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  // 👇 Automatically run the panel if environment variable is set
  if (process.env.ELEVATE_AUTO === '1') {
    vscode.commands.executeCommand('elv.helloWorld');
  }

  context.subscriptions.push(disposable);
}



export function deactivate() {
  // Optional: cleanup
}
