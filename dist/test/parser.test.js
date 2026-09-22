import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument, validateDocument, normalizeVerified, determineTrust } from "../src/parser.js";
test("parser: parses valid OKF document with frontmatter", () => {
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
    const validation = validateDocument(doc);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
});
test("parser: validates missing type in regular document", () => {
    const content = `---
title: Missing Type
---
Body without type.
`;
    const doc = parseDocument("heuristics/missing.md", content);
    const validation = validateDocument(doc);
    assert.equal(validation.valid, false);
    assert.match(validation.errors[0], /missing required 'type'/);
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
    const machineOnly = normalizeVerified({ by: "process:bot", at: "2026-09-21" });
    assert.equal(determineTrust(machineOnly), "machine-confirmed");
    const empty = normalizeVerified(null);
    assert.equal(determineTrust(empty), "unverified");
});
