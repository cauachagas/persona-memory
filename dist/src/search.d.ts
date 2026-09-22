import { OKFDocument } from "./parser.js";
export interface SearchResult {
    path: string;
    type: string;
    title: string;
    status: string;
    trust: "human-reviewed" | "machine-confirmed" | "unverified";
    matched_by: string[];
    snippet: string;
    score: number;
}
export interface SearchOptions {
    types?: string[];
    limit?: number;
    expand_graph?: boolean;
}
export declare function extractSnippet(content: string, queryTokens: string[], maxLength?: number): string;
export declare function searchDocuments(documents: OKFDocument[], query: string, options?: SearchOptions): SearchResult[];
