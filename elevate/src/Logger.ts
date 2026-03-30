import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';  

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger implements vscode.Disposable {
    private channel: vscode.OutputChannel;
    private debugEnabled: boolean;
    private logFilePath?: string;

    constructor(nameOrChannel: string | vscode.OutputChannel = "ELEVATE", debug: boolean = true, logFilePath?: string) {
        this.channel = typeof nameOrChannel === 'string'
            ? vscode.window.createOutputChannel(nameOrChannel)
            : nameOrChannel;
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

    // Debug support
    debug(message:string) {
        if(this.debugEnabled) {
            this.write('DEBUG', message);
        }
    }

    // Safe truncation for large backend payloads
    private truncate(text: string, maxLength: number = 1000): string {
        if (!text) return '';

        if (text.length < maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength) + 
            "\n...[truncated " + (text.length - maxLength) + " chars]";
    }

    // Log outgoing prompt to LLM
    logPrompt(prompt:string) {
        const trimmed = this.truncate(prompt);
        this.debug("Prompt to Ollama: \n" + trimmed);
    }

    // Log streaming / response in chunks
    logResponseChunck(chunk: string) {
        const trimmed = this.truncate(chunk);
        this.debug("Part of response from Ollama:\n" + trimmed);
    }

    // Log the entire repsonse from LLM
    logResponseFinal(response: string) {
        const trimmed = this.truncate(response);
        this.info("Final response from Ollama:\n" + trimmed);
    }

    show() {
        this.channel.show(true);
    }

    dispose() {
        this.channel.dispose();
    }
}