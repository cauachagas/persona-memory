import fs from "node:fs";
import path from "node:path";
import { parseDocument, OKFDocument } from "./parser.js";

const RECOGNIZED_DIRS = [
  "heuristics",
  "beliefs",
  "competencies",
  "projects",
  "events",
  "evidence",
];

export function resolveSafePath(vaultRoot: string, requestPath: string): { relativePath: string; absolutePath: string } {
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

  const rel = path.relative(normalizedVaultRoot, absolutePath).replace(/\\/g, "/");
  const relativePath = rel.startsWith("/") ? rel : "/" + rel;
  return { relativePath, absolutePath };
}

export function getAllDocumentPaths(vaultRoot: string): string[] {
  const result: string[] = [];

  if (fs.existsSync(path.join(vaultRoot, "index.md"))) {
    result.push("/index.md");
  }
  if (fs.existsSync(path.join(vaultRoot, "log.md"))) {
    result.push("/log.md");
  }

  for (const dir of RECOGNIZED_DIRS) {
    const fullDir = path.join(vaultRoot, dir);
    if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
      const files = fs.readdirSync(fullDir, { recursive: true }) as string[];
      for (const file of files) {
        if (file.endsWith(".md") && !file.startsWith(".")) {
          const rel = "/" + path.join(dir, file).replace(/\\/g, "/");
          result.push(rel);
        }
      }
    }
  }

  return result;
}

export function readDocument(vaultRoot: string, requestPath: string): OKFDocument {
  const { relativePath, absolutePath } = resolveSafePath(vaultRoot, requestPath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error("Document not found: '" + relativePath + "'");
  }
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  return parseDocument(relativePath, rawContent);
}

export function loadAllDocuments(vaultRoot: string): OKFDocument[] {
  const paths = getAllDocumentPaths(vaultRoot);
  const docs: OKFDocument[] = [];
  for (const p of paths) {
    try {
      docs.push(readDocument(vaultRoot, p));
    } catch (e) {
      console.error("Failed to read document " + p + ":", e);
    }
  }
  return docs;
}

export async function writeDocumentAtomic(vaultRoot: string, requestPath: string, content: string): Promise<void> {
  const { absolutePath } = resolveSafePath(vaultRoot, requestPath);
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
