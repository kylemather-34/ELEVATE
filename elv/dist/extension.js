"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var diagnosticCollection = vscode.languages.createDiagnosticCollection("elevate");
async function sendToBackend(code) {
  const res = await fetch("http://localhost:5000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  return data.message || "[No message]";
}
function activate(context) {
  const diagnosticCollection2 = vscode.languages.createDiagnosticCollection("elevate");
  const disposable = vscode.commands.registerCommand("elv.helloWorld", () => {
    const panel = vscode.window.createWebviewPanel(
      "elevatePanel",
      "ELEVATE",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "ui", "dist")),
          vscode.Uri.file(path.join(context.extensionPath, "ui", "dist", "assets"))
        ]
      }
    );
    const indexPath = path.join(context.extensionPath, "ui", "dist", "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    html = html.replace(/(["'])(\.\/|\/)?assets\/(.*?)\1/g, (_, quote, slash, assetPath) => {
      const resourceUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "ui", "dist", "assets", assetPath))
      );
      return `${quote}${resourceUri.toString()}${quote}`;
    });
    html = html.replace(/(["'])(\.\/|\/)?vite\.svg\1/g, (_, quote, _prefix) => {
      const resourceUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "ui", "dist", "assets", "vite.svg"))
      );
      return `${quote}${resourceUri.toString()}${quote}`;
    });
    panel.webview.html = html;
    context.subscriptions.push(diagnosticCollection2);
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log("Received from Webview: ", message);
        switch (message.command) {
          case "analyzeCode":
            try {
              const result = await sendToBackend(message.code || "");
              const editor = vscode.window.activeTextEditor;
              panel.webview.postMessage({ command: "analysisResult", result });
              if (!editor) {
                return;
              }
              const doc = editor.document;
              const issues = JSON.parse(result);
              const diagnostics = [];
              if (Array.isArray(issues)) {
                for (const issue of issues) {
                  const line = Math.max(0, issue.line - 1);
                  const range = doc.lineAt(line).range;
                  const severityMap = {
                    info: vscode.DiagnosticSeverity.Information,
                    warning: vscode.DiagnosticSeverity.Warning,
                    error: vscode.DiagnosticSeverity.Error
                  };
                  const diagnostic = new vscode.Diagnostic(
                    range,
                    issue.message,
                    severityMap[issue.severity] ?? vscode.DiagnosticSeverity.Information
                  );
                  diagnostics.push(diagnostic);
                }
                diagnosticCollection2.set(doc.uri, diagnostics);
                console.log(`[ELEVATE] Applied ${diagnostics.length} diagnostics to ${doc.uri.fsPath}`);
              }
            } catch (err) {
              panel.webview.postMessage({
                command: "analysisError",
                result: "Error: " + err.message
              });
            }
            break;
        }
      },
      void 0,
      context.subscriptions
    );
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
