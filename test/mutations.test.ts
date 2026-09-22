import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recordCognitiveEvent } from "../src/mutations.js";
import { readDocument } from "../src/vault.js";

const execAsync = promisify(execFile);

test("mutations: records cognitive event with status draft, preserves user index and updates log", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-test-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(
    path.join(tempVault, "index.md"),
    "---\nokf_version: \"0.2\"\npersona_memory_version: \"0.1\"\n---\n\n# User Title\nUser personal notes.\n<!-- persona:managed-start -->\n<!-- persona:managed-end -->\nUser footer notes.\n",
    "utf8"
  );

  const initialBelief = `---
type: belief
title: Monolito
description: Preferência por monólito
persona:
  state: current
---
Crença original inalterada.
`;
  fs.writeFileSync(path.join(tempVault, "beliefs/monolito.md"), initialBelief, "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  const result = await recordCognitiveEvent(tempVault, {
    title: "Observacao sobre microservicos",
    description: "Revisão dos custos de latência de rede",
    event_kind: "belief_change",
    summary: "Overhead de latencia observado.",
    details: "40ms por chamada de rede.",
    target: "/beliefs/monolito.md",
    related_paths: ["/beliefs/monolito.md"],
    producer: "antigravity/gemini-3-pro",
  });

  assert.equal(result.status, "draft");
  assert.equal(result.state, "draft");

  // Verify belief was NOT modified automatically
  const beliefAfter = fs.readFileSync(path.join(tempVault, "beliefs/monolito.md"), "utf8");
  assert.equal(beliefAfter, initialBelief);

  // Verify user notes preserved in index.md
  const indexAfter = fs.readFileSync(path.join(tempVault, "index.md"), "utf8");
  assert.ok(indexAfter.includes("User personal notes."));
  assert.ok(indexAfter.includes("User footer notes."));
  assert.ok(indexAfter.includes("Observacao sobre microservicos"));

  // Verify log.md updated
  const logAfter = fs.readFileSync(path.join(tempVault, "log.md"), "utf8");
  assert.ok(logAfter.includes("Created"));

  // Verify clean git status
  const { stdout } = await execAsync("git", ["status", "--porcelain"], { cwd: tempVault });
  assert.equal(stdout.trim(), "");

  fs.rmSync(tempVault, { recursive: true, force: true });
});

test("mutations: aborts with VAULT_DIRTY when working tree has uncommitted changes", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-dirty-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(path.join(tempVault, "index.md"), "# Index\n", "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  // Make working tree dirty
  fs.writeFileSync(path.join(tempVault, "dirty.txt"), "uncommitted", "utf8");

  await assert.rejects(
    async () => {
      await recordCognitiveEvent(tempVault, {
        title: "Test",
        description: "Test",
        event_kind: "learning_observation",
        summary: "test",
        details: "test",
      });
    },
    /VAULT_DIRTY/
  );

  fs.rmSync(tempVault, { recursive: true, force: true });
});
