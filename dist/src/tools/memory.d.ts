import { SearchResult, SearchOptions } from "../search.js";
export declare function handleSearchMemory(vaultRoot: string, query: string, options?: SearchOptions): SearchResult[];
export declare function handleGetMemory(vaultRoot: string, requestPath: string): {
    path: string;
    frontmatter: Record<string, any>;
    content: string;
};
