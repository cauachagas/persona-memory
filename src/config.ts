import path from "node:path";
import os from "node:os";

export interface PersonaMemoryConfig {
  vaultPath: string;
}

export function resolveVaultPath(cliVaultArg?: string): string {
  let target = cliVaultArg || process.env.PERSONA_MEMORY_VAULT || path.join(os.homedir(), ".persona-memory");
  if (target.startsWith("~")) {
    target = path.join(os.homedir(), target.slice(1));
  }
  return path.resolve(target);
}

export function getConfig(cliVaultArg?: string): PersonaMemoryConfig {
  return {
    vaultPath: resolveVaultPath(cliVaultArg),
  };
}
