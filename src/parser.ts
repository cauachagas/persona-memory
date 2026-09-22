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
    }
  }

  return issues;
}
