import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Minimal interface for Gemini CLI session logs.
 */
interface ConversationRecord {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated: string;
  messages: Array < {
    type: string;
    content?: any;
    toolCalls?: Array < {
      name: string;
      args: any;
      status?: string;
    } >;
  } >;
}

export interface TrajectoryStats {
  sessionId: string;
  projectHash: string;
  projectPath: string | null;
  turnCount: number;
  errorCount: number;
  duration: number;
  startTime: string;
  challengeScore: number;
  filePath?: string;
}

export interface ProjectMap {
  [key: string]: string;
}

const DEFAULT_TMP_DIR = path.join(os.homedir(), '.gemini/tmp');

/**
 * Resolves paths with ~ to the user's home directory.
 */
function resolvePath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

/**
 * Processes a session log to extract basic statistics and inferred project path.
 */
function processTrajectory(session: ConversationRecord): TrajectoryStats {
  const messages = session.messages || [];
  let turnCount = 0;
  let errorCount = 0;
  let projectPath: string | null = null;

  for (const msg of messages) {
    if (msg.type === 'user') turnCount++;
    if (msg.type === 'gemini' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.status === 'error') errorCount++;
        if (!projectPath && tc.args) {
          const filePath = tc.args.file_path || tc.args.absolute_path || tc.args.path || tc.args.dir_path;
          if (filePath && typeof filePath === 'string' && filePath.startsWith('/')) {
            // Heuristic: identify project root from absolute path (e.g., .../code/project-name/...)
            const parts = filePath.split('/');
            const codeIdx = parts.indexOf('code');
            if (codeIdx !== -1 && parts[codeIdx + 1]) {
              projectPath = parts.slice(0, codeIdx + 2).join('/');
            }
          }
        }
      }
    }
  }

  const duration = new Date(session.lastUpdated).getTime() - new Date(session.startTime).getTime();

  return {
    sessionId: session.sessionId,
    projectHash: session.projectHash,
    projectPath,
    turnCount,
    errorCount,
    duration: isNaN(duration) ? 0 : duration,
    startTime: session.startTime,
    challengeScore: turnCount + (errorCount * 2)
  };
}

/**
 * Finds all trajectories associated with a specific project path.
 * Matches both inferred paths from tool calls and mappings in an optional ProjectMap.
 */
export async function getTrajectoriesForPath(
  targetPath: string,
  options: { tmpDir?: string; projectMap?: ProjectMap } = {}
): Promise<TrajectoryStats[]> {
  const tmpDir = options.tmpDir || DEFAULT_TMP_DIR;
  const projectMap = options.projectMap || {};
  const absoluteTargetPath = path.resolve(targetPath);

  const allSessions: TrajectoryStats[] = [];
  const unidentifiedHashes = new Map<string, { lastActive: string; count: number }>();

  try {
    const projectDirs = await fs.readdir(tmpDir);
    for (const hash of projectDirs) {
      if (hash.startsWith('.')) continue;
      const chatsDir = path.join(tmpDir, hash, 'chats');
      try {
        const files = await fs.readdir(chatsDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const filePath = path.join(chatsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const session: ConversationRecord = JSON.parse(content);
            const stats = processTrajectory(session);
            stats.filePath = filePath;
            allSessions.push(stats);

            // Track hashes that don't have a known path yet
            if (!stats.projectPath && !projectMap[stats.projectHash]) {
              const prev = unidentifiedHashes.get(stats.projectHash);
              if (!prev || new Date(stats.startTime) > new Date(prev.lastActive)) {
                unidentifiedHashes.set(stats.projectHash, {
                  lastActive: stats.startTime,
                  count: (prev?.count || 0) + 1
                });
              }
            }
          } catch { /* ignore corrupted logs */ }
        }
      } catch { /* ignore missing chats dirs */ }
    }
  } catch (e) {
    console.error(`Error reading Gemini logs from ${tmpDir}:`, e);
    return [];
  }

  const matches = allSessions.filter(s => {
    const candidatePaths = new Set<string>();
    if (s.projectPath) candidatePaths.add(resolvePath(s.projectPath));
    if (projectMap[s.projectHash]) candidatePaths.add(resolvePath(projectMap[s.projectHash]));
    
    for (const p of candidatePaths) {
      if (p === absoluteTargetPath) return true;
    }
    return false;
  });

  if (matches.length === 0) {
    printInstructions(absoluteTargetPath, unidentifiedHashes);
  }

  return matches;
}

function printInstructions(targetPath: string, unidentified: Map<string, { lastActive: string; count: number }>) {
  console.log(`\n[getTrajectoriesForPath] No trajectories matched for: ${targetPath}`);
  
  const sorted = [...unidentified.entries()]
    .sort((a, b) => new Date(b[1].lastActive).getTime() - new Date(a[1].lastActive).getTime())
    .slice(0, 5);

  if (sorted.length > 0) {
    console.log(`If you were recently active in this project, it might be one of these unidentified hashes:`);
    for (const [hash, info] of sorted) {
      console.log(`  - ${hash} (Last active: ${info.lastActive}, Sessions: ${info.count})`);
    }
    console.log(`\nTo fix this, add the mapping to your project-map.json:`);
    console.log(`{
  "${sorted[0][0]}": "${targetPath}"
}`);
  } else {
    console.log(`No unidentified project logs were found in the logs directory.`);
  }
}

// Example usage if run directly:
// node get_trajectories_standalone.ts .
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] || process.cwd();
  getTrajectoriesForPath(target).then(trajs => {
    if (trajs.length > 0) {
      console.log(`Found ${trajs.length} trajectories for ${target}`);
    }
  });
}
