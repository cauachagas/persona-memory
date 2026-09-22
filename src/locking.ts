import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface LockHandle {
  release: () => void;
}

const LOCK_TIMEOUT_MS = 10000; // 10s acquisition timeout
const STALE_LOCK_MS = 300000;  // 5 minutes stale threshold

export async function acquireLock(vaultRoot: string): Promise<LockHandle> {
  const hash = crypto.createHash("sha1").update(vaultRoot).digest("hex");
  const lockFile = path.join(os.tmpdir(), "persona-memory-" + hash + ".lock");
  const startTime = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      const metadata = {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        vault: vaultRoot,
      };
      fs.writeFileSync(fd, JSON.stringify(metadata, null, 2), "utf8");
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
          const isStaleTime = Date.now() - stats.mtimeMs > STALE_LOCK_MS;

          let pidDead = false;
          try {
            const raw = fs.readFileSync(lockFile, "utf8");
            const data = JSON.parse(raw);
            if (data.pid) {
              try {
                // Check if PID is alive (signal 0 does not kill process)
                process.kill(data.pid, 0);
              } catch (killErr: any) {
                if (killErr.code === "ESRCH") {
                  pidDead = true;
                }
              }
            }
          } catch {
            // Unparseable lock file
            pidDead = true;
          }

          if (isStaleTime && pidDead) {
            console.warn("Reclaiming stale lockfile from deceased process:", lockFile);
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
