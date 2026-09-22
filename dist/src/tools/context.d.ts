export interface PersonaContextOutput {
    identity: {
        name: string;
        source: string;
    };
    heuristics: string[];
    active_frontiers: string[];
    current_beliefs: string[];
}
export declare function getPersonaContext(vaultRoot: string): PersonaContextOutput;
