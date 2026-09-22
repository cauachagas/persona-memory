import { loadAllDocuments } from "../vault/reader.js";

export interface PersonaContextOptions {
  scope?: string;
  include_history?: boolean;
}

export interface PersonaContextOutput {
  identity: {
    name: string;
    source: string;
  };
  heuristics: string[];
  current_beliefs: string[];
  active_frontiers: string[];
  relevant_constraints: string[];
  recent_events?: string[];
  historical_beliefs?: string[];
}

export function getPersonaContext(vaultRoot: string, options: PersonaContextOptions = {}): PersonaContextOutput {
  const docs = loadAllDocuments(vaultRoot);
  const includeHistory = Boolean(options.include_history);

  const heuristics: string[] = [];
  const currentBeliefs: string[] = [];
  const activeFrontiers: string[] = [];
  const relevantConstraints: string[] = [];
  const recentEvents: string[] = [];
  const historicalBeliefs: string[] = [];

  for (const doc of docs) {
    if (doc.type === "heuristic") {
      if (!doc.persona || doc.persona.state !== "superseded") {
        heuristics.push(doc.title + (doc.description ? " - " + doc.description : ""));
      }
    } else if (doc.type === "belief") {
      if (!doc.persona || doc.persona.state === "current") {
        currentBeliefs.push(doc.title + (doc.description ? " - " + doc.description : ""));
      } else if (includeHistory && doc.persona.state === "superseded") {
        historicalBeliefs.push(doc.title + " (superseded)");
      }
    } else if (doc.type === "competency") {
      if (!doc.persona || doc.persona.state === "active-frontier") {
        activeFrontiers.push(doc.title + (doc.description ? ": " + doc.description : ""));
      }
    } else if (doc.type === "cognitive_event") {
      if (includeHistory || (doc.persona && doc.persona.state === "accepted")) {
        recentEvents.push(doc.title + " [" + (doc.persona?.state || doc.status) + "]");
      }
    }
  }

  // Relevant architectural and learning constraints
  relevantConstraints.push("No unnecessary distributed infrastructure for small/medium services");
  relevantConstraints.push("Strict typing and compile-time boundary isolation");
  relevantConstraints.push("Avoid elementary tutorials for competent areas");

  const output: PersonaContextOutput = {
    identity: {
      name: "Cauã",
      source: "human:caua",
    },
    heuristics,
    current_beliefs: currentBeliefs,
    active_frontiers: activeFrontiers,
    relevant_constraints: relevantConstraints,
  };

  if (includeHistory) {
    output.recent_events = recentEvents;
    output.historical_beliefs = historicalBeliefs;
  }

  return output;
}
