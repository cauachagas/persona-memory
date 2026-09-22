import matter from "gray-matter";
export function normalizeVerified(rawVerified) {
    if (!rawVerified)
        return [];
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
export function determineTrust(verified) {
    if (verified.length === 0)
        return "unverified";
    if (verified.some((v) => v.by.startsWith("human:")))
        return "human-reviewed";
    if (verified.some((v) => v.by.startsWith("process:") || v.by.startsWith("agent:")))
        return "machine-confirmed";
    return "unverified";
}
export function parseDocument(relativePath, rawContent) {
    const parsed = matter(rawContent);
    const data = parsed.data || {};
    const type = data.type || (relativePath === "index.md" ? "index" : relativePath === "log.md" ? "log" : "");
    const title = data.title || (relativePath.replace(/\.md$/, "").split("/").pop() || "Untitled");
    const description = data.description || "";
    const status = data.status || "stable";
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const sources = Array.isArray(data.sources)
        ? data.sources.map((s) => ({
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
export function validateDocument(doc) {
    const errors = [];
    if (doc.path !== "index.md" && doc.path !== "log.md") {
        if (!doc.type) {
            errors.push("Document " + doc.path + " is missing required 'type' in frontmatter");
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
