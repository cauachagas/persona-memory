import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { searchTrajectory } from "../src/tools/search.js";

test("search: respects context budget max_chars and ranking", () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-search-test-"));
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "competencies"), { recursive: true });

  fs.writeFileSync(
    path.join(tempVault, "beliefs/modular-monolith.md"),
    `---
type: belief
title: Monólito Modular
description: Preferência arquitetural por monólitos modulares
status: stable
tags:
  - architecture
persona:
  state: current
---
Corpo detalhado sobre monolitos modulares e escalabilidade contextual.
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempVault, "competencies/webassembly.md"),
    `---
type: competency
title: WebAssembly Memory
description: Estudo de memória linear
status: stable
tags:
  - wasm
  - memory
persona:
  state: active-frontier
---
Gerenciamento de buffers de memória linear no WASM.
`,
    "utf8"
  );

  // Search with budget limit
  const { results, totalChars } = searchTrajectory(tempVault, "Monólito", { max_chars: 500 });
  assert.ok(results.length >= 1);
  assert.equal(results[0].title, "Monólito Modular");
  assert.ok(totalChars <= 500);

  fs.rmSync(tempVault, { recursive: true, force: true });
});
