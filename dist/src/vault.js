import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "./parser.js";
const RECOGNIZED_DIRS = [
    "heuristics",
    "beliefs",
    "competencies",
    "projects",
    "goals",
    "events",
    "evidence",
];
export function resolveSafePath(vaultRoot, requestPath) {
    if (!requestPath || typeof requestPath !== "string") {
        throw new Error("Invalid request path: path must be a non-empty string");
    }
    const normalizedVaultRoot = path.resolve(vaultRoot);
    const realVaultRoot = fs.existsSync(normalizedVaultRoot) ? fs.realpathSync(normalizedVaultRoot) : normalizedVaultRoot;
    let cleaned = requestPath.trim();
    while (cleaned.startsWith("/")) {
        cleaned = cleaned.slice(1);
    }
    const normalized = path.normalize(cleaned);
    const absolutePath = path.resolve(normalizedVaultRoot, normalized);
    if (!absolutePath.startsWith(normalizedVaultRoot) && !absolutePath.startsWith(realVaultRoot)) {
        throw new Error("Access denied: path '" + requestPath + "' escapes the vault boundary");
    }
    if (fs.existsSync(absolutePath)) {
        const real = fs.realpathSync(absolutePath);
        if (!real.startsWith(realVaultRoot)) {
            throw new Error("Access denied: symlink '" + requestPath + "' points outside vault");
        }
    }
    const relativePath = path.relative(normalizedVaultRoot, absolutePath).replace(/\\/g, "/");
    return { relativePath, absolutePath };
}
export function getAllDocumentPaths(vaultRoot) {
    const result = [];
    if (fs.existsSync(path.join(vaultRoot, "index.md"))) {
        result.push("index.md");
    }
    if (fs.existsSync(path.join(vaultRoot, "log.md"))) {
        result.push("log.md");
    }
    for (const dir of RECOGNIZED_DIRS) {
        const fullDir = path.join(vaultRoot, dir);
        if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
            const files = fs.readdirSync(fullDir, { recursive: true });
            for (const file of files) {
                if (file.endsWith(".md") && !file.startsWith(".")) {
                    const rel = path.join(dir, file).replace(/\\/g, "/");
                    result.push(rel);
                }
            }
        }
    }
    return result;
}
export function readDocument(vaultRoot, requestPath) {
    const { relativePath, absolutePath } = resolveSafePath(vaultRoot, requestPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new Error("Document not found: '" + relativePath + "'");
    }
    const rawContent = fs.readFileSync(absolutePath, "utf8");
    return parseDocument(relativePath, rawContent);
}
export function loadAllDocuments(vaultRoot) {
    const paths = getAllDocumentPaths(vaultRoot);
    const docs = [];
    for (const p of paths) {
        try {
            docs.push(readDocument(vaultRoot, p));
        }
        catch (e) {
            console.error("Failed to read document " + p + ":", e);
        }
    }
    return docs;
}
export async function writeDocumentAtomic(vaultRoot, requestPath, content) {
    const { relativePath, absolutePath } = resolveSafePath(vaultRoot, requestPath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = path.join(dir, "." + path.basename(absolutePath) + "." + Date.now() + ".tmp");
    fs.writeFileSync(tempFile, content, "utf8");
    const fd = fs.openSync(tempFile, "r+");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tempFile, absolutePath);
}
