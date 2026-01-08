import fs from 'node:fs';
import path from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import * as pty from '@lydell/node-pty';
import stripAnsi from 'strip-ansi';

/**
 * Gemini CLI Benchmarking Runner
 * 
 * This runner is designed to programmatically drive the interactive Gemini CLI for benchmarking.
 * 
 * Porting/Inspiration Note:
 * This runner is heavily inspired by and ports key components from the Gemini CLI integration test rig.
 * Specifically, the TestRig and InteractiveRun classes were adapted to run outside of the Vitest
 * environment and handle benchmarking-specific needs like trajectory harvesting.
 * 
 * Original Test Rig source:
 * https://github.com/google-gemini/gemini-cli/blob/main/integration-tests/test-helper.ts
 */

// Constants from gemini-cli
const GEMINI_DIR = '.gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
const DEFAULT_TMP_DIR = path.join(os.homedir(), '.gemini/tmp');

const BUNDLE_PATH = path.resolve(import.meta.dirname, '../gemini-cli/bundle/gemini.js');

// --- Standalone Trajectory Logic (from get_trajectories_standalone.ts) ---

/**
 * Resolves paths with ~ to the user's home directory.
 */
function resolvePath(p) {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

/**
 * Processes a session log to extract basic statistics and inferred project path.
 */
function processTrajectory(session) {
  const messages = session.messages || [];
  let turnCount = 0;
  let errorCount = 0;
  let projectPath = null;

  for (const msg of messages) {
    if (msg.type === 'user') turnCount++;
    if (msg.type === 'gemini' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.status === 'error') errorCount++;
        if (!projectPath && tc.args) {
          const filePath = tc.args.file_path || tc.args.absolute_path || tc.args.path || tc.args.dir_path;
          if (filePath && typeof filePath === 'string' && filePath.startsWith('/')) {
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
 */
async function getTrajectoriesForPath(targetPath, options = {}) {
  const tmpDir = options.tmpDir || DEFAULT_TMP_DIR;
  const projectMap = options.projectMap || {};
  const absoluteTargetPath = path.resolve(targetPath);

  const allSessions = [];
  const unidentifiedHashes = new Map();

  try {
    const projectDirs = await fs.promises.readdir(tmpDir);
    for (const hash of projectDirs) {
      if (hash.startsWith('.')) continue;
      const chatsDir = path.join(tmpDir, hash, 'chats');
      try {
        const files = await fs.promises.readdir(chatsDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const filePath = path.join(chatsDir, file);
            const content = await fs.promises.readFile(filePath, 'utf8');
            const session = JSON.parse(content);
            const stats = processTrajectory(session);
            stats.filePath = filePath;
            allSessions.push(stats);

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
    const candidatePaths = new Set();
    if (s.projectPath) candidatePaths.add(resolvePath(s.projectPath));
    if (projectMap[s.projectHash]) candidatePaths.add(resolvePath(projectMap[s.projectHash]));
    
    for (const p of candidatePaths) {
      if (p === absoluteTargetPath) return true;
    }
    return false;
  });

  if (matches.length === 0 && unidentifiedHashes.size > 0) {
      console.log(`
[getTrajectoriesForPath] No trajectories matched for: ${targetPath}`);
      // (Instruction logging removed for brevity in benchmark output, but logic is here)
  }

  return matches;
}

// --- Runner Logic ---

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll(predicate, timeout, interval) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (predicate()) return true;
    await sleep(interval);
  }
  return false;
}

class InteractiveRun {
  constructor(ptyProcess) {
    this.ptyProcess = ptyProcess;
    this.output = '';
    this.rawOutput = '';
    ptyProcess.onData((data) => {
      this.output += data;
      this.rawOutput += data;
      if (env['VERBOSE'] === 'true') {
        process.stdout.write(data);
      }
    });
  }

  async expectText(text, timeout = 30000) {
    const found = await poll(
      () => stripAnsi(this.output).toLowerCase().includes(text.toLowerCase()),
      timeout,
      200,
    );
    if (!found) {
        throw new Error(`Timed out waiting for text: "${text}"`);
    }
  }

  async waitForAnyText(texts, timeout = 30000) {
      const found = await poll(() => {
          const stripped = stripAnsi(this.output).toLowerCase();
          return texts.some(t => stripped.includes(t.toLowerCase()));
      }, timeout, 500);
      
      if (!found) {
          throw new Error(`Timed out waiting for any of: ${texts.join(', ')}`);
      }
  }

  // More specific check that ignores the bottom status bar or initial prompt
  async waitForPrompt(timeout = 30000) {
      const found = await poll(() => {
          const stripped = stripAnsi(this.output);
          // Look for the prompt pattern at the end of the output, but not the one we just typed
          const lines = stripped.split('\n');
          // Check last 5 lines for the prompt
          return lines.slice(-5).some(line => line.includes('Type your message'));
      }, timeout, 500);
      
      if (!found) {
          throw new Error(`Timed out waiting for interactive prompt`);
      }
  }

  async sendKeys(text) {
    const delay = 5;
    for (const char of text) {
      this.ptyProcess.write(char);
      await sleep(delay);
    }
  }

  async type(text) {
    for (const char of text) {
      if (char === '\r' || char === '\n') {
        await sleep(50);
      }
      this.ptyProcess.write(char);
      await sleep(10);
    }
  }

  async kill() {
    this.ptyProcess.kill();
  }
}

class TestRig {
  constructor(targetDir, scenarioName) {
    this.testDir = path.resolve(targetDir);
    this.homeDir = path.join(this.testDir, 'fake-home');
    this.scenarioName = scenarioName;
    this._interactiveRuns = [];
  }

  setup() {
    if (!fs.existsSync(this.testDir)) fs.mkdirSync(this.testDir, { recursive: true });
    if (!fs.existsSync(this.homeDir)) fs.mkdirSync(this.homeDir, { recursive: true });

    const geminiDir = path.join(this.testDir, GEMINI_DIR);
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }

    // Add .geminiignore to keep it fast
    fs.writeFileSync(path.join(this.testDir, '.geminiignore'), "results/\nnode_modules/\n.git/\n");

    const telemetryPath = path.join(this.homeDir, 'telemetry.log');
    const settings = {
      general: {
        disableAutoUpdate: true,
        previewFeatures: false,
      },
      telemetry: {
        enabled: true,
        target: 'local',
        outfile: telemetryPath,
      },
      security: { 
        auth: { selectedType: 'gemini-api-key' },
      },
      ui: { useAlternateBuffer: true },
      model: DEFAULT_GEMINI_MODEL,
      ide: { enabled: false, hasSeenNudge: true },
    };

    fs.writeFileSync(
      path.join(geminiDir, 'settings.json'),
      JSON.stringify(settings, null, 2),
    );
  }

  async runInteractive() {
    const ptyOptions = {
      name: 'xterm-color',
      cols: 80,
      rows: 80,
      cwd: this.testDir,
      env: { 
          ...env, 
          GEMINI_SANDBOX: 'false',
          GEMINI_CLI_HOME: this.homeDir 
      },
    };

    const ptyProcess = pty.spawn(process.execPath, [BUNDLE_PATH, '--yolo'], ptyOptions);
    const run = new InteractiveRun(ptyProcess);
    this._interactiveRuns.push(run);
    
    await run.expectText('Type your message', 60000);
    return run;
  }

  readToolLogs() {
    const logFilePath = path.join(this.homeDir, 'telemetry.log');
    if (!fs.existsSync(logFilePath)) return [];

    const content = fs.readFileSync(logFilePath, 'utf-8');
    const logs = [];
    
    const jsonObjects = content.split(/}\n{/).map((obj, i, arr) => {
        if (i > 0) obj = '{' + obj;
        if (i < arr.length - 1) obj = obj + '}';
        return obj.trim();
    }).filter(Boolean);

    for (const jsonStr of jsonObjects) {
      try {
        const logData = JSON.parse(jsonStr);
        if (logData.attributes && logData.attributes['event.name'] === 'gemini_cli.tool_call') {
          logs.push({
            toolRequest: {
              name: logData.attributes.function_name,
              args: logData.attributes.function_args ?? '{}',
              success: logData.attributes.success ?? false,
              duration_ms: logData.attributes.duration_ms ?? 0,
            },
          });
        }
      } catch (e) {}
    }
    return logs;
  }

  async waitForTelemetryReady() {
    const logFilePath = path.join(this.homeDir, 'telemetry.log');
    await poll(() => {
        if (!fs.existsSync(logFilePath)) return false;
        const content = fs.readFileSync(logFilePath, 'utf-8');
        return content.includes('"scopeMetrics"');
    }, 5000, 200);
  }

  async cleanup() {
    for (const run of this._interactiveRuns) {
        try { await run.kill(); } catch (e) {}
    }
    this._interactiveRuns = [];
  }

  sync() {
    if (os.platform() === 'win32') return;
    try { execSync('sync', { cwd: this.testDir }); } catch (e) {}
  }
}

class GeminiRunner {
  constructor(targetDir, scenarioName) {
    this.targetDir = path.resolve(targetDir);
    this.scenarioName = scenarioName;
    this.rig = new TestRig(this.targetDir, this.scenarioName);
  }

  async setup() {
    this.rig.setup();
  }

  async run(prompt) {
    console.log(`[GeminiRunner] Starting CLI in ${this.targetDir}`);
    const run = await this.rig.runInteractive();
    this.currentRun = run;
    
    try {
        await run.type(prompt + '\r');
        console.log("[GeminiRunner] Waiting for agent to start working...");
        
        await run.waitForAnyText(['Tool call:', 'Thought:'], 60 * 1000);
        
        console.log("[GeminiRunner] Agent is working. Waiting for completion...");
        
        await run.waitForPrompt(15 * 60 * 1000);
        
        await this.rig.waitForTelemetryReady();
        console.log("[GeminiRunner] Agent finished turn.");
    } finally {
        // cleanup handled in saveResults
    }
  }

  async saveResults() {
    if (this.currentRun) {
        fs.writeFileSync(path.join(this.targetDir, 'raw_pty_output.txt'), this.currentRun.rawOutput);
        await this.rig.cleanup();
    }

    console.log("[GeminiRunner] Saving trajectory logs...");
    try {
        const actualTmpDir = path.join(this.rig.homeDir, '.gemini/tmp');
        
        const trajectories = await getTrajectoriesForPath(this.targetDir, { tmpDir: actualTmpDir });
        if (trajectories.length > 0) {
            trajectories.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            const latest = trajectories[0];
            if (latest.filePath) {
                const logContent = fs.readFileSync(latest.filePath, 'utf8');
                fs.writeFileSync(path.join(this.targetDir, 'chat_log.json'), logContent);
                
                const session = JSON.parse(logContent);
                let humanLog = "";
                for (const msg of session.messages || []) {
                    humanLog += `\n=== ${msg.type.toUpperCase()} ===\n`;
                    humanLog += (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) + "\n";
                }
                fs.writeFileSync(path.join(this.targetDir, 'chat_log.txt'), humanLog);
                console.log(`[GeminiRunner] Saved chat logs.`);
            }
        } else {
            console.warn(`[getTrajectoriesForPath] No trajectories matched for: ${this.targetDir} in ${actualTmpDir}`);
        }
    } catch (e) {
        console.error("[GeminiRunner] Failed to harvest results:", e);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node --experimental-strip-types run-gemini.mjs <directory> <prompt>");
    process.exit(1);
  }

  const [targetDir, prompt] = args;
  const runner = new GeminiRunner(targetDir, path.basename(targetDir));
  
  try {
    await runner.setup();
    await runner.run(prompt);
    await runner.saveResults();
    console.log("✅ Gemini CLI run completed successfully.");
  } catch (err) {
    console.error("❌ Gemini CLI run failed:", err);
    process.exit(1);
  }
}

if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('run-gemini.mjs'))) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

export { GeminiRunner };