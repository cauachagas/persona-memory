import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface LockHandle {
  release: () => void;
}

const LOCK_TIMEOUT_MS = 10000;
const STALE_LOCK_MS = 15000;

export async function acquireLock(vaultRoot: string): Promise<LockHandle> {
  // Place lock in system tmp directory outside the vault Git working tree
  const hash = crypto.createHash("sha256").update(vaultRoot).digest("hex").slice(0, 12);
  const lockFile = path.join(os.tmpdir(), "persona-memory-" + hash + ".lock");
  const startTime = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, vault: vaultRoot, createdAt: Date.now() }), "utf8");
      fs.closeSync(fd);

      return {
        release: () => {
          try {
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
            }
          } catch (e) {
            console.error("Warning: failed to remove lockfile:", e);
          }
        },
      };
    } catch (err: any) {
      if (err.code === "EEXIST") {
        try {
          const stats = fs.statSync(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
            fs.unlinkSync(lockFile);
            continue;
          }
        } catch {
          continue;
        }

        if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
          throw new Error("Lock acquisition timed out: another process holds lockfile at " + lockFile);
        }

        await new Promise((r) => setTimeout(r, 100));
      } else {
        throw err;
      }
    }
  }
}
