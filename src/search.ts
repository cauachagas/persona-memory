import { OKFDocument } from "./parser.js";
import { buildGraph, expandOneHop } from "./graph.js";

export interface SearchResult {
  path: string;
  type: string;
  title: string;
  status: string;
  trust: "human-reviewed" | "machine-confirmed" | "unverified";
  matched_by: string[];
  snippet: string;
  score: number;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
  expand_graph?: boolean;
}

export function extractSnippet(content: string, queryTokens: string[], maxLength = 200): string {
  const lowerContent = content.toLowerCase();
  let firstIndex = -1;

  for (const token of queryTokens) {
    const idx = lowerContent.indexOf(token.toLowerCase());
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    return content.slice(0, maxLength).replace(/\s+/g, " ").trim() + (content.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, firstIndex - 60);
  const end = Math.min(content.length, firstIndex + maxLength - 60);
  let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();

  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

export function searchDocuments(
  documents: OKFDocument[],
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { types, limit = 5, expand_graph = true } = options;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 0);
  const graph = buildGraph(documents);

  const scores = new Map<string, { score: number; matchedBy: Set<string>; doc: OKFDocument }>();

  for (const doc of documents) {
    if (types && types.length > 0 && !types.includes(doc.type)) {
      continue;
    }

    let docScore = 0;
    const matchedBy = new Set<string>();

    const lowerTitle = doc.title.toLowerCase();
    const lowerDesc = (doc.description || "").toLowerCase();
    const lowerTags = doc.tags.map((t) => t.toLowerCase());
    const lowerContent = doc.content.toLowerCase();

    // 1. Exact title match
    if (lowerTitle === cleanQuery) {
      docScore += 100;
      matchedBy.add("exact_title");
    } else if (tokens.every((t) => lowerTitle.includes(t))) {
      docScore += 60;
      matchedBy.add("title");
    } else if (tokens.some((t) => lowerTitle.includes(t))) {
      docScore += 30;
      matchedBy.add("title_partial");
    }

    // 2. Tag match
    if (lowerTags.includes(cleanQuery)) {
      docScore += 80;
      matchedBy.add("exact_tag");
    } else if (tokens.some((t) => lowerTags.some((tag) => tag.includes(t)))) {
      docScore += 40;
      matchedBy.add("tag");
    }

    // 3. Description match
    if (lowerDesc && tokens.some((t) => lowerDesc.includes(t))) {
      docScore += 35;
      matchedBy.add("description");
    }

    // 4. Type match
    if (doc.type.toLowerCase().includes(cleanQuery)) {
      docScore += 25;
      matchedBy.add("type");
    }

    // 5. Body match
    if (tokens.some((t) => lowerContent.includes(t))) {
      const matchCount = tokens.filter((t) => lowerContent.includes(t)).length;
      docScore += 15 * matchCount;
      matchedBy.add("body");
    }

    if (docScore > 0) {
      scores.set(doc.path, { score: docScore, matchedBy, doc });
    }
  }

  // Graph expansion: 1-hop
  if (expand_graph && scores.size > 0) {
    const sortedSeeds = Array.from(scores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3)
      .map(([p]) => p);

    const expandedPaths = expandOneHop(graph, sortedSeeds);

    for (const expPath of expandedPaths) {
      if (!scores.has(expPath)) {
        const expDoc = graph.nodes.get(expPath);
        if (expDoc) {
          if (types && types.length > 0 && !types.includes(expDoc.type)) {
            continue;
          }
          scores.set(expPath, {
            score: 15,
            matchedBy: new Set(["graph_connected"]),
            doc: expDoc,
          });
        }
      }
    }
  }

  const results: SearchResult[] = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, matchedBy, doc }) => ({
      path: doc.path,
      type: doc.type,
      title: doc.title,
      status: doc.status,
      trust: doc.trust,
      matched_by: Array.from(matchedBy),
      snippet: extractSnippet(doc.content, tokens),
      score,
    }));

  return results;
}
