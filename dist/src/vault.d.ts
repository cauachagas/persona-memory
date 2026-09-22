import { OKFDocument } from "./parser.js";
export declare function resolveSafePath(vaultRoot: string, requestPath: string): {
    relativePath: string;
    absolutePath: string;
};
export declare function getAllDocumentPaths(vaultRoot: string): string[];
export declare function readDocument(vaultRoot: string, requestPath: string): OKFDocument;
export declare function loadAllDocuments(vaultRoot: string): OKFDocument[];
export declare function writeDocumentAtomic(vaultRoot: string, requestPath: string, content: string): Promise<void>;
