import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument, normalizeVerified, determineTrust, validateDocument } from "../src/parser.js";

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

  const doc = parseDocument("/beliefs/test.md", content);
  assert.equal(doc.path, "/beliefs/test.md");
  assert.equal(doc.type, "belief");
  assert.equal(doc.title, "Test Belief");
  assert.equal(doc.status, "stable");
  assert.deepEqual(doc.tags, ["architecture", "test"]);
  assert.equal(doc.trust, "human-verified");
  assert.equal(doc.persona?.state, "current");
  assert.match(doc.content, /This is a test content/);

  const issues = validateDocument(doc);
  assert.equal(issues.filter((i) => i.severity === "ERROR").length, 0);
});

test("parser: flags error on missing type and warning on unknown state", () => {
  const missingType = parseDocument("/beliefs/missing.md", `---\ntitle: Missing Type\n---\nBody`);
  const missingIssues = validateDocument(missingType);
  assert.ok(missingIssues.some((i) => i.severity === "ERROR" && i.message.includes("missing required 'type'")));

  const badState = parseDocument("/beliefs/bad-state.md", `---\ntype: belief\ntitle: Bad\npersona:\n  state: active-frontier\n---\nBody`);
  const stateIssues = validateDocument(badState);
  assert.ok(stateIssues.some((i) => i.severity === "WARNING" && i.message.includes("Unexpected persona.state")));
});

test("parser: normalizes verified single mapping vs list", () => {
  const single = normalizeVerified({ by: "human:caua", at: "2026-09-22" });
  assert.deepEqual(single, [{ by: "human:caua", at: "2026-09-22" }]);

  const list = normalizeVerified([
    { by: "process:bot", at: "2026-09-21" },
    { by: "human:caua", at: "2026-09-22" },
  ]);
  assert.equal(list.length, 2);
  assert.equal(determineTrust({ verified: list, sources: [] }), "human-verified");

  const agentOnly = determineTrust({
    verified: [],
    generated: { by: "antigravity/gemini-3-pro", at: "2026-09-22" },
    sources: [],
  });
  assert.equal(agentOnly, "agent-generated");
});
