// elevate/src/cursorTracker.ts
import * as vscode from 'vscode';
import { Logger } from './logger';

export interface CursorLocation {
  uri: vscode.Uri;

  // VS Code internal (0-based)
  line0: number;
  character0: number;

  // Human-friendly (1-based)
  line1: number;
  character1: number;

  caretCount: number;
}

export class CursorTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private current?: CursorLocation;

  constructor(private logger: Logger, private emitLogs: boolean = false) {}

  start(): void {
    this.updateFromActiveEditor();

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateFromActiveEditor()),
      vscode.window.onDidChangeTextEditorSelection((e) => {
        this.update(e.textEditor, e.selections);
      })
    );
  }

  getCurrent(): CursorLocation | undefined {
    return this.current;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private updateFromActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.current = undefined;
      return;
    }
    this.update(editor, editor.selections);
  }

  private update(editor: vscode.TextEditor, selections: readonly vscode.Selection[]): void {
    const primary = selections[0]?.active ?? editor.selection.active;

    this.current = {
      uri: editor.document.uri,
      line0: primary.line,
      character0: primary.character,
      line1: primary.line + 1,
      character1: primary.character + 1,
      caretCount: selections.length,
    };

    if (this.emitLogs) {
      this.logger.info(
        `[cursor] ${this.current.uri.toString()} ${this.current.line1}:${this.current.character1} (carets=${this.current.caretCount})`
      );
    }
  }
}