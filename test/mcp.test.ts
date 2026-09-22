import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { getPersonaContext } from "../src/tools/context.js";
import { handleSearchMemory, handleGetMemory } from "../src/tools/memory.js";

const realVault = path.join(os.homedir(), ".persona-memory");

test("mcp tools: get_persona_context returns bootstrap metadata", () => {
  const ctx = getPersonaContext(realVault);
  assert.equal(ctx.identity.name, "Cauã");
  assert.ok(ctx.heuristics.length >= 1);
  assert.ok(ctx.active_frontiers.length >= 1);
  assert.ok(ctx.current_beliefs.length >= 1);
});

test("mcp tools: search_memory and get_memory work seamlessly", () => {
  const searchResults = handleSearchMemory(realVault, "WebAssembly");
  assert.ok(searchResults.length >= 1);

  const wasmDoc = handleGetMemory(realVault, "competencies/webassembly.md");
  assert.equal(wasmDoc.path, "competencies/webassembly.md");
  assert.equal(wasmDoc.frontmatter.type, "competency");
  assert.match(wasmDoc.content, /memória linear/i);
});

test("mcp tools: get_memory rejects directory traversal", () => {
  assert.throws(() => {
    handleGetMemory(realVault, "../../etc/passwd");
  }, /escapes the vault boundary/);
});
