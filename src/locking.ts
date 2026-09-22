import fs from "node:fs";
import path from "node:path";

export interface LockHandle {
  release: () => void;
}

const LOCK_TIMEOUT_MS = 10000;
const STALE_LOCK_MS = 15000;

export async function acquireLock(vaultRoot: string): Promise<LockHandle> {
  const lockFile = path.join(vaultRoot, ".persona-memory.lock");
  const startTime = Date.now();

  while (true) {
    try {
      // Use wx flag for atomic creation
      const fd = fs.openSync(lockFile, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }), "utf8");
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
        // Check if lock is stale
        try {
          const stats = fs.statSync(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
            console.warn("Removing stale lockfile from", lockFile);
            fs.unlinkSync(lockFile);
            continue;
          }
        } catch {
          // Lock might have been released by another process
          continue;
        }

        if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
          throw new Error("Lock acquisition timed out: another process holds .persona-memory.lock");
        }

        // Wait 100ms before retry
        await new Promise((r) => setTimeout(r, 100));
      } else {
        throw err;
      }
    }
  }
}
