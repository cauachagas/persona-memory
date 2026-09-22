import { OKFDocument } from "./parser.js";
import { loadAllDocuments } from "./vault.js";
import { buildGraph, expandOneHop } from "./graph.js";

export interface SearchResult {
  path: string;
  type: string;
  title: string;
  description: string;
  score: number;
  matched_by: string[];
  snippet: string;
  trust: "human-verified" | "source-backed" | "agent-generated" | "unverified";
}

export interface SearchMemoryOptions {
  types?: string[];
  limit?: number;
  expand_graph?: boolean;
  max_chars?: number;
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

export function searchMemory(
  vaultRoot: string,
  query: string,
  options: SearchMemoryOptions = {}
): { results: SearchResult[]; totalChars: number } {
  const { types, limit = 5, expand_graph = true, max_chars = 8000 } = options;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return { results: [], totalChars: 0 };

  const documents = loadAllDocuments(vaultRoot);
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
      matchedBy.add("title");
    } else if (tokens.every((t) => lowerTitle.includes(t))) {
      docScore += 60;
      matchedBy.add("title");
    } else if (tokens.some((t) => lowerTitle.includes(t))) {
      docScore += 30;
      matchedBy.add("title");
    }

    // 2. Tag match
    if (lowerTags.includes(cleanQuery)) {
      docScore += 80;
      matchedBy.add("tag");
    } else if (tokens.some((t) => lowerTags.some((tag) => tag.includes(t)))) {
      docScore += 40;
      matchedBy.add("tag");
    }

    // 3. Description match
    if (lowerDesc && tokens.some((t) => lowerDesc.includes(t))) {
      docScore += 35;
      matchedBy.add("description");
    }

    // 4. Body match
    if (tokens.some((t) => lowerContent.includes(t))) {
      const matchCount = tokens.filter((t) => lowerContent.includes(t)).length;
      docScore += 15 * matchCount;
      matchedBy.add("body");
    }

    if (docScore > 0) {
      scores.set(doc.path, { score: docScore, matchedBy, doc });
    }
  }

  // 1-Hop Graph expansion
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
            matchedBy: new Set(["linked_documents"]),
            doc: expDoc,
          });
        }
      }
    }
  }

  const sortedResults = Array.from(scores.values()).sort((a, b) => b.score - a.score);

  const finalResults: SearchResult[] = [];
  let accumulatedChars = 0;

  for (const { score, matchedBy, doc } of sortedResults) {
    if (finalResults.length >= limit) break;

    const snippet = extractSnippet(doc.content, tokens);
    const itemChars = doc.path.length + doc.title.length + doc.description.length + snippet.length + 80;

    if (accumulatedChars + itemChars > max_chars && finalResults.length > 0) {
      break;
    }

    accumulatedChars += itemChars;
    finalResults.push({
      path: doc.path,
      type: doc.type,
      title: doc.title,
      description: doc.description,
      score: Number((score / 100).toFixed(2)),
      matched_by: Array.from(matchedBy),
      snippet,
      trust: doc.trust,
    });
  }

  return { results: finalResults, totalChars: accumulatedChars };
}
