import { loadAllDocuments } from "../vault.js";
export function getPersonaContext(vaultRoot) {
    const docs = loadAllDocuments(vaultRoot);
    const heuristics = [];
    const activeFrontiers = [];
    const currentBeliefs = [];
    for (const doc of docs) {
        if (doc.type === "heuristic") {
            heuristics.push(doc.description || doc.title);
        }
        else if (doc.type === "competency") {
            if (doc.persona && doc.persona.state === "active-frontier") {
                activeFrontiers.push(doc.title + (doc.description ? ": " + doc.description : ""));
            }
        }
        else if (doc.type === "belief") {
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
