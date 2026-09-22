export interface PersonaMemoryConfig {
    vaultPath: string;
}
export declare function resolveVaultPath(cliVaultArg?: string): string;
export declare function getConfig(cliVaultArg?: string): PersonaMemoryConfig;
