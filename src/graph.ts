import path from "node:path";
import { OKFDocument } from "./parser.js";

export interface GraphIndex {
  forwardLinks: Map<string, string[]>;
  backlinks: Map<string, string[]>;
  nodes: Map<string, OKFDocument>;
}

export function extractLinksFromContent(content: string, sourcePath: string): string[] {
  const links: string[] = [];

  // 1. Standard Markdown links: [Text](target)
  const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    if (!rawTarget.startsWith("http://") && !rawTarget.startsWith("https://") && !rawTarget.startsWith("#")) {
      const resolved = resolveLinkTarget(sourcePath, rawTarget);
      if (resolved && !links.includes(resolved)) {
        links.push(resolved);
      }
    }
  }

  // 2. Obsidian wiki links: [[target]] or [[target|label]] or [[target#heading]]
  const wikiLinkRegex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    let rawTarget = match[1].trim();
    if (!rawTarget.endsWith(".md")) {
      rawTarget += ".md";
    }
    const resolved = resolveLinkTarget(sourcePath, rawTarget);
    if (resolved && !links.includes(resolved)) {
      links.push(resolved);
    }
  }

  return links;
}

export function resolveLinkTarget(sourcePath: string, rawTarget: string): string | null {
  const cleanTarget = rawTarget.split("#")[0].split("?")[0].trim();
  if (!cleanTarget) return null;

  let normalized = cleanTarget.startsWith("/") ? cleanTarget : "/" + cleanTarget;
  if (!normalized.endsWith(".md")) {
    normalized += ".md";
  }

  return normalized.replace(/\\/g, "/");
}

export function buildGraph(documents: OKFDocument[]): GraphIndex {
  const forwardLinks = new Map<string, string[]>();
  const backlinks = new Map<string, string[]>();
  const nodes = new Map<string, OKFDocument>();

  for (const doc of documents) {
    nodes.set(doc.path, doc);
    const links = extractLinksFromContent(doc.content, doc.path);

    if (doc.sources && Array.isArray(doc.sources)) {
      for (const s of doc.sources) {
        if (s.resource) {
          const resolved = resolveLinkTarget(doc.path, s.resource);
          if (resolved && !links.includes(resolved)) {
            links.push(resolved);
          }
        }
      }
    }

    forwardLinks.set(doc.path, links);

    for (const target of links) {
      if (!backlinks.has(target)) {
        backlinks.set(target, []);
      }
      backlinks.get(target)!.push(doc.path);
    }
  }

  return { forwardLinks, backlinks, nodes };
}

export function expandOneHop(graph: GraphIndex, seedPaths: string[]): string[] {
  const expanded = new Set<string>(seedPaths);

  for (const p of seedPaths) {
    const targets = graph.forwardLinks.get(p) || [];
    for (const t of targets) {
      if (graph.nodes.has(t)) {
        expanded.add(t);
      }
    }

    const sources = graph.backlinks.get(p) || [];
    for (const s of sources) {
      if (graph.nodes.has(s)) {
        expanded.add(s);
      }
    }
  }

  return Array.from(expanded);
}
