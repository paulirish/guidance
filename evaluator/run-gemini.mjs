import fs from 'node:fs';
import path from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

// Import from gemini-cli integration tests
import { TestRig } from '../gemini-cli/integration-tests/test-helper.ts';
import { getTrajectoriesForPath, DEFAULT_TMP_DIR } from 'harvester/chronicle.ts';

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
        console.log("[GeminiRunner] Waiting for agent to finish...");
        
        // Use a long timeout for complex tasks (10 minutes)
        const timeout = 10 * 60 * 1000;
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
        // TestRig uses os.tmpdir() for telemetry unless overridden.
        // But the CLI writes to .gemini/tmp in the HOME dir by default for trajectories.
        // Wait, TestRig settings.json overrides telemetry.outfile.
        
        // harvester/chronicle.ts:getTrajectoriesForPath looks in DEFAULT_TMP_DIR (~/.gemini/tmp)
        // We might need to point it to where the CLI actually wrote the logs.
        const trajectories = await getTrajectoriesForPath(this.targetDir, DEFAULT_TMP_DIR);
        
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
            console.warn("[GeminiRunner] No trajectories found for this path in " + DEFAULT_TMP_DIR);
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
    console.error("Usage: node --experimental-strip-types run-gemini.mjs <directory> <prompt>");
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
const isMain = process.argv[1] && (
    process.argv[1] === fileURLToPath(import.meta.url) || 
    process.argv[1].endsWith('run-gemini.mjs')
);

if (isMain) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

export { GeminiRunner };