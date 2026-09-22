import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function isGitRepo(vaultRoot: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: vaultRoot });
    return true;
  } catch {
    return false;
  }
}

export async function isWorktreeClean(vaultRoot: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["diff", "--cached", "--quiet"], { cwd: vaultRoot });
    return true;
  } catch {
    return false;
  }
}

export async function addFiles(vaultRoot: string, filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) return;
  await execFileAsync("git", ["add", "--", ...filePaths], { cwd: vaultRoot });
}

export async function commit(vaultRoot: string, message: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["commit", "-m", message], { cwd: vaultRoot });
  return stdout.trim();
}

export async function getRecentCommits(vaultRoot: string, count = 5): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["log", "-n", String(count), "--oneline"], { cwd: vaultRoot });
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
