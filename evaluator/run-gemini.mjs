import fs from 'node:fs';
import path from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import * as pty from '@lydell/node-pty';
import stripAnsi from 'strip-ansi';

// Constants from gemini-cli
const GEMINI_DIR = '.gemini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';

// Import from harvester
import { getTrajectoriesForPath, DEFAULT_TMP_DIR } from '../chronicle-eval/harvester/chronicle.ts';

const BUNDLE_PATH = path.resolve(import.meta.dirname, '../gemini-cli/bundle/gemini.js');

async function poll(predicate, timeout, interval) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
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
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  async kill() {
    this.ptyProcess.kill();
  }
}

class TestRig {
  constructor(targetDir, scenarioName) {
    this.targetDir = path.resolve(targetDir);
    this.scenarioName = scenarioName;
  }

  setup() {
    const geminiDir = path.join(this.targetDir, GEMINI_DIR);
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }

    // Add .geminiignore to keep it fast
    fs.writeFileSync(path.join(this.targetDir, '.geminiignore'), "results/\nnode_modules/\n.git/\n");

    const telemetryPath = path.join(this.targetDir, 'telemetry.log');
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
      cwd: this.targetDir,
      env: { ...env, GEMINI_SANDBOX: 'false' },
    };

    const ptyProcess = pty.spawn(process.execPath, [BUNDLE_PATH, '--yolo'], ptyOptions);
    const run = new InteractiveRun(ptyProcess);
    
    await run.expectText('Type your message', 60000);
    return run;
  }

  readToolLogs() {
    const logFilePath = path.join(this.targetDir, 'telemetry.log');
    if (!fs.existsSync(logFilePath)) return [];

    const content = fs.readFileSync(logFilePath, 'utf-8');
    const logs = [];
    
    // Telemetry logs are JSON objects separated by }\n{
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
    const logFilePath = path.join(this.targetDir, 'telemetry.log');
    await poll(() => {
        if (!fs.existsSync(logFilePath)) return false;
        const content = fs.readFileSync(logFilePath, 'utf-8');
        return content.includes('"event.name"');
    }, 5000, 200);
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
        await run.sendKeys(prompt + '\n');
        console.log("[GeminiRunner] Waiting for agent to start working...");
        
        // Wait for first sign of activity (Thought or Tool call)
        await run.waitForAnyText(['Tool call:', 'Thought:'], 60000);
        
        console.log("[GeminiRunner] Agent is working. Waiting for completion...");
        
        // Wait for the final prompt to reappear
        await run.waitForPrompt(10 * 60 * 1000);
        
        await this.rig.waitForTelemetryReady();
        console.log("[GeminiRunner] Agent finished turn.");
    } finally {
        // We'll kill it after saving results to ensure we have the rawOutput
    }
  }

  async saveResults() {
    if (this.currentRun) {
        fs.writeFileSync(path.join(this.targetDir, 'raw_pty_output.txt'), this.currentRun.rawOutput);
        await this.currentRun.kill();
    }

    console.log("[GeminiRunner] Saving trajectory logs via harvester...");
    try {
        const trajectories = await getTrajectoriesForPath(this.targetDir, DEFAULT_TMP_DIR);
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
            console.warn("[GeminiRunner] No trajectories found.");
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
