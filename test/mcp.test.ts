import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { getPersonaContext } from "../src/server.js";
import { searchMemory } from "../src/search.js";
import { readDocument } from "../src/vault.js";

const realVault = path.join(os.homedir(), ".persona-memory");

test("mcp: get_persona_context returns briefing and respects context budget", () => {
  const context = getPersonaContext(realVault, { max_chars: 4000 });
  assert.ok(context.includes("Persona Context Briefing"));
  assert.ok(context.includes("Learning Style"));
  assert.ok(context.includes("Monólito Modular"));
  assert.ok(context.includes("WebAssembly Memory"));
  assert.ok(context.length <= 4000);
});

test("mcp: search_memory and readDocument work end-to-end", () => {
  const { results, totalChars } = searchMemory(realVault, "WebAssembly", { limit: 3 });
  assert.ok(results.length >= 1);
  assert.equal(results[0].path, "/competencies/webassembly.md");
  assert.equal(results[0].trust, "human-verified");
  assert.ok(totalChars > 0);

  const doc = readDocument(realVault, "/competencies/webassembly.md");
  assert.equal(doc.title, "WebAssembly Memory");
  assert.match(doc.content, /memória linear/i);
});
