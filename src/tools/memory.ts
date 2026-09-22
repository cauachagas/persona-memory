import { readDocument } from "../vault/reader.js";

export function handleGetMemory(vaultRoot: string, requestPath: string): { path: string; frontmatter: Record<string, any>; content: string } {
  const doc = readDocument(vaultRoot, requestPath);
  return {
    path: doc.path,
    frontmatter: doc.frontmatter,
    content: doc.content,
  };
}
