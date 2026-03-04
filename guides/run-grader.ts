import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cRed = (str: string) => `\x1b[31m${str}\x1b[0m`;
const cGreen = (str: string) => `\x1b[32m${str}\x1b[0m`;
const cYellow = (str: string) => `\x1b[33m${str}\x1b[0m`;
const cCyan = (str: string) => `\x1b[36m${str}\x1b[0m`;
const cBold = (str: string) => `\x1b[1m${str}\x1b[0m`;

export function findGrader(startDir: string): string | null {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const graderPath = path.join(currentDir, 'grader.ts');
    if (fs.existsSync(graderPath)) {
      return graderPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

export interface PlaywrightOptions {
  targetFileAbs: string;
  graderPath: string;
  reporters: string[];
  htmlOutputDir?: string;
  jsonOutputName?: string;
  stdio?: 'inherit' | 'ignore' | 'pipe';
}

export function executePlaywright(opts: PlaywrightOptions): ChildProcess {
  const playwrightConfig = path.join(__dirname, 'playwright.config.ts');
  const reporterArgs = opts.reporters.length > 0 ? ['--reporter=' + opts.reporters.join(',')] : [];
  
  const env: NodeJS.ProcessEnv = { ...process.env, TARGET_FILE: opts.targetFileAbs };
  
  if (opts.htmlOutputDir) {
    env.PLAYWRIGHT_HTML_OUTPUT_DIR = opts.htmlOutputDir;
  }
  
  if (opts.jsonOutputName) {
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = opts.jsonOutputName;
  }
  
  return spawn('pnpm', ['--silent', '--filter', 'guides', 'exec', 'playwright', 'test', '-c', playwrightConfig, opts.graderPath, ...reporterArgs], {
    stdio: opts.stdio || 'inherit',
    env
  });
}

export async function gradeFile(targetFileAbs: string): Promise<void> {
  const graderPath = findGrader(path.dirname(targetFileAbs));
  if (!graderPath) {
    console.error('Error: Could not find grader.ts in any parent directory.');
    process.exit(1);
  }

  console.log(`Target File: ${targetFileAbs}`);
  console.log(`Grader: ${graderPath}`);

  // Output the HTML report to a grade-report folder inside the target file's directory
  const outputDirPath = path.join(path.dirname(targetFileAbs), 'grade-report');

  const child = executePlaywright({
    targetFileAbs,
    graderPath,
    reporters: ['html'],
    htmlOutputDir: outputDirPath,
    stdio: 'inherit'
  });

  const [code] = await once(child, 'close');

  // Automatically show the report if tests completed or failed
  console.log(`\nTests finished with code ${code}. Opening HTML report...`);
  const showReportChild = spawn('pnpm', ['--filter', 'guides', 'exec', 'playwright', 'show-report', outputDirPath], {
    stdio: 'inherit'
  });

  await once(showReportChild, 'close');
  process.exit((code as number) || 0); // Keep original exit code
}

export async function runPlaywright(
  targetFileAbs: string, 
  graderPath: string, 
  htmlOutputDir: string, 
  stdio: 'inherit' | 'ignore' | 'pipe' = 'inherit'
): Promise<any> {
  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  
  const child = executePlaywright({
    targetFileAbs,
    graderPath,
    reporters: ['json', 'html'],
    htmlOutputDir,
    jsonOutputName: tmpJson,
    stdio
  });

  await once(child, 'close');

  const content = await fs.promises.readFile(tmpJson, 'utf-8').catch(() => null);
  if (!content) {
    throw new Error(`Playwright did not produce a JSON report at ${tmpJson}`);
  }

  await fs.promises.unlink(tmpJson).catch(() => {}); // cleanup silently
  return JSON.parse(content);
}

export interface PlaywrightSuite {
  title: string;
  specs?: Array<{ title: string; ok: boolean }>;
  suites?: PlaywrightSuite[];
}

export function printFailingSpecs(suite: PlaywrightSuite, prefix = ''): void {
  const specs = suite.specs || [];
  for (const spec of specs) {
    if (!spec.ok) { // meaning it failed/was unexpected
      console.log(cRed(`  - Failed: ${prefix}${spec.title}`));
    }
  }

  const childSuites = suite.suites || [];
  for (const child of childSuites) {
    printFailingSpecs(child, `${prefix}${child.title} > `);
  }
}

export function printPassingSpecs(suite: PlaywrightSuite, prefix = ''): void {
  const specs = suite.specs || [];
  for (const spec of specs) {
    if (spec.ok) {  // meaning it passed/was expected
      console.log(cRed(`  - Passed (should have failed): ${prefix}${spec.title}`));
    }
  }

  const childSuites = suite.suites || [];
  for (const child of childSuites) {
    printPassingSpecs(child, `${prefix}${child.title} > `);
  }
}

export async function testGrader(targetDirAbs: string): Promise<void> {
  const demoPath = path.join(targetDirAbs, 'demo.html');
  const negativePath = path.join(targetDirAbs, 'negative-demo.html');
  const graderPath = findGrader(targetDirAbs);

  if (!graderPath) {
    console.error('Error: Could not find grader.ts in the directory or any parents.');
    process.exit(1);
  }
  if (!fs.existsSync(demoPath)) {
    console.error(`Error: Missing demo.html in ${targetDirAbs}`);
    process.exit(1);
  }
  if (!fs.existsSync(negativePath)) {
    console.error(`Error: Missing negative-demo.html in ${targetDirAbs}`);
    process.exit(1);
  }

  let hasError = false;
  let demoFailed = false;
  let negativeFailed = false;

  const demoOutDir = path.join(targetDirAbs, 'grade-report', 'demo');
  const negativeOutDir = path.join(targetDirAbs, 'grade-report', 'negative');

  // 1. Test against demo.html
  console.log(cYellow(`\nRunning against demo.html... (Expecting 100% pass)`));
  
  const demoResults = await runPlaywright(demoPath, graderPath, demoOutDir, 'inherit')
    .catch(err => {
      console.error(cRed(`Failed to test demo.html: ${err.message}`));
      return null;
    });

  if (!demoResults) {
    hasError = true;
    demoFailed = true;
  } else {
    const unexpected = demoResults.stats?.unexpected || 0;
    const expected = demoResults.stats?.expected || 0;
    
    if (expected === 0 && unexpected === 0) {
      console.log(cYellow(`⚠️  Warning: No tests were run for demo.html`));
      hasError = true;
      demoFailed = true;
    } else if (unexpected > 0) {
      console.log(cRed(`❌ demo.html failed ${unexpected} tests!`));
      demoResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
      hasError = true;
      demoFailed = true;
    } else {
      console.log(cGreen(`✅ demo.html passed all ${expected} tests.`));
    }
  }

  console.log('');

  if (hasError) {
    console.log(cYellow(`Skipping negative-demo.html run due to failures in demo.html`));
  } else {
    // 2. Test against negative-demo.html
    console.log(cYellow(`Running against negative-demo.html... (Expecting 100% fail)`));
    
    const negativeResults = await runPlaywright(negativePath, graderPath, negativeOutDir, 'ignore')
      .catch(err => {
        console.error(cRed(`Failed to test negative-demo.html: ${err.message}`));
        return null;
      });

    if (!negativeResults) {
      hasError = true;
      negativeFailed = true;
    } else {
      const expected = negativeResults.stats?.expected || 0; // "expected" means tests passed in Playwright (bad for us)
      const unexpected = negativeResults.stats?.unexpected || 0; // "unexpected" means tests failed (good for us)
      
      if (expected === 0 && unexpected === 0) {
        console.log(cYellow(`⚠️  Warning: No tests were run for negative-demo.html`));
        hasError = true;
        negativeFailed = true;
      } else if (expected > 0) {
        console.log(cRed(`❌ negative-demo.html incorrectly passed ${expected} tests!`));
        negativeResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
        hasError = true;
        negativeFailed = true;
      } else {
        console.log(cGreen(`✅ negative-demo.html failed all ${unexpected} tests correctly.`));
      }
    }
  }

  console.log('');
  
  if (hasError) {
    console.log(cBold(cRed(`Failed! The grader needs calibration.`)));
    if (demoFailed) {
      console.log(`\nView demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), demoOutDir)}`);
    }
    if (negativeFailed) {
      console.log(`\nView negative-demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), negativeOutDir)}`);
    }
    process.exit(1);
  } else {
    console.log(cBold(cGreen(`Success! The grader is perfectly calibrated.`)));
    process.exit(0);
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm grade <path-to-html-file-or-guide-directory>');
    process.exit(1);
  }

  const targetPathRel = args[0];
  const targetPathAbs = path.resolve(process.cwd(), targetPathRel);

  if (!fs.existsSync(targetPathAbs)) {
    console.error(`Error: Path not found: ${targetPathAbs}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPathAbs);
  if (stat.isDirectory()) {
    console.log(cCyan(`🧪 Directory detected. Running calibration suite on the grader (demo.html & negative-demo.html)...`));
    await testGrader(targetPathAbs);
  } else if (targetPathAbs.endsWith('.html')) {
    console.log(cCyan(`📄 HTML file detected. Grading artifact and opening visual report...`));
    await gradeFile(targetPathAbs);
  } else {
    console.error(`Error: Expected a directory or an .html file.`);
    process.exit(1);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
