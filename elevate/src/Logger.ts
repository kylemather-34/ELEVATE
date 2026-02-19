import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger implements vscode.Disposable {
    private channel: vscode.OutputChannel;
    private debugEnabled: boolean;

    constructor(name: string = "ELEVATE", debug: boolean = true) {
        this.channel = vscode.window.createOutputChannel(name);
        this.debugEnabled = debug;
        this.channel.show(true);
    }

    private format(level: LogLevel, message: string) {
        const timestamp = new Date().toLocaleString();
        return `[${timestamp}] [${level}] ${message}`;
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