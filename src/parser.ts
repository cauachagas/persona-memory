import matter from "gray-matter";

export interface VerifiedEntry {
  by: string;
  at: string;
}

export interface GeneratedEntry {
  by: string;
  at: string;
}

export interface SourceRelation {
  id?: string;
  resource: string;
  title?: string;
}

// ─── Temporal / Spaced-Repetition types ──────────────────────────────────────

export type ReviewOutcome = "again" | "hard" | "good" | "easy";

export interface ReviewHistoryEntry {
  at: string;              // ISO datetime of the review
  outcome: ReviewOutcome;
  mastery_before: number;
  mastery_after: number;
}

/**
 * Temporal review state stored inside persona.review frontmatter block.
 *
 * Mastery scale (0–5):
 *   0 = unknown | 1 = heard of it | 2 = understand concept
 *   3 = apply with reference | 4 = apply fluently | 5 = intuitive / can teach
 */
export interface ReviewState {
  mastery: number;              // 0–5
  ease_factor: number;          // SM-2 ease factor, ≥ 1.3
  interval_days: number;        // days until next review, ≥ 1
  next_review: string;          // "YYYY-MM-DD"
  review_count: number;
  last_review: string | null;   // ISO datetime or null
  review_history: ReviewHistoryEntry[];
}

/** Document types that carry temporal review state. */
const TEMPORAL_TYPES = new Set(["heuristic", "belief", "competency", "project", "evidence"]);

// ─────────────────────────────────────────────────────────────────────────────

export interface OKFDocument {
  path: string; // bundle-relative, e.g. "/beliefs/modular-monolith.md"
  type: string;
  title: string;
  description: string;
  status: string;
  tags: string[];
  sources: SourceRelation[];
  generated?: GeneratedEntry;
  verified: VerifiedEntry[];
  trust: "human-verified" | "source-backed" | "agent-generated" | "unverified";
  persona?: Record<string, any>;
  /** Parsed and defaulted review state. Present only for temporal document types. */
  review?: ReviewState;
  frontmatter: Record<string, any>;
  content: string;
}

export interface ValidationIssue {
  severity: "ERROR" | "WARNING";
  message: string;
}

export function normalizeVerified(rawVerified: any): VerifiedEntry[] {
  if (!rawVerified) return [];
  if (Array.isArray(rawVerified)) {
    return rawVerified.map((v) => ({
      by: String(v.by || "unknown"),
      at: String(v.at || ""),
    }));
  }
  if (typeof rawVerified === "object" && rawVerified.by) {
    return [{ by: String(rawVerified.by), at: String(rawVerified.at || "") }];
  }
  return [];
}

export function determineTrust(doc: { verified: VerifiedEntry[]; generated?: GeneratedEntry; sources: SourceRelation[] }): "human-verified" | "source-backed" | "agent-generated" | "unverified" {
  if (doc.verified.some((v) => v.by.startsWith("human:"))) {
    return "human-verified";
  }
  if (doc.sources && doc.sources.length > 0) {
    return "source-backed";
  }
  if (doc.generated && (doc.generated.by.includes("/") || doc.generated.by.startsWith("agent:") || doc.generated.by.startsWith("process:"))) {
    return "agent-generated";
  }
  return "unverified";
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parses the `persona.review` block from raw frontmatter, applying safe
 * defaults so legacy documents (without any temporal fields) continue to
 * work without errors.
 */
export function parseReviewState(rawReview: any): ReviewState {
  const history: ReviewHistoryEntry[] = [];
  if (Array.isArray(rawReview?.review_history)) {
    for (const entry of rawReview.review_history.slice(-10)) {
      if (
        entry &&
        typeof entry.at === "string" &&
        ["again", "hard", "good", "easy"].includes(entry.outcome)
      ) {
        history.push({
          at: entry.at,
          outcome: entry.outcome as ReviewOutcome,
          mastery_before: typeof entry.mastery_before === "number" ? entry.mastery_before : 0,
          mastery_after: typeof entry.mastery_after === "number" ? entry.mastery_after : 0,
        });
      }
    }
  }

  return {
    mastery: clamp(
      typeof rawReview?.mastery === "number" ? rawReview.mastery : 0,
      0, 5
    ),
    ease_factor: Math.max(
      1.3,
      typeof rawReview?.ease_factor === "number" ? rawReview.ease_factor : 2.5
    ),
    interval_days: Math.max(
      1,
      typeof rawReview?.interval_days === "number" ? rawReview.interval_days : 1
    ),
    next_review:
      typeof rawReview?.next_review === "string" && rawReview.next_review
        ? rawReview.next_review
        : todayDateString(),
    review_count:
      typeof rawReview?.review_count === "number" ? rawReview.review_count : 0,
    last_review:
      typeof rawReview?.last_review === "string" ? rawReview.last_review : null,
    review_history: history,
  };
}

export function parseDocument(relativePath: string, rawContent: string): OKFDocument {
  const parsed = matter(rawContent);
  const data = parsed.data || {};

  const cleanRel = relativePath.startsWith("/") ? relativePath : "/" + relativePath;

  const type = data.type || (cleanRel === "/index.md" ? "index" : cleanRel === "/log.md" ? "log" : "");
  const title = data.title || (cleanRel.replace(/\.md$/, "").split("/").pop() || "Untitled");
  const description = data.description || "";
  const status = data.status || "stable";
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  const sources: SourceRelation[] = Array.isArray(data.sources)
    ? data.sources.map((s: any) => ({
        id: s.id ? String(s.id) : undefined,
        resource: String(s.resource || ""),
        title: s.title ? String(s.title) : undefined,
      }))
    : [];

  const generated = data.generated && data.generated.by ? {
    by: String(data.generated.by),
    at: String(data.generated.at || ""),
  } : undefined;

  const verified = normalizeVerified(data.verified);
  const trust = determineTrust({ verified, generated, sources });
  const persona = typeof data.persona === "object" ? data.persona : undefined;

  // Parse temporal review state only for knowledge document types.
  const review: ReviewState | undefined = TEMPORAL_TYPES.has(type)
    ? parseReviewState(persona?.review)
    : undefined;

  return {
    path: cleanRel,
    type,
    title,
    description,
    status,
    tags,
    sources,
    generated,
    verified,
    trust,
    persona,
    review,
    frontmatter: data,
    content: parsed.content.trim(),
  };
}

export function validateDocument(doc: OKFDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (doc.path === "/index.md") {
    if (!doc.frontmatter.okf_version) {
      issues.push({ severity: "ERROR", message: "index.md missing required okf_version in frontmatter" });
    }
    if (!doc.frontmatter.persona_memory_version) {
      issues.push({ severity: "WARNING", message: "index.md missing persona_memory_version" });
    }
    if (!doc.content.includes("<!-- persona:managed-start -->") || !doc.content.includes("<!-- persona:managed-end -->")) {
      issues.push({ severity: "WARNING", message: "index.md missing managed section markers (<!-- persona:managed-start --> / <!-- persona:managed-end -->)" });
    }
    return issues;
  }

  if (doc.path === "/log.md") {
    return issues;
  }

  // Regular concept document
  if (!doc.type) {
    issues.push({ severity: "ERROR", message: "Document " + doc.path + " missing required 'type'" });
  }

  if (!doc.title) {
    issues.push({ severity: "ERROR", message: "Document " + doc.path + " missing required 'title'" });
  }

  if (!doc.description) {
    issues.push({ severity: "WARNING", message: "Document " + doc.path + " missing recommended 'description'" });
  }

  // Persona states
  const validTypes = ["heuristic", "belief", "competency", "project", "evidence", "cognitive_event"];
  if (doc.type && !validTypes.includes(doc.type)) {
    issues.push({ severity: "WARNING", message: "Document " + doc.path + " has unknown type: '" + doc.type + "'" });
  }

  // Evidence size limit is a persona-memory profile rule (§13), not OKF: warn, don't fail.
  if (doc.type === "evidence") {
    const sizeBytes = Buffer.byteLength(doc.content, "utf8");
    if (sizeBytes > 100 * 1024) {
      issues.push({ severity: "WARNING", message: "Document " + doc.path + " exceeds the 100 KB evidence profile limit (" + sizeBytes + " bytes)" });
    }
  }

  if (doc.persona && doc.persona.state) {
    const s = doc.persona.state;
    if ((doc.type === "belief" || doc.type === "heuristic") && !["current", "superseded"].includes(s)) {
      issues.push({ severity: "WARNING", message: "Unexpected persona.state '" + s + "' for " + doc.type });
    } else if (doc.type === "competency" && !["active-frontier", "consolidated", "archived"].includes(s)) {
      issues.push({ severity: "WARNING", message: "Unexpected persona.state '" + s + "' for competency" });
    } else if (doc.type === "project" && !["active", "completed", "archived"].includes(s)) {
      issues.push({ severity: "WARNING", message: "Unexpected persona.state '" + s + "' for project" });
    } else if (doc.type === "cognitive_event" && !["draft", "reviewed", "accepted", "rejected"].includes(s)) {
      issues.push({ severity: "WARNING", message: "Unexpected persona.state '" + s + "' for cognitive_event" });
    } else if (doc.type === "evidence" && !["retained", "redacted"].includes(s)) {
      issues.push({ severity: "WARNING", message: "Unexpected persona.state '" + s + "' for evidence" });
    }
  }

  // Temporal review validation (knowledge docs only)
  if (TEMPORAL_TYPES.has(doc.type)) {
    const rawReview = doc.persona?.review;
    if (!rawReview) {
      // Legacy doc: no review block at all. Conservative warning only.
      issues.push({
        severity: "WARNING",
        message: "Document " + doc.path + " has no persona.review block (legacy doc — defaults will be applied)",
      });
    } else {
      const m = rawReview.mastery;
      if (typeof m === "number" && (m < 0 || m > 5)) {
        issues.push({ severity: "ERROR", message: "Document " + doc.path + " review.mastery out of range [0,5]: " + m });
      }
      const ef = rawReview.ease_factor;
      if (typeof ef === "number" && ef < 1.3) {
        issues.push({ severity: "ERROR", message: "Document " + doc.path + " review.ease_factor below minimum 1.3: " + ef });
      }
      const id = rawReview.interval_days;
      if (typeof id === "number" && id < 1) {
        issues.push({ severity: "ERROR", message: "Document " + doc.path + " review.interval_days below minimum 1: " + id });
      }
      if (rawReview.next_review && !/^\d{4}-\d{2}-\d{2}$/.test(String(rawReview.next_review))) {
        issues.push({ severity: "WARNING", message: "Document " + doc.path + " review.next_review is not a valid YYYY-MM-DD date" });
      }
    }
  }

  return issues;
}
