import matter from "gray-matter";
import { OKFDocument, VerifiedEntry, SourceRelation } from "../domain/document.js";
import { isHuman } from "../domain/actor.js";

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

export function determineTrust(verified: VerifiedEntry[]): "human-reviewed" | "machine-confirmed" | "unverified" {
  if (verified.length === 0) return "unverified";
  if (verified.some((v) => isHuman(v.by))) return "human-reviewed";
  if (verified.some((v) => v.by.startsWith("process:") || v.by.startsWith("agent:") || v.by.includes("/"))) {
    return "machine-confirmed";
  }
  return "unverified";
}

export function parseDocument(relativePath: string, rawContent: string): OKFDocument {
  const parsed = matter(rawContent);
  const data = parsed.data || {};

  const type = data.type || (relativePath === "index.md" ? "index" : relativePath === "log.md" ? "log" : "");
  const title = data.title || (relativePath.replace(/\.md$/, "").split("/").pop() || "Untitled");
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
  const trust = determineTrust(verified);
  const persona = typeof data.persona === "object" ? data.persona : undefined;

  return {
    path: relativePath,
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
