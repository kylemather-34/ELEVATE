import { FileSnapshot } from './FileSnapshot';
import { ElevateContext } from './ElevateContext';

export class CoreStateManager {
    private currentSnapshot?: FileSnapshot;
    private currentContext?: ElevateContext;
    private initialized: boolean = false;

    public initialize(): void {
        this.currentSnapshot = undefined;
        this.currentContext = undefined;
        this.initialized = true;
    }

    public saveState(context: ElevateContext): void {
        if (!this.initialized) {
            throw new Error('CoreStateManager has not been initialized.');
        }
        this.currentContext = context;
        this.currentSnapshot = context.snapshot;
    }

    public loadState(): ElevateContext | undefined {
        if (!this.initialized) {
            throw new Error('CoreStateManager has not been initialized.');
        }
        return this.currentContext;
    }

    public getSnapshot(): FileSnapshot | undefined {
        return this.currentSnapshot;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }
}