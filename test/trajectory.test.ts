import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { recordCognitiveEvent } from "../src/mutations.js";
import { searchMemory } from "../src/search.js";
import { readDocument } from "../src/vault.js";

const execAsync = promisify(execFile);

test("trajectory lifecycle: baseline -> cognitive event -> human review/update -> cross-harness discovery", async () => {
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "persona-trajectory-"));
  fs.mkdirSync(path.join(tempVault, "beliefs"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "events"), { recursive: true });
  fs.mkdirSync(path.join(tempVault, "projects"), { recursive: true });
  fs.writeFileSync(path.join(tempVault, "log.md"), "# Mutation Log\n", "utf8");
  fs.writeFileSync(
    path.join(tempVault, "index.md"),
    "---\nokf_version: \"0.2\"\npersona_memory_version: \"0.1\"\n---\n\n# Persona Memory\n<!-- persona:managed-start -->\n<!-- persona:managed-end -->\n",
    "utf8"
  );

  // 1. Baseline: Project and Initial Belief
  fs.writeFileSync(
    path.join(tempVault, "projects/antigravity-suite.md"),
    `---
type: project
title: Antigravity Suite
description: Dois sistemas desenvolvidos com pipelines autônomos
status: stable
persona:
  state: completed
---
Experiências com agentes concorrentes e contratos locais.
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempVault, "beliefs/modular-monolith.md"),
    `---
type: belief
title: Monólito Modular
description: Preferência por monólitos modulares com forte tipagem
status: stable
persona:
  state: current
sources:
  - id: antigravity-suite
    resource: /projects/antigravity-suite.md
---
Monólitos modulares evitam sobrecarga de rede desnecessária.
`,
    "utf8"
  );

  await execAsync("git", ["init"], { cwd: tempVault });
  await execAsync("git", ["add", "."], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "chore: seed trajectory baseline"], { cwd: tempVault });

  // 2. Harness A records a cognitive event
  const eventRes = await recordCognitiveEvent(tempVault, {
    title: "Revisao Operacional Modular",
    description: "Evidência confirmada nos testes de concorrência",
    event_kind: "belief_change",
    summary: "Redução de latência comprovada eliminando hops HTTP entre serviços.",
    details: "Zero latência observada na comunicação entre agentes locais em memória.",
    target: "/beliefs/modular-monolith.md",
    related_paths: ["/projects/antigravity-suite.md"],
    producer: "antigravity/gemini-3-pro",
  });

  assert.equal(eventRes.status, "draft");

  // 3. Human reviews and ratifies the belief update
  const updatedBelief = `---
type: belief
title: Monólito Modular
description: Preferência confirmada por monólitos modulares após revisão
status: stable
verified:
  by: human:caua
  at: "2026-09-22T04:30:00Z"
persona:
  state: current
sources:
  - id: antigravity-suite
    resource: /projects/antigravity-suite.md
---
Monólitos modulares confirmados como a preferência arquitetural primária.
Relacionado ao evento [[${eventRes.eventPath.replace(/^\//, "").replace(/\.md$/, "")}]].
`;
  fs.writeFileSync(path.join(tempVault, "beliefs/modular-monolith.md"), updatedBelief, "utf8");
  await execAsync("git", ["add", "beliefs/modular-monolith.md"], { cwd: tempVault });
  await execAsync("git", ["commit", "-m", "feat(belief): ratify modular monolith preference based on event"], { cwd: tempVault });

  // 4. Harness B opens (e.g. OpenCode) and queries without prior context
  const { results } = searchMemory(tempVault, "modular");
  assert.ok(results.length >= 2);

  const matchedPaths = results.map((r) => r.path);
  assert.ok(matchedPaths.includes("/beliefs/modular-monolith.md"));
  assert.ok(matchedPaths.includes(eventRes.eventPath));

  // 5. Harness B retrieves complete document
  const retrievedBelief = readDocument(tempVault, "/beliefs/modular-monolith.md");
  assert.equal(retrievedBelief.trust, "human-verified");
  assert.ok(retrievedBelief.content.includes("Monólitos modulares confirmados"));

  fs.rmSync(tempVault, { recursive: true, force: true });
});
