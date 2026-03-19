import { FileSnapshot } from './FileSnapshot';
import { ElevateContext } from './ElevateContext';
import { SessionContext } from './SessionContext';

export class CoreStateManager {
    private currentSnapshot?: FileSnapshot;
    private currentContext?: ElevateContext;
    private initialized: boolean = false;
    private session: SessionContext = new SessionContext();

    public initialize(): void {
        this.currentSnapshot = undefined;
        this.currentContext = undefined;
        this.initialized = true;
    }

    public getSession(): SessionContext {   // ADD THIS
        return this.session;
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