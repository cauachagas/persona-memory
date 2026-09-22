import { ParsedActor, parseActor } from "./actor.js";
export { SourceRelation } from "./relation.js";
import { SourceRelation } from "./relation.js";

export type StandardDocumentType =
  | "heuristic"
  | "belief"
  | "competency"
  | "project"
  | "cognitive_event"
  | "evidence"
  | "index"
  | "log";

export interface VerifiedEntry {
  by: string;
  at: string;
}

export interface GeneratedEntry {
  by: string;
  at: string;
}

export interface OKFDocument {
  path: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  tags: string[];
  sources: SourceRelation[];
  generated?: GeneratedEntry;
  verified: VerifiedEntry[];
  trust: "human-reviewed" | "machine-confirmed" | "unverified";
  persona?: Record<string, any>;
  frontmatter: Record<string, any>;
  content: string;
}

export function validateDocumentCompliance(doc: OKFDocument): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (doc.path !== "index.md" && doc.path !== "log.md") {
    if (!doc.type) {
      errors.push("Document " + doc.path + " is missing required 'type' in frontmatter");
    }
  }

  // Validate persona.state if present
  if (doc.persona && doc.persona.state) {
    const state = doc.persona.state;
    if (doc.type === "belief" || doc.type === "heuristic") {
      if (!["current", "superseded"].includes(state)) {
        errors.push("Invalid persona.state '" + state + "' for type " + doc.type);
      }
    } else if (doc.type === "competency") {
      if (!["active-frontier", "consolidated", "archived"].includes(state)) {
        errors.push("Invalid persona.state '" + state + "' for type competency");
      }
    } else if (doc.type === "project") {
      if (!["active", "completed"].includes(state)) {
        errors.push("Invalid persona.state '" + state + "' for type project");
      }
    } else if (doc.type === "cognitive_event") {
      if (!["draft", "reviewed", "accepted", "rejected"].includes(state)) {
        errors.push("Invalid persona.state '" + state + "' for type cognitive_event");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
