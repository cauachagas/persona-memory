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

test("mutations: records cognitive event with status draft and atomic git commit", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-test-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  const result = await recordCognitiveEvent(tempVault, {
    title: "Reavaliação de Microserviços",
    event_kind: "belief_change",
    summary: "Observação de latência excessiva em experimentos de rede.",
    details: "Durante os benchmarks, identificamos 40ms de overhead por salto.",
    related_paths: ["beliefs/modular-monolith.md"],
    target: "beliefs/modular-monolith.md",
    proposed_state: "current",
  });

  assert.equal(result.status, "draft");
  assert.match(result.eventPath, /^events\/\d{4}-\d{2}-\d{2}-reavaliacao-de-microservicos.*\.md$/);

  const eventDoc = readDocument(tempVault, result.eventPath);
  assert.equal(eventDoc.type, "cognitive_event");
  assert.equal(eventDoc.status, "draft");
  assert.equal(eventDoc.persona?.event_kind, "belief_change");

  // Verify log.md updated
  const logContent = fs.readFileSync(path.join(tempVault, "log.md"), "utf8");
  assert.match(logContent, /Reavaliação de Microserviços/);

  // Verify clean worktree after commit
  const { stdout } = await execAsync("git", ["status", "--porcelain"], { cwd: tempVault });
  assert.equal(stdout.trim(), "");

  // Cleanup
  fs.rmSync(tempVault, { recursive: true, force: true });
});

test("mutations: rejects when worktree has pre-staged files", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-staged-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  // Stage a file manually
  fs.writeFileSync(path.join(tempVault, "user-staged.txt"), "hello", "utf8");
  await execAsync("git", ["add", "user-staged.txt"], { cwd: tempVault });

  await assert.rejects(
    async () => {
      await recordCognitiveEvent(tempVault, {
        title: "Test Event",
        event_kind: "learning",
        summary: "test",
        details: "test",
      });
    },
    /pre-existing staged changes/
  );

  fs.rmSync(tempVault, { recursive: true, force: true });
});
