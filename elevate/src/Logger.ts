import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';  

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger implements vscode.Disposable {
    private channel: vscode.OutputChannel;
    private debugEnabled: boolean;
    private logFilePath?: string;

    constructor(name: string = "ELEVATE", debug: boolean = true, logFilePath?: string) {
        this.channel = vscode.window.createOutputChannel(name);
        this.debugEnabled = debug;
        this.logFilePath = logFilePath;
        this.channel.show(true);
    }

    private format(level: LogLevel, message: string) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    private write(level: LogLevel, message: string) {
        const formatted = this.format(level, message);

        // Output window
        this.channel.appendLine(formatted);

        // File output (if path provided)
        if (this.logFilePath) {
            fs.appendFileSync(this.logFilePath, formatted + "\n");
        }
    }

    info(message: string) {
        this.channel.appendLine(this.format('INFO', message));
    }

    warn(message: string) {
        this.channel.appendLine(this.format('WARN', message));
    }

    error(message: string) {
        this.channel.appendLine(this.format('ERROR', message));
    }

    show() {
        this.channel.show(true);
    }

    dispose() {
        this.channel.dispose();
    }
}