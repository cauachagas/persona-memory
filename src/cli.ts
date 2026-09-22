#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getConfig } from "./config.js";
import { runServer } from "./server.js";
import { loadAllDocuments } from "./vault.js";
import { validateDocument } from "./parser.js";
import { searchMemory } from "./search.js";
import { updateManagedIndex } from "./mutations.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "serve";

  let vaultArg: string | undefined;
  let producerArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vault" && i + 1 < args.length) {
      vaultArg = args[i + 1];
    }
    if (args[i] === "--producer" && i + 1 < args.length) {
      producerArg = args[i + 1];
    }
  }

  const config = getConfig(vaultArg, producerArg);

  switch (command) {
    case "serve": {
      await runServer(vaultArg, producerArg);
      break;
    }

    case "validate": {
      console.log("Validating vault at: " + config.vaultPath);
      if (!fs.existsSync(config.vaultPath)) {
        console.error("[ERROR] Vault directory does not exist: " + config.vaultPath);
        process.exit(1);
      }

      const docs = loadAllDocuments(config.vaultPath);
      let errorsCount = 0;
      let warningsCount = 0;

      for (const doc of docs) {
        const issues = validateDocument(doc);
        for (const issue of issues) {
          if (issue.severity === "ERROR") {
            errorsCount++;
            console.error("  [ERROR] " + doc.path + ": " + issue.message);
          } else {
            warningsCount++;
            console.warn("  [WARNING] " + doc.path + ": " + issue.message);
          }
        }
        if (issues.filter((i) => i.severity === "ERROR").length === 0) {
          console.log("  [OK] " + doc.path + " (" + doc.type + ", trust: " + doc.trust + ")");
        }
      }

      console.log("\nValidation finished: " + docs.length + " documents, " + errorsCount + " errors, " + warningsCount + " warnings.");
      if (errorsCount > 0) {
        process.exit(1);
      }
      break;
    }

    case "doctor": {
      console.log("Running persona-memory doctor diagnostics...");
      console.log("  • Vault path: " + config.vaultPath);
      console.log("  • Producer: " + config.producer);

      // Node check
      console.log("  ✅ Node runtime: " + process.version);

      // Git check
      try {
        const gitVer = execSync("git --version", { encoding: "utf8" }).trim();
        console.log("  ✅ Git installed: " + gitVer);
      } catch {
        console.error("  ❌ Git not found in PATH");
      }

      // Git user check
      try {
        const name = execSync("git config user.name", { encoding: "utf8" }).trim();
        const email = execSync("git config user.email", { encoding: "utf8" }).trim();
        console.log("  ✅ Git user: " + name + " <" + email + ">");
      } catch {
        console.warn("  ⚠️ Git user.name or user.email not configured");
      }

      // Vault existence and git status
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
            console.error("  ❌ Failed to check git status: " + e.message);
          }
        } else {
          console.error("  ❌ Vault is not a Git repository. Run 'git init' in " + config.vaultPath);
        }
      } else {
        console.error("  ❌ Vault directory does not exist at: " + config.vaultPath);
      }

      console.log("\nDoctor check complete.");
      break;
    }

    case "search": {
      const query = args[1];
      if (!query || query.startsWith("--")) {
        console.error("Usage: persona-memory search <query> [--vault <path>]");
        process.exit(1);
      }
      const { results, totalChars } = searchMemory(config.vaultPath, query);
      console.log("Search results for '" + query + "' (Context Budget: " + totalChars + " chars):\n");
      for (const r of results) {
        console.log("• [" + r.type + "] " + r.title + " (" + r.path + ") - Score: " + r.score);
        console.log("  Trust: " + r.trust + " | Matched by: " + r.matched_by.join(", "));
        console.log("  Snippet: " + r.snippet + "\n");
      }
      break;
    }

    case "index": {
      console.log("Regenerating managed index in " + config.vaultPath + "...");
      updateManagedIndex(config.vaultPath);
      console.log("index.md managed section successfully updated.");
      break;
    }

    case "init": {
      console.log("Initializing OKF vault at: " + config.vaultPath);
      const dirs = ["heuristics", "beliefs", "competencies", "projects", "events", "evidence"];
      fs.mkdirSync(config.vaultPath, { recursive: true });
      for (const d of dirs) {
        fs.mkdirSync(path.join(config.vaultPath, d), { recursive: true });
      }
      fs.writeFileSync(path.join(config.vaultPath, "evidence/.gitkeep"), "", "utf8");

      const indexFile = path.join(config.vaultPath, "index.md");
      if (!fs.existsSync(indexFile)) {
        fs.writeFileSync(
          indexFile,
          "---\nokf_version: \"0.2\"\npersona_memory_version: \"0.1\"\n---\n\n# Persona Memory\n\n<!-- persona:managed-start -->\n<!-- persona:managed-end -->\n",
          "utf8"
        );
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
      console.log("  persona-memory serve [--vault <p>] [--producer <id>]  Start MCP stdio server");
      console.log("  persona-memory validate [--vault <p>]                 Validate OKF v0.2 + Persona profile");
      console.log("  persona-memory doctor [--vault <p>]                   Run diagnostics (Git, Vault, Producer)");
      console.log("  persona-memory search <query> [--vault <p>]           Search memory with context budget");
      console.log("  persona-memory index [--vault <p>]                    Regenerate index.md managed section");
      console.log("  persona-memory init [--vault <p>]                     Initialize a new vault");
      break;
    }
  }
}

main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
