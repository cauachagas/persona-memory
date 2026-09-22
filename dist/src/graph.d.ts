import { OKFDocument } from "./parser.js";
export interface GraphIndex {
    forwardLinks: Map<string, string[]>;
    backlinks: Map<string, string[]>;
    nodes: Map<string, OKFDocument>;
}
export declare function extractLinksFromContent(content: string, sourcePath: string): string[];
export declare function resolveLinkTarget(sourcePath: string, rawTarget: string): string | null;
export declare function buildGraph(documents: OKFDocument[]): GraphIndex;
export declare function expandOneHop(graph: GraphIndex, seedPaths: string[]): string[];
