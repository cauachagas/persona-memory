import fs from "node:fs";
import path from "node:path";
import { acquireLock } from "./locking.js";
import { isWorktreeClean, addFiles, commit } from "./git.js";
import { writeDocumentAtomic, resolveSafePath } from "./vault.js";
function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}
export async function recordCognitiveEvent(vaultRoot, input) {
    const lock = await acquireLock(vaultRoot);
    try {
        // 1. Verify Git staged worktree is clean
        const clean = await isWorktreeClean(vaultRoot);
        if (!clean) {
            throw new Error("Refusing mutation: git index has pre-existing staged changes. Please commit or unstage them before recording events.");
        }
        // 2. Generate filename: events/YYYY-MM-DD-<slug>.md
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const slug = slugify(input.title) || "cognitive-event";
        const filename = "events/" + dateStr + "-" + slug + ".md";
        const { relativePath, absolutePath } = resolveSafePath(vaultRoot, filename);
        // If file already exists, add timestamp suffix
        let finalRelative = relativePath;
        if (fs.existsSync(absolutePath)) {
            finalRelative = "events/" + dateStr + "-" + slug + "-" + Date.now().toString().slice(-4) + ".md";
        }
        // 3. Build frontmatter & body
        const relatedLinks = (input.related_paths || [])
            .map((p) => "- Relacionado a [" + path.basename(p, ".md") + "](" + p + ")")
            .join("\n");
        const sourcesBlock = (input.related_paths || [])
            .map((p, idx) => "  - id: source-" +
            (idx + 1) +
            "\n    resource: " +
            p +
            "\n    title: " +
            path.basename(p, ".md"))
            .join("\n");
        const markdownContent = "---" +
            "\ntype: cognitive_event" +
            "\ntitle: " +
            JSON.stringify(input.title) +
            "\ndescription: " +
            JSON.stringify(input.summary) +
            "\nstatus: draft" +
            "\ngenerated:" +
            "\n  by: process:persona-memory" +
            "\n  at: " +
            JSON.stringify(now.toISOString()) +
            "\ntags:" +
            "\n  - cognitive-event" +
            "\n  - " +
            slugify(input.event_kind) +
            (input.target ? "\npersona:\n  event_kind: " + input.event_kind + "\n  target: " + input.target + (input.proposed_state ? "\n  proposed_state: " + input.proposed_state : "") : "\npersona:\n  event_kind: " + input.event_kind) +
            (sourcesBlock ? "\nsources:\n" + sourcesBlock : "") +
            "\n---\n\n" +
            "# Contexto e Resumo\n\n" +
            input.summary +
            "\n\n# Detalhes e Observações\n\n" +
            input.details +
            "\n\n# Relações\n\n" +
            (relatedLinks || "Nenhuma relação inicial especificada.") +
            "\n";
        // 4. Write event file atomically
        await writeDocumentAtomic(vaultRoot, finalRelative, markdownContent);
        // 5. Append to log.md
        const logPath = path.join(vaultRoot, "log.md");
        let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# Mutation Log\n";
        const header = "## " + dateStr;
        const logEntry = "- event: " + input.title + " (draft) -> [" + finalRelative + "](" + finalRelative + ")";
        if (logContent.includes(header)) {
            logContent = logContent.replace(header, header + "\n\n" + logEntry);
        }
        else {
            logContent = logContent + "\n\n" + header + "\n\n" + logEntry + "\n";
        }
        fs.writeFileSync(logPath, logContent, "utf8");
        // 6. Git commit
        const filesToStage = [finalRelative, "log.md"];
        await addFiles(vaultRoot, filesToStage);
        const commitMsg = "memory(event): " + slug.replace(/-/g, " ");
        const commitOutput = await commit(vaultRoot, commitMsg);
        return {
            eventPath: finalRelative,
            commitHash: commitOutput,
            status: "draft",
        };
    }
    finally {
        lock.release();
    }
}
