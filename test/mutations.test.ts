import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recordCognitiveEvent, recordReviewEvent } from "../src/mutations.js";
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

test("mutations: concurrent recordReviewEvent calls are serialized by lock", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-concurrency-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(
    path.join(tempVault, "index.md"),
    "---\nokf_version: \"0.2\"\npersona_memory_version: \"0.1\"\n---\n# Index\n<!-- persona:managed-start -->\n<!-- persona:managed-end -->\n",
    "utf8"
  );

  const initialBelief = `---
type: belief
title: Concurrency Test
description: Test serialization
status: stable
persona:
  state: current
  review:
    mastery: 2
    ease_factor: 2.5
    interval_days: 1
    next_review: "2026-09-26"
    review_count: 0
    last_review: null
    review_history: []
---
Concurrent review test.
`;
  fs.writeFileSync(path.join(tempVault, "beliefs/concurrency.md"), initialBelief, "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  // Trigger two concurrent reviews on the same document
  const results = await Promise.all([
    recordReviewEvent(tempVault, {
      target: "/beliefs/concurrency.md",
      outcome: "good",
      summary: "Review 1",
    }),
    recordReviewEvent(tempVault, {
      target: "/beliefs/concurrency.md",
      outcome: "easy",
      summary: "Review 2",
    }),
  ]);

  assert.equal(results.length, 2);
  assert.ok(results[0].commitHash);
  assert.ok(results[1].commitHash);

  // Verify the document has both reviews serialized
  const docAfter = readDocument(tempVault, "/beliefs/concurrency.md");
  assert.equal(docAfter.review?.review_count, 2);
  assert.equal(docAfter.review?.review_history.length, 2);

  // Verify git status is clean
  const { stdout } = await execAsync("git", ["status", "--porcelain"], { cwd: tempVault });
  assert.equal(stdout.trim(), "");

  fs.rmSync(tempVault, { recursive: true, force: true });
});

test("mutations: recordReviewEvent rolls back target doc, index, and log when git commit fails", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-rollback-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(
    path.join(tempVault, "index.md"),
    "---\nokf_version: \"0.2\"\npersona_memory_version: \"0.1\"\n---\n# Index\n<!-- persona:managed-start -->\n<!-- persona:managed-end -->\n",
    "utf8"
  );

  const initialBelief = `---
type: belief
title: Rollback Test
description: Test failure recovery
status: stable
persona:
  state: current
  review:
    mastery: 2
    ease_factor: 2.5
    interval_days: 1
    next_review: "2026-09-26"
    review_count: 0
    last_review: null
    review_history: []
---
Rollback target content.
`;
  fs.writeFileSync(path.join(tempVault, "beliefs/rollback.md"), initialBelief, "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  // Install real git pre-commit hook that always fails
  const hooksDir = path.join(tempVault, ".git", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, "pre-commit");
  fs.writeFileSync(hookPath, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

  // Attempting recordReviewEvent must fail due to git pre-commit rejection
  await assert.rejects(async () => {
    await recordReviewEvent(tempVault, {
      target: "/beliefs/rollback.md",
      outcome: "good",
      summary: "This review should be rolled back",
    });
  });

  // Verify target document content was restored to initial state
  const targetContentAfter = fs.readFileSync(path.join(tempVault, "beliefs/rollback.md"), "utf8");
  assert.equal(targetContentAfter, initialBelief);

  // Verify no orphaned event was left in /events/
  const eventFiles = fs.readdirSync(path.join(tempVault, "events")).filter((f) => f.endsWith(".md"));
  assert.equal(eventFiles.length, 0);

  // Remove hook and verify git working tree is clean
  fs.unlinkSync(hookPath);
  const { stdout } = await execAsync("git", ["status", "--porcelain"], { cwd: tempVault });
  assert.equal(stdout.trim(), "");

  fs.rmSync(tempVault, { recursive: true, force: true });
});
