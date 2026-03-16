import * as vscode from 'vscode';

// Snapshot of the text document and version of each context
export interface FileSnapshot {
    uri: string;
    language: string;
    version: number;
    text: string;
}

export function snapshot(doc: vscode.TextDocument): FileSnapshot {
    return {
        uri: doc.uri.toString(),
        language: doc.languageId,
        version: doc.version,
        text: doc.getText()
    };
}