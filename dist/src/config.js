import path from "node:path";
import os from "node:os";
export function resolveVaultPath(cliVaultArg) {
    let target = cliVaultArg || process.env.PERSONA_MEMORY_VAULT || path.join(os.homedir(), ".persona-memory");
    if (target.startsWith("~")) {
        target = path.join(os.homedir(), target.slice(1));
    }
    return path.resolve(target);
}
export function getConfig(cliVaultArg) {
    return {
        vaultPath: resolveVaultPath(cliVaultArg),
    };
}
