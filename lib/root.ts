import { execSync } from 'child_process';
import path from 'path';

/**
 * Returns the repository root directory. Uses `git rev-parse --show-toplevel`
 * so that the correct root is returned even when running from a git worktree.
 */
export function getRootDir(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return path.resolve(import.meta.dirname, '..');
  }
}

export const rootDir = getRootDir();
