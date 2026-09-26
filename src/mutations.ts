import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { acquireLock } from "./locking.js";
import { isWorktreeClean, addFiles, commit, resetFiles } from "./git.js";
import { writeDocumentAtomic, resolveSafePath, loadAllDocuments } from "./vault.js";
import { readDocument } from "./vault.js";
import { parseReviewState, ReviewOutcome } from "./parser.js";
import { computeNextReview, reviewStateToFrontmatter } from "./temporal.js";

export interface RecordCognitiveEventInput {
  title: string;
  description: string;
  event_kind: string;
  summary: string;
  details: string;
  target?: string;
  related_paths?: string[];
  producer?: string;
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

export function updateManagedIndex(vaultRoot: string): void {
  const indexPath = path.join(vaultRoot, "index.md");
  let content = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

  const docs = loadAllDocuments(vaultRoot);

  const startMarker = "<!-- persona:managed-start -->";
  const endMarker = "<!-- persona:managed-end -->";

  // Deterministic sorting helper
  const sortDocs = (list: typeof docs) => list.sort((a, b) => a.title.localeCompare(b.title));

  const heuristics = sortDocs(docs.filter((d) => d.type === "heuristic"));
  const beliefs = sortDocs(docs.filter((d) => d.type === "belief"));
  const competencies = sortDocs(docs.filter((d) => d.type === "competency"));
  const projects = sortDocs(docs.filter((d) => d.type === "project"));
  const events = docs.filter((d) => d.type === "cognitive_event").sort((a, b) => b.path.localeCompare(a.path));

  let managed = "\n## Heuristics\n\n";
  for (const h of heuristics) {
    managed += "* [" + h.title + "](" + h.path + ") - " + h.description + "\n";
  }

  managed += "\n## Beliefs\n\n";
  for (const b of beliefs) {
    managed += "* [" + b.title + "](" + b.path + ") - " + b.description + "\n";
  }

  managed += "\n## Competencies\n\n";
  for (const c of competencies) {
    managed += "* [" + c.title + "](" + c.path + ") - " + c.description + "\n";
  }

  managed += "\n## Projects\n\n";
  for (const p of projects) {
    managed += "* [" + p.title + "](" + p.path + ") - " + p.description + "\n";
  }

  if (events.length > 0) {
    managed += "\n## Events\n\n";
    for (const e of events.slice(0, 10)) {
      managed += "* [" + e.title + "](" + e.path + ") - " + e.description + "\n";
    }
  }

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const pre = content.slice(0, content.indexOf(startMarker) + startMarker.length);
    const post = content.slice(content.indexOf(endMarker));
    content = pre + managed + "\n" + post;
  } else {
    // Append managed block
    content = content + "\n" + startMarker + managed + "\n" + endMarker + "\n";
  }

  fs.writeFileSync(indexPath, content, "utf8");
}

export async function recordCognitiveEvent(
  vaultRoot: string,
  input: RecordCognitiveEventInput
): Promise<RecordCognitiveEventResult> {
  const lock = await acquireLock(vaultRoot);

  // Snapshot memory state for rollback
  const indexPath = path.join(vaultRoot, "index.md");
  const logPath = path.join(vaultRoot, "log.md");
  const indexSnapshot = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;
  const logSnapshot = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : null;

  let createdEventAbsolute: string | null = null;
  let finalRelative: string = "";

  try {
    // 1. Validate worktree cleanliness
    const clean = await isWorktreeClean(vaultRoot);
    if (!clean) {
      throw new Error("VAULT_DIRTY: Working tree has uncommitted or staged changes. Aborting mutation to prevent accidental commits.");
    }

    // 2. Validate target requirement for event_kind
    const kindsRequiringTarget = ["belief_change", "belief_challenge", "competency_milestone", "project_lesson"];
    if (kindsRequiringTarget.includes(input.event_kind) && !input.target) {
      throw new Error("Target is required for event_kind '" + input.event_kind + "'");
    }

    // 2b. Validate target paths exist inside the vault jail
    const pathsToCheck = [...(input.target ? [input.target] : []), ...(input.related_paths || [])];
    for (const p of pathsToCheck) {
      const { absolutePath, relativePath } = resolveSafePath(vaultRoot, p);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new Error("Target path does not exist in vault: '" + relativePath + "'");
      }
    }

    // 3. Collision-free filename generation: events/YYYY-MM-DD-<slug>.md
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const baseSlug = slugify(input.title) || "cognitive-event";

    let candidateName = "events/" + dateStr + "-" + baseSlug + ".md";
    let counter = 1;
    while (fs.existsSync(path.resolve(vaultRoot, candidateName))) {
      const suffix = counter < 10 ? "-0" + counter : "-" + counter;
      candidateName = "events/" + dateStr + "-" + baseSlug + suffix + ".md";
      counter++;
    }

    finalRelative = "/" + candidateName;
    const { absolutePath } = resolveSafePath(vaultRoot, candidateName);
    createdEventAbsolute = absolutePath;

    // 4. Build frontmatter & body
    const producer = input.producer || "persona-memory/0.1";

    const relatedLinks = (input.related_paths || [])
      .map((p) => {
        const cleanP = p.startsWith("/") ? p : "/" + p;
        const baseName = path.basename(cleanP, ".md");
        return "- Relacionado a [[" + cleanP.replace(/^\//, "").replace(/\.md$/, "") + "]]";
      })
      .join("\n");

    const sourcesBlock = (input.related_paths || [])
      .map((p, idx) => {
        const cleanP = p.startsWith("/") ? p : "/" + p;
        return "  - id: source-" + (idx + 1) + "\n    resource: " + cleanP + "\n    title: " + path.basename(cleanP, ".md");
      })
      .join("\n");

    const markdownContent =
      "---" +
      "\ntype: cognitive_event" +
      "\ntitle: " + JSON.stringify(input.title) +
      "\ndescription: " + JSON.stringify(input.description || input.summary) +
      "\nstatus: draft" +
      "\ngenerated:" +
      "\n  by: " + producer +
      "\n  at: " + JSON.stringify(now.toISOString()) +
      "\ntags:" +
      "\n  - cognitive-event" +
      "\n  - " + slugify(input.event_kind) +
      "\npersona:" +
      "\n  state: draft" +
      "\n  event_kind: " + input.event_kind +
      (input.target ? "\n  target: " + (input.target.startsWith("/") ? input.target : "/" + input.target) : "") +
      (sourcesBlock ? "\nsources:\n" + sourcesBlock : "") +
      "\n---\n\n" +
      "# Contexto\n\n" +
      input.summary +
      "\n\n# Observações e Detalhes\n\n" +
      input.details +
      "\n\n# Relações\n\n" +
      (relatedLinks || "Nenhuma relação inicial especificada.") +
      "\n";

    // 5. Write event atomically
    await writeDocumentAtomic(vaultRoot, candidateName, markdownContent);

    // 6. Update log.md (newest first under date heading)
    let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# Mutation Log\n";
    const header = "## " + dateStr;
    const commitMsg = "memory(event): " + baseSlug.replace(/-/g, " ");
    const logEntry = "- **Created** `" + candidateName + "`\n  `" + commitMsg + "`";

    if (logContent.includes(header)) {
      logContent = logContent.replace(header, header + "\n\n" + logEntry);
    } else {
      logContent = "# Mutation Log\n\n" + header + "\n\n" + logEntry + "\n\n" + logContent.replace("# Mutation Log", "").trim();
    }
    fs.writeFileSync(logPath, logContent.trim() + "\n", "utf8");

    // 7. Update managed index.md
    updateManagedIndex(vaultRoot);

    // 8. Explicit Git staging and commit
    const filesToStage = [candidateName, "log.md", "index.md"];
    await addFiles(vaultRoot, filesToStage);
    const commitOutput = await commit(vaultRoot, commitMsg);

    return {
      eventPath: finalRelative,
      commitHash: commitOutput,
      status: "draft",
      state: "draft",
    };
  } catch (err: any) {
    // Best-effort rollback
    let rollbackError: any = null;
    try {
      if (createdEventAbsolute && fs.existsSync(createdEventAbsolute)) {
        fs.unlinkSync(createdEventAbsolute);
      }
      if (indexSnapshot !== null) {
        fs.writeFileSync(indexPath, indexSnapshot, "utf8");
      }
      if (logSnapshot !== null) {
        fs.writeFileSync(logPath, logSnapshot, "utf8");
      }
      const filesToReset = [finalRelative.replace(/^\//, ""), "log.md", "index.md"].filter(Boolean);
      await resetFiles(vaultRoot, filesToReset);
    } catch (rbErr) {
      rollbackError = rbErr;
    }

    if (rollbackError) {
      throw new Error("ROLLBACK_FAILED: Mutation error: " + err.message + " | Rollback failed: " + rollbackError.message);
    }

    throw err;
  } finally {
    lock.release();
  }
}

// ─── recordReviewEvent ────────────────────────────────────────────────────────

export interface RecordReviewEventInput {
  /** Bundle-relative path of the document being reviewed, e.g. "/beliefs/foo.md" */
  target: string;
  outcome: ReviewOutcome;
  /** Brief context of what was reviewed and how it went */
  summary: string;
  /** Optional extended notes */
  details?: string;
  producer?: string;
}

export interface RecordReviewEventResult {
  /** Path of the cognitive_event file created */
  eventPath: string;
  /** Path of the reviewed document (updated in place) */
  targetPath: string;
  /** New review state after applying SM-2 */
  newReview: ReturnType<typeof reviewStateToFrontmatter>;
  commitHash?: string;
}

/**
 * Records a spaced-repetition review of a knowledge document:
 * 1. Reads the target document and computes the next review state via SM-2.
 * 2. Rewrites the target's frontmatter atomically (preserving all other fields).
 * 3. Creates a `cognitive_event` of kind `review` in /events/.
 * 4. Updates log.md and index.md.
 * 5. Git-stages and commits everything.
 */
export async function recordReviewEvent(
  vaultRoot: string,
  input: RecordReviewEventInput
): Promise<RecordReviewEventResult> {
  const lock = await acquireLock(vaultRoot);

  const indexPath = path.join(vaultRoot, "index.md");
  const logPath = path.join(vaultRoot, "log.md");
  const indexSnapshot = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;
  const logSnapshot = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : null;

  let createdEventAbsolute: string | null = null;
  let targetSnapshot: string | null = null;
  let eventRelative = "";

  try {
    // 1. Validate worktree
    const clean = await isWorktreeClean(vaultRoot);
    if (!clean) {
      throw new Error("VAULT_DIRTY: Working tree has uncommitted or staged changes. Aborting mutation.");
    }

    // 2. Resolve & read target document
    const { absolutePath: targetAbsolute, relativePath: targetRelative } =
      resolveSafePath(vaultRoot, input.target);
    if (!fs.existsSync(targetAbsolute) || !fs.statSync(targetAbsolute).isFile()) {
      throw new Error("Target document not found in vault: '" + targetRelative + "'");
    }

    const rawTarget = fs.readFileSync(targetAbsolute, "utf8");
    targetSnapshot = rawTarget;
    const parsedTarget = matter(rawTarget);
    const targetDoc = readDocument(vaultRoot, input.target);

    // Only temporal document types support review
    const TEMPORAL_TYPES = new Set(["heuristic", "belief", "competency", "project", "evidence"]);
    if (!TEMPORAL_TYPES.has(targetDoc.type)) {
      throw new Error("Document type '" + targetDoc.type + "' does not support temporal review (path: " + targetRelative + ")");
    }

    // 3. Compute new review state via SM-2
    const currentReview = parseReviewState(parsedTarget.data?.persona?.review);
    const newReview = computeNextReview(currentReview, input.outcome);

    // 4. Rewrite target frontmatter (preserving all other fields)
    const updatedData = {
      ...parsedTarget.data,
      persona: {
        ...(parsedTarget.data?.persona ?? {}),
        review: reviewStateToFrontmatter(newReview),
      },
    };
    const updatedTargetContent = matter.stringify(parsedTarget.content, updatedData);
    await writeDocumentAtomic(vaultRoot, input.target, updatedTargetContent);

    // 5. Create cognitive_event of kind "review"
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const baseSlug = "review-" + slugify(targetDoc.title || "doc");
    let candidateName = "events/" + dateStr + "-" + baseSlug + ".md";
    let counter = 1;
    while (fs.existsSync(path.resolve(vaultRoot, candidateName))) {
      const suffix = counter < 10 ? "-0" + counter : "-" + counter;
      candidateName = "events/" + dateStr + "-" + baseSlug + suffix + ".md";
      counter++;
    }
    eventRelative = "/" + candidateName;
    const { absolutePath: eventAbsolute } = resolveSafePath(vaultRoot, candidateName);
    createdEventAbsolute = eventAbsolute;

    const producer = input.producer || "persona-memory/0.1";
    const eventContent =
      "---" +
      "\ntype: cognitive_event" +
      "\ntitle: " + JSON.stringify("Review: " + targetDoc.title) +
      "\ndescription: " + JSON.stringify("Revisão espaçada — outcome: " + input.outcome) +
      "\nstatus: draft" +
      "\ngenerated:" +
      "\n  by: " + producer +
      "\n  at: " + JSON.stringify(now.toISOString()) +
      "\ntags:" +
      "\n  - cognitive-event" +
      "\n  - review" +
      "\npersona:" +
      "\n  state: reviewed" +
      "\n  event_kind: review" +
      "\n  target: " + (input.target.startsWith("/") ? input.target : "/" + input.target) +
      "\n  outcome: " + input.outcome +
      "\n  mastery_before: " + currentReview.mastery +
      "\n  mastery_after: " + newReview.mastery +
      "\n---\n\n" +
      "# Contexto\n\n" + input.summary +
      "\n\n# Observações e Detalhes\n\n" + (input.details || "Nenhum detalhe adicional.") +
      "\n";

    await writeDocumentAtomic(vaultRoot, candidateName, eventContent);

    // 6. Update log.md
    let logContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# Mutation Log\n";
    const header = "## " + dateStr;
    const commitMsg = "memory(review): " + slugify(targetDoc.title || "doc").replace(/-/g, " ");
    const logEntry = "- **Reviewed** `" + input.target + "` → outcome: `" + input.outcome + "`, mastery: " +
      currentReview.mastery + "→" + newReview.mastery + ", next: `" + newReview.next_review + "`\n" +
      "  Created `" + candidateName + "`";

    if (logContent.includes(header)) {
      logContent = logContent.replace(header, header + "\n\n" + logEntry);
    } else {
      logContent = "# Mutation Log\n\n" + header + "\n\n" + logEntry + "\n\n" +
        logContent.replace("# Mutation Log", "").trim();
    }
    fs.writeFileSync(logPath, logContent.trim() + "\n", "utf8");

    // 7. Update managed index
    updateManagedIndex(vaultRoot);

    // 8. Git stage + commit
    const filesToStage = [
      input.target.replace(/^\//, ""),
      candidateName,
      "log.md",
      "index.md",
    ];
    await addFiles(vaultRoot, filesToStage);
    const commitHash = await commit(vaultRoot, commitMsg);

    return {
      eventPath: eventRelative,
      targetPath: targetRelative,
      newReview: reviewStateToFrontmatter(newReview),
      commitHash,
    };
  } catch (err: any) {
    // Best-effort rollback
    let rollbackError: any = null;
    try {
      if (createdEventAbsolute && fs.existsSync(createdEventAbsolute)) {
        fs.unlinkSync(createdEventAbsolute);
      }
      // Restore target document to pre-review state
      if (targetSnapshot !== null) {
        const { absolutePath: targetAbs } = resolveSafePath(vaultRoot, input.target);
        fs.writeFileSync(targetAbs, targetSnapshot, "utf8");
      }
      if (indexSnapshot !== null) {
        fs.writeFileSync(indexPath, indexSnapshot, "utf8");
      }
      if (logSnapshot !== null) {
        fs.writeFileSync(logPath, logSnapshot, "utf8");
      }
      const filesToReset = [
        input.target.replace(/^\//, ""),
        eventRelative.replace(/^\//, ""),
        "log.md",
        "index.md",
      ].filter(Boolean);
      await resetFiles(vaultRoot, filesToReset);
    } catch (rbErr) {
      rollbackError = rbErr;
    }

    if (rollbackError) {
      throw new Error(
        "ROLLBACK_FAILED: Review error: " + err.message +
        " | Rollback failed: " + rollbackError.message
      );
    }
    throw err;
  } finally {
    lock.release();
  }
}
