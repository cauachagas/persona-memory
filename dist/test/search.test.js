import test from "node:test";
import assert from "node:assert/strict";
import { searchDocuments } from "../src/search.js";
import { parseDocument } from "../src/parser.js";
const docs = [
    parseDocument("beliefs/modular-monolith.md", `---
type: belief
title: Monólito Modular
description: Preferência por monólitos modulares em arquitetura
status: stable
tags:
  - architecture
  - modular-monolith
verified:
  by: human:caua
---
Corpo detalhado sobre monolitos e arquitetura.
`),
    parseDocument("competencies/webassembly.md", `---
type: competency
title: WebAssembly Memory
description: Estudo de memória linear e ponteiros
status: stable
tags:
  - wasm
  - memory
verified:
  by: human:caua
---
Explorando gerenciamento de buffers e ponteiros no WASM.
`),
    parseDocument("heuristics/learning-style.md", `---
type: heuristic
title: Learning Style
description: Feynman e abordagem intuitiva bottom-up
status: stable
tags:
  - learning
verified:
  by: human:caua
---
Teoria antes de prática e consolidação.
`),
];
test("search: exact title match ranking", () => {
    const results = searchDocuments(docs, "Monólito Modular");
    assert.ok(results.length >= 1);
    assert.equal(results[0].path, "beliefs/modular-monolith.md");
    assert.equal(results[0].trust, "human-reviewed");
});
test("search: tag matching and type filtering", () => {
    const results = searchDocuments(docs, "wasm", { types: ["competency"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].path, "competencies/webassembly.md");
    const filteredOut = searchDocuments(docs, "wasm", { types: ["belief"] });
    assert.equal(filteredOut.length, 0);
});
test("search: snippet contains matched context", () => {
    const results = searchDocuments(docs, "ponteiros");
    assert.ok(results.length >= 1);
    assert.match(results[0].snippet.toLowerCase(), /ponteiros/);
});
