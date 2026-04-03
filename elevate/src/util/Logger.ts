import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export enum Component {
    Pipeline  = "pipeline",
    Ollama    = "ollama",
    Extension = "extension",
}

export class Logger implements vscode.Disposable {
    private channel: vscode.OutputChannel;
    private debugEnabled: boolean;
    private component?: Component;
    private logDir?: string;

    constructor(
        nameOrChannel: string | vscode.OutputChannel = "ELEVATE",
        debug: boolean = true,
        component?: Component,
        logDir?: string
    ) {
        this.channel = typeof nameOrChannel === 'string'
            ? vscode.window.createOutputChannel(nameOrChannel)
            : nameOrChannel;
        this.debugEnabled = debug;
        this.component = component;
        this.logDir = logDir;
        this.channel.show(true);
    }

    /**
     * Call this once in extension.ts after activation to set the log directory.
     * Uses context.logUri — VS Code's built-in per-extension log folder.
     * e.g. ~/Library/Application Support/Code/logs/.../elevate/
     */
    setLogDir(context: vscode.ExtensionContext): void {
        this.logDir = context.logUri.fsPath;
        try {
            fs.mkdirSync(this.logDir, { recursive: true });
        } catch (err) {
            this.channel.appendLine(`[ELEVATE] Failed to create log directory: ${err}`);
        }
    }

    /** Returns a new Logger scoped to a specific component, sharing the same output channel and log dir */
    forComponent(component: Component): Logger {
        return new Logger(this.channel, this.debugEnabled, component, this.logDir);
    }

    private getLogFilePath(): string | undefined {
        if (!this.logDir || !this.component) return undefined;

        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filename = `${this.component}-${date}.log`;
        return path.join(this.logDir, filename);
    }

    private format(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        const componentTag = this.component ? ` [${this.component.toUpperCase()}]` : "";
        return `[${timestamp}] [${level}]${componentTag} ${message}`;
    }

    private write(level: LogLevel, message: string): void {
        const formatted = this.format(level, message);

        // Always write to VS Code output channel
        this.channel.appendLine(formatted);

        // Write to date-stamped component log file if logDir is set
        const logFilePath = this.getLogFilePath();
        if (logFilePath) {
            try {
                fs.appendFileSync(logFilePath, formatted + "\n");
            } catch (err) {
                this.channel.appendLine(`[ELEVATE] Failed to write to log file "${logFilePath}": ${err}`);
            }
        }
    }

    info(message: string): void {
        this.write('INFO', message);
    }

    warn(message: string): void {
        this.write('WARN', message);
    }

    error(message: string): void {
        this.write('ERROR', message);
    }

    debug(message: string): void {
        if (this.debugEnabled) {
            this.write('DEBUG', message);
        }
    }

    // Safe truncation for large backend payloads
    private truncate(text: string, maxLength: number = 1000): string {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) +
            "\n...[truncated " + (text.length - maxLength) + " chars]";
    }

    // Log outgoing prompt to LLM
    logPrompt(prompt: string): void {
        this.debug("Prompt to Ollama:\n" + this.truncate(prompt));
    }

    // Log streaming response chunks
    logResponseChunk(chunk: string): void {
        this.debug("Response chunk from Ollama:\n" + this.truncate(chunk));
    }

    // Log the entire response from LLM
    logResponseFinal(response: string): void {
        this.info("Final response from Ollama:\n" + this.truncate(response));
    }

    show(): void {
        this.channel.show(true);
    }

    dispose(): void {
        this.channel.dispose();
    }
}