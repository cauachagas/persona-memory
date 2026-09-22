export interface LockHandle {
    release: () => void;
}
export declare function acquireLock(vaultRoot: string): Promise<LockHandle>;
