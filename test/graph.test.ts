import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "../src/vault/parser.js";
import { buildGraph, expandOneHop } from "../src/vault/graph.js";

test("graph: extracts markdown and wiki links, calculates backlinks and expands 1-hop", () => {
  const docA = parseDocument("projects/project-a.md", `---
type: project
title: Project A
---
Relacionado a [Modular Monolith](../beliefs/modular-monolith.md) e [[competencies/webassembly]].
`);

  const docB = parseDocument("beliefs/modular-monolith.md", `---
type: belief
title: Modular Monolith
---
Convicção arquitetural.
`);

  const docC = parseDocument("competencies/webassembly.md", `---
type: competency
title: WebAssembly
---
Competência técnica.
`);

  const graph = buildGraph([docA, docB, docC]);

  assert.deepEqual(graph.forwardLinks.get("projects/project-a.md")?.sort(), [
    "beliefs/modular-monolith.md",
    "competencies/webassembly.md",
  ]);

  assert.deepEqual(graph.backlinks.get("beliefs/modular-monolith.md"), [
    "projects/project-a.md",
  ]);

  const expanded = expandOneHop(graph, ["beliefs/modular-monolith.md"]);
  assert.ok(expanded.includes("projects/project-a.md"));
});
