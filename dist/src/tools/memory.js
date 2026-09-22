import { loadAllDocuments, readDocument } from "../vault.js";
import { searchDocuments } from "../search.js";
export function handleSearchMemory(vaultRoot, query, options = {}) {
    const docs = loadAllDocuments(vaultRoot);
    return searchDocuments(docs, query, options);
}
export function handleGetMemory(vaultRoot, requestPath) {
    const doc = readDocument(vaultRoot, requestPath);
    return {
        path: doc.path,
        frontmatter: doc.frontmatter,
        content: doc.content,
    };
}
