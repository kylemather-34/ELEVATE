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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class Logger {
    channel;
    debugEnabled;
    logFilePath;
    constructor(name = "ELEVATE", debug = true, logFilePath) {
        this.channel = vscode.window.createOutputChannel(name);
        this.debugEnabled = debug;
        this.logFilePath = logFilePath;
        this.channel.show(true);
    }
    format(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }
    write(level, message) {
        const formatted = this.format(level, message);
        // Output window
        this.channel.appendLine(formatted);
        // File output (if path provided)
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, formatted + "\n");
        }
    }
    info(message) {
        this.channel.appendLine(this.format('INFO', message));
    }
    warn(message) {
        this.channel.appendLine(this.format('WARN', message));
    }
    error(message) {
        this.channel.appendLine(this.format('ERROR', message));
    }
    show() {
        this.channel.show(true);
    }
    dispose() {
        this.channel.dispose();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map