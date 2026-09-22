export declare function isGitRepo(vaultRoot: string): Promise<boolean>;
export declare function isWorktreeClean(vaultRoot: string): Promise<boolean>;
export declare function addFiles(vaultRoot: string, filePaths: string[]): Promise<void>;
export declare function commit(vaultRoot: string, message: string): Promise<string>;
export declare function getRecentCommits(vaultRoot: string, count?: number): Promise<string[]>;
