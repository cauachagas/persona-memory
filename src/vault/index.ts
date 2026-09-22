import fs from "node:fs";
import path from "node:path";
import { OKFDocument } from "../domain/document.js";
import { loadAllDocuments } from "./reader.js";

export function generateIndexContent(documents: OKFDocument[]): string {
  const heuristics = documents.filter((d) => d.type === "heuristic");
  const beliefs = documents.filter((d) => d.type === "belief");
  const competencies = documents.filter((d) => d.type === "competency");
  const projects = documents.filter((d) => d.type === "project");
  const events = documents.filter((d) => d.type === "cognitive_event");

  let md = "---\nokf_version: \"0.2\"\n---\n\n# Persona Memory Vault\n";

  md += "\n## Heuristics\n\n";
  for (const h of heuristics) {
    md += "* [" + h.title + "](" + h.path + ") - " + (h.description || "") + "\n";
  }

  md += "\n## Beliefs\n\n";
  for (const b of beliefs) {
    md += "* [" + b.title + "](" + b.path + ") - " + (b.description || "") + "\n";
  }

  md += "\n## Competencies\n\n";
  for (const c of competencies) {
    md += "* [" + c.title + "](" + c.path + ") - " + (c.description || "") + "\n";
  }

  md += "\n## Projects\n\n";
  for (const p of projects) {
    md += "* [" + p.title + "](" + p.path + ") - " + (p.description || "") + "\n";
  }

  if (events.length > 0) {
    md += "\n## Recent Events\n\n";
    for (const e of events.slice(0, 10)) {
      md += "* [" + e.title + "](" + e.path + ") - " + (e.description || "") + "\n";
    }
  }

  return md;
}

export function updateVaultIndex(vaultRoot: string): void {
  const docs = loadAllDocuments(vaultRoot);
  const newContent = generateIndexContent(docs);
  fs.writeFileSync(path.join(vaultRoot, "index.md"), newContent, "utf8");
}
