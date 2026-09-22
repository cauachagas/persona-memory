import { loadAllDocuments, readDocument, resolveSafePath } from "../vault.js";
import { searchDocuments, SearchResult, SearchOptions } from "../search.js";

export function handleSearchMemory(vaultRoot: string, query: string, options: SearchOptions = {}): SearchResult[] {
  const docs = loadAllDocuments(vaultRoot);
  return searchDocuments(docs, query, options);
}

export function handleGetMemory(vaultRoot: string, requestPath: string): { path: string; frontmatter: Record<string, any>; content: string } {
  const doc = readDocument(vaultRoot, requestPath);
  return {
    path: doc.path,
    frontmatter: doc.frontmatter,
    content: doc.content,
  };
}
