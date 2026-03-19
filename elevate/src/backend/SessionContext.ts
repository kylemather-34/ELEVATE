import { FileSnapshot } from './FileSnapshot';

export interface Feedback {
    timestamp: string;
    filePath: string;
    response: string;
}

export class SessionContext {
    private activeFile?: FileSnapshot;
    private recentFeedback: Feedback[] = [];

    public setActiveFile(snapshot: FileSnapshot): void {
        this.activeFile = snapshot;
    }

    public getActiveFile(): FileSnapshot | undefined {
        return this.activeFile;
    }

    public addFeedback(response: string): void {
        this.recentFeedback.push({
            timestamp: new Date().toISOString(),
            filePath: this.activeFile?.uri ?? 'unknown',
            response
        });
    }

    public getRecentFeedback(): Feedback[] {
        return this.recentFeedback;
    }

    public clearFeedback(): void {
        this.recentFeedback = [];
    }
}