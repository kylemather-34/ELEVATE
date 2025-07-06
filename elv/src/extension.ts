import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
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

    // Rewrite asset links for use inside the Webview
    // Fix script and link tags (absolute /assets/* → webview-safe URIs)
    html = html.replace(/(["'])\/assets\/(.*?)\1/g, (_, quote, assetPath) => {
      const resourceUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'ui', 'dist', 'assets', assetPath))
      );
      return `${quote}${resourceUri.toString()}${quote}`;
    });

    console.log(html);
    panel.webview.html = html;
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Optional: cleanup
}
