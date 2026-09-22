import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recordCognitiveEvent } from "../src/mutations/event.js";
import { recordEvidence, redactSensitiveData } from "../src/mutations/evidence.js";
import { readDocument } from "../src/vault/reader.js";

const execAsync = promisify(execFile);

test("mutations: records cognitive event with status draft without modifying beliefs", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-vault-test-"));
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(path.join(tempVault, "index.md"), "# Index\n", "utf8");

  // Existing belief
  const initialBelief = `---
type: belief
title: Monolito
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
    event_kind: "belief_change",
    summary: "Overhead de latencia observado.",
    details: "40ms por chamada de rede.",
    related_paths: ["beliefs/monolito.md"],
    target: "beliefs/monolito.md",
    source_producer: "antigravity/gemini-3-pro",
  });

  assert.equal(result.status, "draft");
  assert.equal(result.state, "draft");

  // Verify belief was NOT mutated automatically!
  const beliefContentAfter = fs.readFileSync(path.join(tempVault, "beliefs/monolito.md"), "utf8");
  assert.equal(beliefContentAfter, initialBelief);

  const eventDoc = readDocument(tempVault, result.eventPath);
  assert.equal(eventDoc.type, "cognitive_event");
  assert.equal(eventDoc.generated?.by, "antigravity/gemini-3-pro");

  fs.rmSync(tempVault, { recursive: true, force: true });
});

test("mutations: records evidence with secret redaction and 100KB guard", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-evidence-test-"));
  fs.mkdirSync(path.join(tempVault, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: init"], { cwd: tempVault });

  // Test redaction
  const leakText = "My key is AIzaSyD3x92018239012389102381923810293 and secret token";
  const { cleaned, redactedCount } = redactSensitiveData(leakText);
  assert.equal(redactedCount, 1);
  assert.ok(cleaned.includes("[REDACTED_SECRET]"));

  // Record evidence
  const res = await recordEvidence(tempVault, {
    title: "Benchmark Latencia",
    content: "Resultados com chave AIzaSyD3x92018239012389102381923810293: 12ms",
    source_producer: "opencode/gpt-5-codex",
  });

  const evDoc = readDocument(tempVault, res.evidencePath);
  assert.equal(evDoc.type, "evidence");
  assert.ok(evDoc.content.includes("[REDACTED_SECRET]"));

  fs.rmSync(tempVault, { recursive: true, force: true });
});
