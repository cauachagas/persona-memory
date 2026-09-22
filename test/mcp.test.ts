import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { getPersonaContext } from "../src/tools/context.js";
import { searchTrajectory } from "../src/tools/search.js";
import { handleGetMemory } from "../src/tools/memory.js";

const realVault = path.join(os.homedir(), ".persona-memory");

test("mcp tools: get_persona_context returns bootstrap metadata with constraints", () => {
  const ctx = getPersonaContext(realVault);
  assert.equal(ctx.identity.name, "Cauã");
  assert.ok(ctx.heuristics.length >= 1);
  assert.ok(ctx.active_frontiers.length >= 1);
  assert.ok(ctx.current_beliefs.length >= 1);
  assert.ok(ctx.relevant_constraints.length >= 1);
});

test("mcp tools: search_trajectory supports context budget", () => {
  const { results, totalChars } = searchTrajectory(realVault, "WebAssembly", { max_chars: 2000 });
  assert.ok(results.length >= 1);
  assert.ok(totalChars <= 2000);

  const wasmDoc = handleGetMemory(realVault, "competencies/webassembly.md");
  assert.equal(wasmDoc.path, "competencies/webassembly.md");
  assert.equal(wasmDoc.frontmatter.type, "competency");
});
