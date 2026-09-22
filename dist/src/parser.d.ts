export interface VerifiedEntry {
    by: string;
    at: string;
}
export interface GeneratedEntry {
    by: string;
    at: string;
}
export interface SourceEntry {
    id?: string;
    resource: string;
    title?: string;
}
export interface OKFDocument {
    path: string;
    type: string;
    title: string;
    description?: string;
    status: string;
    tags: string[];
    sources: SourceEntry[];
    generated?: GeneratedEntry;
    verified: VerifiedEntry[];
    trust: "human-reviewed" | "machine-confirmed" | "unverified";
    persona?: Record<string, any>;
    frontmatter: Record<string, any>;
    content: string;
}
export declare function normalizeVerified(rawVerified: any): VerifiedEntry[];
export declare function determineTrust(verified: VerifiedEntry[]): "human-reviewed" | "machine-confirmed" | "unverified";
export declare function parseDocument(relativePath: string, rawContent: string): OKFDocument;
export declare function validateDocument(doc: OKFDocument): {
    valid: boolean;
    errors: string[];
};
