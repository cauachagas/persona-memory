#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getConfig } from "./config.js";
import { runServer } from "./server.js";
import { loadAllDocuments } from "./vault/reader.js";
import { validateDocumentCompliance } from "./domain/document.js";
import { searchTrajectory } from "./tools/search.js";

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
        const { valid, errors } = validateDocumentCompliance(doc);
        if (!valid) {
          totalErrors += errors.length;
          console.error("  ❌ " + doc.path + ":", errors.join(", "));
        } else {
          console.log("  ✅ " + doc.path + " (" + doc.type + ", trust: " + doc.trust + ", state: " + (doc.persona?.state || "n/a") + ")");
        }
      }

      if (totalErrors > 0) {
        console.error("\nValidation failed with " + totalErrors + " error(s).");
        process.exit(1);
      } else {
        console.log("\nValidation passed! All " + docs.length + " documents conform to OKF v0.2 + Persona Profile.");
      }
      break;
    }

    case "doctor": {
      console.log("Running persona-memory doctor diagnostics...");
      console.log("  • Vault path:", config.vaultPath);

      // Check Git
      try {
        const gitVer = execSync("git --version", { encoding: "utf8" }).trim();
        console.log("  ✅ Git installed:", gitVer);
      } catch {
        console.error("  ❌ Git not found in PATH");
      }

      // Check Git config
      try {
        const name = execSync("git config user.name", { encoding: "utf8" }).trim();
        const email = execSync("git config user.email", { encoding: "utf8" }).trim();
        console.log("  ✅ Git user:", name + " <" + email + ">");
      } catch {
        console.warn("  ⚠️ Git user.name or user.email not configured");
      }

      // Check vault exists & is repo
      if (fs.existsSync(config.vaultPath)) {
        console.log("  ✅ Vault directory exists");
        if (fs.existsSync(path.join(config.vaultPath, ".git"))) {
          console.log("  ✅ Vault is a Git repository");
          try {
            const status = execSync("git status --porcelain", { cwd: config.vaultPath, encoding: "utf8" }).trim();
            if (!status) {
              console.log("  ✅ Vault working tree is clean");
            } else {
              console.log("  ⚠️ Vault has uncommitted changes:\n" + status);
            }
          } catch (e: any) {
            console.error("  ❌ Failed to check git status:", e.message);
          }
        } else {
          console.error("  ❌ Vault is not a Git repository. Run 'git init' in " + config.vaultPath);
        }
      } else {
        console.error("  ❌ Vault directory does not exist at:", config.vaultPath);
      }

      console.log("\nDoctor check finished.");
      break;
    }

    case "search": {
      const query = args[1];
      if (!query || query.startsWith("--")) {
        console.error("Usage: persona-memory search <query> [--vault <path>]");
        process.exit(1);
      }
      const { results, totalChars } = searchTrajectory(config.vaultPath, query);
      console.log("Trajectory search results for '" + query + "' (Context Budget: " + totalChars + " chars):\n");
      for (const r of results) {
        console.log("• [" + r.type + "] " + r.title + " (" + r.path + ") - Score: " + r.score);
        console.log("  Trust: " + r.trust + " | Matched by: " + r.matched_by.join(", "));
        console.log("  Snippet: " + r.snippet + "\n");
      }
      break;
    }

    case "init": {
      console.log("Initializing OKF vault at:", config.vaultPath);
      const dirs = ["heuristics", "beliefs", "competencies", "projects", "events", "evidence"];
      fs.mkdirSync(config.vaultPath, { recursive: true });
      for (const d of dirs) {
        fs.mkdirSync(path.join(config.vaultPath, d), { recursive: true });
      }
      fs.writeFileSync(path.join(config.vaultPath, "evidence/.gitkeep"), "", "utf8");

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
      console.log("  persona-memory serve [--vault <path>]     Start the MCP server (stdio)");
      console.log("  persona-memory validate [--vault <path>]  Validate vault OKF v0.2 + Persona compliance");
      console.log("  persona-memory doctor [--vault <path>]    Check system, Git, and vault health");
      console.log("  persona-memory search <query>             Search trajectory with context budget");
      console.log("  persona-memory init [--vault <path>]      Initialize a new vault");
      break;
    }
  }
}

main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
