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
exports.CursorTracker = void 0;
// elevate/src/cursorTracker.ts
const vscode = __importStar(require("vscode"));
class CursorTracker {
    logger;
    emitLogs;
    disposables = [];
    current;
    constructor(logger, emitLogs = false) {
        this.logger = logger;
        this.emitLogs = emitLogs;
    }
    start() {
        this.updateFromActiveEditor();
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.updateFromActiveEditor()), vscode.window.onDidChangeTextEditorSelection((e) => {
            this.update(e.textEditor, e.selections);
        }));
    }
    getCurrent() {
        return this.current;
    }
    dispose() {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
    updateFromActiveEditor() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.current = undefined;
            return;
        }
        this.update(editor, editor.selections);
    }
    update(editor, selections) {
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
            this.logger.info(`[cursor] ${this.current.uri.toString()} ${this.current.line1}:${this.current.character1} (carets=${this.current.caretCount})`);
        }
    }
}
exports.CursorTracker = CursorTracker;
//# sourceMappingURL=cursorTracker.js.map