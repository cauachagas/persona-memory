import { loadAllDocuments } from "../vault.js";

export interface PersonaContextOutput {
  identity: {
    name: string;
    source: string;
  };
  heuristics: string[];
  active_frontiers: string[];
  current_beliefs: string[];
}

export function getPersonaContext(vaultRoot: string): PersonaContextOutput {
  const docs = loadAllDocuments(vaultRoot);

  const heuristics: string[] = [];
  const activeFrontiers: string[] = [];
  const currentBeliefs: string[] = [];

  for (const doc of docs) {
    if (doc.type === "heuristic") {
      heuristics.push(doc.description || doc.title);
    } else if (doc.type === "competency") {
      if (doc.persona && doc.persona.state === "active-frontier") {
        activeFrontiers.push(doc.title + (doc.description ? ": " + doc.description : ""));
      }
    } else if (doc.type === "belief") {
      if (!doc.persona || doc.persona.state === "current") {
        currentBeliefs.push(doc.title + (doc.description ? ": " + doc.description : ""));
      }
    }
  }

  return {
    identity: {
      name: "Cauã",
      source: "human:caua",
    },
    heuristics,
    active_frontiers: activeFrontiers,
    current_beliefs: currentBeliefs,
  };
}
