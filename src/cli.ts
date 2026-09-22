#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./config.js";
import { runServer } from "./server.js";
import { loadAllDocuments, getAllDocumentPaths } from "./vault.js";
import { validateDocument } from "./parser.js";
import { searchDocuments } from "./search.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "serve";

  let vaultArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vault" && i + 1 < args.length) {
      vaultArg = args[i + 1];
    }
  }

  const config = getConfig(vaultArg);

  switch (command) {
    case "serve": {
      await runServer(vaultArg);
      break;
    }

    case "validate": {
      console.log("Validating vault at:", config.vaultPath);
      if (!fs.existsSync(config.vaultPath)) {
        console.error("Error: Vault directory does not exist:", config.vaultPath);
        process.exit(1);
      }

      const docs = loadAllDocuments(config.vaultPath);
      let totalErrors = 0;

      for (const doc of docs) {
        const { valid, errors } = validateDocument(doc);
        if (!valid) {
          totalErrors += errors.length;
          console.error("  ❌ " + doc.path + ":", errors.join(", "));
        } else {
          console.log("  ✅ " + doc.path + " (" + doc.type + ", trust: " + doc.trust + ")");
        }
      }

      if (totalErrors > 0) {
        console.error("\nValidation failed with " + totalErrors + " error(s).");
        process.exit(1);
      } else {
        console.log("\nValidation passed! All " + docs.length + " documents conform to OKF v0.2.");
      }
      break;
    }

    case "search": {
      const query = args[1];
      if (!query || query.startsWith("--")) {
        console.error("Usage: persona-memory search <query> [--vault <path>]");
        process.exit(1);
      }
      const docs = loadAllDocuments(config.vaultPath);
      const results = searchDocuments(docs, query);
      console.log("Search results for '" + query + "':\n");
      for (const r of results) {
        console.log("• [" + r.type + "] " + r.title + " (" + r.path + ") - Score: " + r.score);
        console.log("  Trust: " + r.trust + " | Matched by: " + r.matched_by.join(", "));
        console.log("  Snippet: " + r.snippet + "\n");
      }
      break;
    }

    case "init": {
      console.log("Initializing OKF vault at:", config.vaultPath);
      const dirs = ["heuristics", "beliefs", "competencies", "projects", "goals", "events", "evidence"];
      fs.mkdirSync(config.vaultPath, { recursive: true });
      for (const d of dirs) {
        fs.mkdirSync(path.join(config.vaultPath, d), { recursive: true });
      }
      const indexFile = path.join(config.vaultPath, "index.md");
      if (!fs.existsSync(indexFile)) {
        fs.writeFileSync(indexFile, "---\nokf_version: \"0.2\"\n---\n\n# Persona Memory Vault\n", "utf8");
      }
      const logFile = path.join(config.vaultPath, "log.md");
      if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, "# Mutation Log\n", "utf8");
      }
      console.log("Vault initialized successfully.");
      break;
    }

    default: {
      console.log("persona-memory CLI v0.1.0\n");
      console.log("Available commands:");
      console.log("  persona-memory serve [--vault <path>]    Start the MCP server (stdio)");
      console.log("  persona-memory validate [--vault <path>] Validate vault OKF v0.2 compliance");
      console.log("  persona-memory search <query>            Search memory documents");
      console.log("  persona-memory init [--vault <path>]     Initialize a new vault");
      break;
    }
  }
}

main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
