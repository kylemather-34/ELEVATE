// elevate/src/editListener.ts
import * as vscode from 'vscode';
import { Logger } from './Logger';
import { KeyedDebouncer } from './debounce';

export interface EditListenerOptions {
  debounceMs: number;
  maxWaitMs?: number;
  fsWatcherEnabled: boolean;
  fsWatcherGlob?: string;
  onEdit?: (doc: vscode.TextDocument) => void;
}

export class EditListener implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debouncer: KeyedDebouncer<string>;
  private generation = new Map<string, number>();

  constructor(private logger: Logger, private opts: EditListenerOptions) {
    this.debouncer = new KeyedDebouncer<string>({
      delayMs: opts.debounceMs,
      maxWaitMs: opts.maxWaitMs,
    });
  }

  start(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onTextDocumentChanged(e)),
      vscode.workspace.onDidSaveTextDocument((doc) => this.onTextDocumentSaved(doc))
    );

    if (this.opts.fsWatcherEnabled && this.opts.fsWatcherGlob) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        this.opts.fsWatcherGlob,
        true,  // ignoreCreateEvents
        false, // ignoreChangeEvents
        true   // ignoreDeleteEvents
      );

      watcher.onDidChange((uri) => this.onFileChangedOnDisk(uri), null, this.disposables);
      this.disposables.push(watcher);

      this.logger.info(`[fs-watch] enabled (glob=${this.opts.fsWatcherGlob})`);
    } else {
      this.logger.info('[fs-watch] disabled');
    }
  }

  dispose(): void {
    this.debouncer.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private onTextDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
    // Filter non-content changes (dirty state flips etc.)
    if (e.contentChanges.length === 0) return;
    if (e.document.uri.scheme !== 'file') return;

    const key = e.document.uri.toString();
    const gen = (this.generation.get(key) ?? 0) + 1;
    this.generation.set(key, gen);

    this.debouncer.schedule(key, () => this.emitDebouncedEdit(key, gen));
  }

  private onTextDocumentSaved(doc: vscode.TextDocument): void {
    if (doc.uri.scheme !== 'file') return;
    const key = doc.uri.toString();

    // Cancel any pending debounced edit — the save fires onEdit directly below
    this.debouncer.cancel(key);

    this.opts.onEdit?.(doc);

    this.logger.info(`[save] ${doc.uri.toString()} (version=${doc.version})`);
  }

  private onFileChangedOnDisk(uri: vscode.Uri): void {
    const key = uri.toString();
    const gen = (this.generation.get(key) ?? 0) + 1;
    this.generation.set(key, gen);

    this.debouncer.schedule(key, () => {
      if ((this.generation.get(key) ?? 0) !== gen) return;
      this.logger.info(`[fs-change] ${uri.toString()}`);
    });
  }

  private emitDebouncedEdit(key: string, gen: number): void {
    if ((this.generation.get(key) ?? 0) !== gen) return;

    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    if (!doc) {
      this.logger.info(`[edit] ${key} (not currently open)`);
      return;
    }

    this.logger.info(`[edit] ${doc.uri.toString()} (version=${doc.version}, dirty=${doc.isDirty})`);

    this.opts.onEdit?.(doc);
  }
}