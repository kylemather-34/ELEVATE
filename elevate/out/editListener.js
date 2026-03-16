"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditListener = void 0;
// elevate/src/editListener.ts
const vscode = __importStar(require("vscode"));
const debounce_1 = require("./debounce");
class EditListener {
    logger;
    opts;
    disposables = [];
    debouncer;
    generation = new Map();
    constructor(logger, opts) {
        this.logger = logger;
        this.opts = opts;
        this.debouncer = new debounce_1.KeyedDebouncer({
            delayMs: opts.debounceMs,
            maxWaitMs: opts.maxWaitMs,
        });
    }
    start() {
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((e) => this.onTextDocumentChanged(e)), vscode.workspace.onDidSaveTextDocument((doc) => this.onTextDocumentSaved(doc)));
        if (this.opts.fsWatcherEnabled) {
            const watcher = vscode.workspace.createFileSystemWatcher(this.opts.fsWatcherGlob, true, // ignoreCreateEvents
            false, // ignoreChangeEvents
            true // ignoreDeleteEvents
            );
            watcher.onDidChange((uri) => this.onFileChangedOnDisk(uri), null, this.disposables);
            this.disposables.push(watcher);
            this.logger.info(`[fs-watch] enabled (glob=${this.opts.fsWatcherGlob})`);
        }
        else {
            this.logger.info('[fs-watch] disabled');
        }
    }
    dispose() {
        this.debouncer.dispose();
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
    onTextDocumentChanged(e) {
        // Filter non-content changes (dirty state flips etc.)
        if (e.contentChanges.length === 0)
            return;
        const key = e.document.uri.toString();
        const gen = (this.generation.get(key) ?? 0) + 1;
        this.generation.set(key, gen);
        this.debouncer.schedule(key, () => this.emitDebouncedEdit(key, gen));
    }
    onTextDocumentSaved(doc) {
        const key = doc.uri.toString();
        // Ensure pending work runs on save so output aligns with disk state
        this.debouncer.flush(key);
        this.logger.info(`[save] ${doc.uri.toString()} (version=${doc.version})`);
    }
    onFileChangedOnDisk(uri) {
        const key = uri.toString();
        const gen = (this.generation.get(key) ?? 0) + 1;
        this.generation.set(key, gen);
        this.debouncer.schedule(key, () => {
            if ((this.generation.get(key) ?? 0) !== gen)
                return;
            this.logger.info(`[fs-change] ${uri.toString()}`);
        });
    }
    emitDebouncedEdit(key, gen) {
        if ((this.generation.get(key) ?? 0) !== gen)
            return;
        const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
        if (!doc) {
            this.logger.info(`[edit] ${key} (not currently open)`);
            return;
        }
        this.logger.info(`[edit] ${doc.uri.toString()} (version=${doc.version}, dirty=${doc.isDirty})`);
        this.opts.onEdit?.(doc);
    }
}
exports.EditListener = EditListener;
//# sourceMappingURL=editListener.js.map