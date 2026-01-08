import fs from 'node:fs';
import path from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';

// Import from gemini-cli integration tests
// We assume gemini-cli is at ../gemini-cli relative to spike-runner
const GEMINI_CLI_DIR = path.resolve(import.meta.dirname, '../gemini-cli');
const TEST_HELPER_PATH = path.join(GEMINI_CLI_DIR, 'integration-tests/test-helper.ts');

// We need to use tsx to run this if we want to import .ts files directly,
// or we can just mimic the logic if it's too complex to import.
// Given the requirements, I'll implement a runner that leverages the same patterns.

import { TestRig } from '../gemini-cli/integration-tests/test-helper.ts';
import { getTrajectoriesForPath } from 'harvester/chronicle.ts';

/**
 * GeminiRunner handles driving the Gemini CLI for a single scenario.
 */
class GeminiRunner {
  constructor(targetDir, scenarioName) {
    this.targetDir = path.resolve(targetDir);
    this.scenarioName = scenarioName;
    this.rig = new TestRig();
  }

  async setup() {
    // TestRig usually creates a random temp dir. 
    // We want it to use our targetDir but still provide the isolation (settings.json, telemetry.log etc)
    // ALTERNATIVE: One could just run gemini cli directly in targetDir if isolation isn't strictly needed.
    
    // Hack to make TestRig use our directory instead of creating a new one in /tmp
    // We'll initialize it with a dummy name, then override testDir.
    this.rig.setup(this.scenarioName, {
        settings: {
            // Ensure we use the right model and disable things that might interfere
            general: { disableAutoUpdate: true },
            ide: { enabled: false }
        }
    });
    
    // Redirect rig to our actual target directory
    const oldTestDir = this.rig.testDir;
    
    // Copy the .gemini dir created by rig to our targetDir
    const rigGeminiDir = path.join(oldTestDir, '.gemini');
    const targetGeminiDir = path.join(this.targetDir, '.gemini');
    
    if (fs.existsSync(rigGeminiDir)) {
        if (!fs.existsSync(targetGeminiDir)) {
            fs.mkdirSync(targetGeminiDir, { recursive: true });
        }
        // Copy settings.json and other rig artifacts
        const files = fs.readdirSync(rigGeminiDir);
        for (const file of files) {
            fs.copyFileSync(path.join(rigGeminiDir, file), path.join(targetGeminiDir, file));
        }
    }
    
    // Update rig's internal state to point to our benchmark directory
    this.rig.testDir = this.targetDir;
  }

  async run(prompt) {
    console.log(`[GeminiRunner] Starting CLI in ${this.targetDir}`);
    console.log(`[GeminiRunner] Prompt: ${prompt.slice(0, 50)}...`);

    const run = await this.rig.runInteractive();
    
    try {
        // Type the prompt
        await run.sendKeys(prompt + '\n');
        
        // Wait for completion. 
        // In the CLI, we wait for the prompt "Type your message..." to reappear 
        // AND for telemetry to indicate the turn is over.
        console.log("[GeminiRunner] Waiting for agent to finish...");
        
        // Use a long timeout for complex tasks (5 minutes)
        const timeout = 5 * 60 * 1000;
        await run.expectText('Type your message', timeout);
        
        // Wait for telemetry to flush
        await this.rig.waitForTelemetryReady();
        
        console.log("[GeminiRunner] Agent finished turn.");
    } finally {
        // Cleanup
        await run.kill();
    }
  }

  async saveResults() {
    console.log("[GeminiRunner] Saving trajectory logs via harvester...");
    try {
        const trajectories = await getTrajectoriesForPath(this.targetDir);
        if (trajectories.length > 0) {
            // Find the most recent trajectory
            trajectories.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            const latest = trajectories[0];
            
            if (latest.filePath) {
                const logContent = fs.readFileSync(latest.filePath, 'utf8');
                const chatLogPath = path.join(this.targetDir, 'chat_log.json');
                fs.writeFileSync(chatLogPath, logContent);
                console.log(`[GeminiRunner] Saved chat log to ${chatLogPath}`);
                
                // Also save a human readable version for the dashboard
                const session = JSON.parse(logContent);
                let humanLog = "";
                for (const msg of session.messages || []) {
                    humanLog += `\n=== ${msg.type.toUpperCase()} ===\n`;
                    humanLog += (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) + "\n";
                }
                fs.writeFileSync(path.join(this.targetDir, 'chat_log.txt'), humanLog);
            }
        } else {
            console.warn("[GeminiRunner] No trajectories found for this path.");
        }
    } catch (e) {
        console.error("[GeminiRunner] Failed to harvest results:", e);
    }
  }

  // Verification helpers
  async expectFileCreated(relPath) {
    const fullPath = path.join(this.targetDir, relPath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Verification failed: Expected file ${relPath} was not created.`);
    }
    return true;
  }

  async expectToolCalled(toolName) {
    const logs = this.rig.readToolLogs();
    const called = logs.some(l => l.toolRequest.name === toolName);
    if (!called) {
        throw new Error(`Verification failed: Expected tool ${toolName} was never called.`);
    }
    return true;
  }
}

// CLI Entry point
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: tsx run-gemini.mjs <directory> <prompt>");
    process.exit(1);
  }

  const [targetDir, prompt] = args;
  const scenarioName = path.basename(targetDir);
  
  const runner = new GeminiRunner(targetDir, scenarioName);
  
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

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run-gemini.mjs')) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

export { GeminiRunner };
