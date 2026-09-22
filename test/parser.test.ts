import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument, normalizeVerified, determineTrust } from "../src/vault/parser.js";
import { validateDocumentCompliance } from "../src/domain/document.js";
import { parseActor, isHuman } from "../src/domain/actor.js";

test("parser: parses valid OKF document with persona profile frontmatter", () => {
  const content = `---
type: belief
title: Test Belief
description: A test description
status: stable
tags:
  - architecture
  - test
generated:
  by: human:caua
  at: "2026-09-22T03:00:00Z"
verified:
  by: human:caua
  at: "2026-09-22T03:05:00Z"
persona:
  state: current
  category: architectural-preference
---

# Content Body

This is a test content.
`;

  const doc = parseDocument("beliefs/test.md", content);
  assert.equal(doc.path, "beliefs/test.md");
  assert.equal(doc.type, "belief");
  assert.equal(doc.title, "Test Belief");
  assert.equal(doc.status, "stable");
  assert.deepEqual(doc.tags, ["architecture", "test"]);
  assert.equal(doc.trust, "human-reviewed");
  assert.equal(doc.persona?.state, "current");
  assert.match(doc.content, /This is a test content/);

  const validation = validateDocumentCompliance(doc);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test("parser: validates actor provenance and human check", () => {
  const human = parseActor("human:caua");
  assert.equal(human.type, "human");
  assert.equal(human.identifier, "caua");
  assert.equal(isHuman("human:caua"), true);

  const agent = parseActor("antigravity/gemini-3-pro");
  assert.equal(agent.type, "agent");
  assert.equal(isHuman("antigravity/gemini-3-pro"), false);

  const processActor = parseActor("process:persona-memory");
  assert.equal(processActor.type, "process");
  assert.equal(isHuman("process:persona-memory"), false);
});

test("parser: validates invalid persona state for belief", () => {
  const content = `---
type: belief
title: Invalid State
persona:
  state: active-frontier
---
Body
`;
  const doc = parseDocument("beliefs/invalid.md", content);
  const validation = validateDocumentCompliance(doc);
  assert.equal(validation.valid, false);
  assert.match(validation.errors[0], /Invalid persona.state/);
});

test("parser: normalizes verified single mapping vs list", () => {
  const single = normalizeVerified({ by: "human:caua", at: "2026-09-22" });
  assert.deepEqual(single, [{ by: "human:caua", at: "2026-09-22" }]);

  const list = normalizeVerified([
    { by: "process:bot", at: "2026-09-21" },
    { by: "human:caua", at: "2026-09-22" },
  ]);
  assert.equal(list.length, 2);
  assert.equal(determineTrust(list), "human-reviewed");
});
