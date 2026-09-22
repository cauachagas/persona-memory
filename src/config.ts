import path from "node:path";
import os from "node:os";

export interface PersonaMemoryConfig {
  vaultPath: string;
  producer: string;
}

export function resolveVaultPath(cliVaultArg?: string): string {
  let target = cliVaultArg || process.env.PERSONA_MEMORY_VAULT || path.join(os.homedir(), ".persona-memory");
  if (target.startsWith("~")) {
    target = path.join(os.homedir(), target.slice(1));
  }
  return path.resolve(target);
}

export function resolveProducer(cliProducerArg?: string): string {
  return cliProducerArg || process.env.PERSONA_MEMORY_PRODUCER || "persona-memory/0.1";
}

export function getConfig(cliVaultArg?: string, cliProducerArg?: string): PersonaMemoryConfig {
  return {
    vaultPath: resolveVaultPath(cliVaultArg),
    producer: resolveProducer(cliProducerArg),
  };
}
