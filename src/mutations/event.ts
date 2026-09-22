import fs from "node:fs";
import path from "node:path";
import { acquireLock } from "./lock.js";
import { isWorktreeClean, addFiles, commit } from "./git.js";
import { writeDocumentAtomic, resolveSafePath } from "../vault/reader.js";
import { updateVaultIndex } from "../vault/index.js";

export interface RecordCognitiveEventInput {
  title: string;
  event_kind: string;
  summary: string;
  details: string;
  related_paths?: string[];
  proposed_state?: string;
  target?: string;
  source_producer?: string;
}

export interface RecordCognitiveEventResult {
  eventPath: string;
  commitHash?: string;
  status: "draft";
  state: "draft";
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

export async function recordCognitiveEvent(
  vaultRoot: string,
  input: RecordCognitiveEventInput
): Promise<RecordCognitiveEventResult> {
  const lock = await acquireLock(vaultRoot);

  try {
    const clean = await isWorktreeClean(vaultRoot);
    if (!clean) {
      throw new Error(
        "Refusing mutation: git index has pre-existing staged changes. Please commit or unstage them before recording events."
      );
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const slug = slugify(input.title) || "cognitive-event";
    const filename = "events/" + dateStr + "-" + slug + ".md";
    const { relativePath, absolutePath } = resolveSafePath(vaultRoot, filename);

    let finalRelative = relativePath;
    if (fs.existsSync(absolutePath)) {
      finalRelative = "events/" + dateStr + "-" + slug + "-" + Date.now().toString().slice(-4) + ".md";
    }

    const relatedLinks = (input.related_paths || [])
      .map((p) => "- Relacionado a [" + path.basename(p, ".md") + "](" + p + ")")
      .join("\n");

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

    const producer = input.source_producer || "process:persona-memory";

    const markdownContent =
      "---" +
      "\ntype: cognitive_event" +
      "\ntitle: " +
      JSON.stringify(input.title) +
      "\ndescription: " +
      JSON.stringify(input.summary) +
      "\nstatus: draft" +
      "\ngenerated:" +
      "\n  by: " +
      producer +
      "\n  at: " +
      JSON.stringify(now.toISOString()) +
      "\ntags:" +
      "\n  - cognitive-event" +
      "\n  - " +
      slugify(input.event_kind) +
      "\npersona:" +
      "\n  state: draft" +
      "\n  event_kind: " +
      input.event_kind +
      (input.target ? "\n  target: " + input.target : "") +
      (input.proposed_state ? "\n  proposed_state: " + input.proposed_state : "") +
      (sourcesBlock ? "\nsources:\n" + sourcesBlock : "") +
      "\n---\n\n" +
      "# Contexto\n\n" +
      input.summary +
      "\n\n# Observações e Detalhes\n\n" +
      input.details +
      "\n\n# Relações\n\n" +
      (relatedLinks || "Nenhuma relação inicial especificada.") +
      "\n";

    await writeDocumentAtomic(vaultRoot, finalRelative, markdownContent);

    // Append to log.md
    const logPath = path.join(vaultRoot, "log.md");
    let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# Mutation Log\n";
    const header = "## " + dateStr;
    const logEntry = "- event: " + input.title + " (draft) -> [" + finalRelative + "](" + finalRelative + ")";

    if (logContent.includes(header)) {
      logContent = logContent.replace(header, header + "\n\n" + logEntry);
    } else {
      logContent = logContent + "\n\n" + header + "\n\n" + logEntry + "\n";
    }
    fs.writeFileSync(logPath, logContent, "utf8");

    // Update root index
    try {
      updateVaultIndex(vaultRoot);
    } catch (e) {
      console.error("Warning: could not regenerate index.md:", e);
    }

    const filesToStage = [finalRelative, "log.md", "index.md"];
    await addFiles(vaultRoot, filesToStage);
    const commitMsg = "memory(event): " + slug.replace(/-/g, " ");
    const commitOutput = await commit(vaultRoot, commitMsg);

    return {
      eventPath: finalRelative,
      commitHash: commitOutput,
      status: "draft",
      state: "draft",
    };
  } finally {
    lock.release();
  }
}
