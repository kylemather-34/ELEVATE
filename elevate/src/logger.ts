import { throws } from 'assert';
import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
    private channel: vscode.OutputChannel;
    private debugEnabled: boolean;

    constructor(name: string = 'ELEVATE', debug: boolean = false) {
        this.channel = vscode.window.createOutputChannel(name);
        this.debugEnabled = debug;
    }

    private format(level: LogLevel, message: string) {
        const timestamp = new Date().toDateString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    info(message: string) {
        this.channel.appendLine(this.format('INFO', message));
    }

    show() {
        this.channel.show(true);
    }
}