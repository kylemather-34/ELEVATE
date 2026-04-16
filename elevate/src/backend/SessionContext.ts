// Summary of file in push commenets.
import { FileSnapshot } from './FileSnapshot';

export interface Feedback {
    timestamp: string;
    filePath: string;
    response: string;
}

const MAX_FEEDBACK = 50;

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
        if (this.recentFeedback.length > MAX_FEEDBACK) {
            this.recentFeedback.shift();
        }
    }

    public getRecentFeedback(): Feedback[] {
        return this.recentFeedback;
    }

    public restoreFeedback(feedback: Feedback[]): void {
        this.recentFeedback = [...feedback];
    }

    public clearFeedback(): void {
        this.recentFeedback = [];
    }
}