import fs from "node:fs";
import path from "node:path";
import { acquireLock } from "./lock.js";
import { isWorktreeClean, addFiles, commit } from "./git.js";
import { writeDocumentAtomic, resolveSafePath } from "../vault/reader.js";

export interface RecordEvidenceInput {
  title: string;
  content: string;
  context?: string;
  related_paths?: string[];
  source_producer?: string;
}

export interface RecordEvidenceResult {
  evidencePath: string;
  commitHash?: string;
  sizeBytes: number;
}

const MAX_EVIDENCE_BYTES = 100 * 1024; // 100 KB limit per Persona Memory rule

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{30,}/i, // Google API Key
  /sk-[a-zA-Z0-9]{32,}/i, // OpenAI API Key
  /ghp_[0-9a-zA-Z]{30,}/i, // GitHub Token
  /-----BEGIN [A-Z]+ PRIVATE KEY-----/i, // Private keys
  /password\s*=\s*['"][^'"]+['"]/i, // Passwords
];

export function redactSensitiveData(text: string): { cleaned: string; redactedCount: number } {
  let cleaned = text;
  let redactedCount = 0;
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
      redactedCount++;
    }
  }
  return { cleaned, redactedCount };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function recordEvidence(
  vaultRoot: string,
  input: RecordEvidenceInput
): Promise<RecordEvidenceResult> {
  const lock = await acquireLock(vaultRoot);

  try {
    const clean = await isWorktreeClean(vaultRoot);
    if (!clean) {
      throw new Error(
        "Refusing mutation: git index has pre-existing staged changes. Please commit or unstage them before recording evidence."
      );
    }

    const { cleaned: sanitizedContent, redactedCount } = redactSensitiveData(input.content);
    const byteLength = Buffer.byteLength(sanitizedContent, "utf8");

    if (byteLength > MAX_EVIDENCE_BYTES) {
      throw new Error(
        "Evidence size (" + byteLength + " bytes) exceeds maximum allowable limit of " + MAX_EVIDENCE_BYTES + " bytes (100 KB)."
      );
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const slug = slugify(input.title) || "evidence";
    const filename = "evidence/" + dateStr + "-" + slug + ".md";
    const { relativePath, absolutePath } = resolveSafePath(vaultRoot, filename);

    let finalRelative = relativePath;
    if (fs.existsSync(absolutePath)) {
      finalRelative = "evidence/" + dateStr + "-" + slug + "-" + Date.now().toString().slice(-4) + ".md";
    }

    const producer = input.source_producer || "process:persona-memory";

    const sourcesBlock = (input.related_paths || [])
      .map(
        (p, idx) =>
          "  - id: source-" +
          (idx + 1) +
          "\n    resource: " +
          p +
          "\n    title: " +
          path.basename(p, ".md")
      )
      .join("\n");

    const markdownContent =
      "---" +
      "\ntype: evidence" +
      "\ntitle: " +
      JSON.stringify(input.title) +
      "\nstatus: stable" +
      "\ngenerated:" +
      "\n  by: " +
      producer +
      "\n  at: " +
      JSON.stringify(now.toISOString()) +
      "\ntags:" +
      "\n  - evidence" +
      (redactedCount > 0 ? "\n  - redacted" : "") +
      (sourcesBlock ? "\nsources:\n" + sourcesBlock : "") +
      "\n---\n\n" +
      (input.context ? "# Contexto\n\n" + input.context + "\n\n" : "") +
      "# Conteúdo da Evidência\n\n" +
      sanitizedContent +
      "\n";

    await writeDocumentAtomic(vaultRoot, finalRelative, markdownContent);

    // Append to log.md
    const logPath = path.join(vaultRoot, "log.md");
    let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# Mutation Log\n";
    const header = "## " + dateStr;
    const logEntry = "- evidence: " + input.title + " -> [" + finalRelative + "](" + finalRelative + ")";

    if (logContent.includes(header)) {
      logContent = logContent.replace(header, header + "\n\n" + logEntry);
    } else {
      logContent = logContent + "\n\n" + header + "\n\n" + logEntry + "\n";
    }
    fs.writeFileSync(logPath, logContent, "utf8");

    const filesToStage = [finalRelative, "log.md"];
    await addFiles(vaultRoot, filesToStage);
    const commitMsg = "memory(evidence): " + slug.replace(/-/g, " ");
    const commitOutput = await commit(vaultRoot, commitMsg);

    return {
      evidencePath: finalRelative,
      commitHash: commitOutput,
      sizeBytes: byteLength,
    };
  } finally {
    lock.release();
  }
}
