#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import omelette from 'omelette';
import { fileURLToPath } from 'url';
import { cRed, cCyan, cBold, cDim } from '../lib/colors.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables (Node 20.12+)
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  // Ignore if file doesn't exist
}

// --- Configuration ---

const ALL_OPTIONS = {
  help: { type: 'boolean', short: 'h', desc: 'Show this help' },
  version: { type: 'boolean', short: 'v', desc: 'Show version' },
  grade: { type: 'boolean', desc: 'Run/calibrate grader' },
  'test-grader': { type: 'boolean', desc: 'Check grader calibration (demo + negative-demo)' },
  'gen-grader': { type: 'boolean', desc: 'Generate a new grader script' },
  'gen-negative': { type: 'boolean', desc: 'Generate negative examples' },
  guided: { type: 'boolean', desc: 'Skip calibration, run guided agent test only' },
  'no-test': { type: 'boolean', desc: 'Skip agent tests after calibration' },
  verbose: { type: 'boolean', desc: 'Show additional output' },
  usecases: { type: 'boolean', desc: '(Audit) Group by categories/usecases (default is features)' },
  agent: { type: 'string', desc: '(Eval) Set agent (e.g. claude_code, jetski, gemini_cli)' },
  numRuns: { type: 'string', desc: '(Eval) Number of runs per task' },
  negative: { type: 'boolean', desc: '(Eval) Run negative suite tasks' },
  enableSkills: { type: 'boolean', desc: '(Eval) Enable agent skills' },
  mcpServers: { type: 'string', desc: '(Eval) Comma-separated list of MCP servers' },
} as const;

type OptionName = keyof typeof ALL_OPTIONS;

/**
 * COMMAND_METADATA defines the structure of each command, its description, and its flags.
 * This acts as the single source of truth for completion, help, and (soon) argument validation.
 */
const COMMAND_METADATA = {
  dev: {
    desc: 'Auto-generate and calibrate guide artifacts',
    flags: ['grade', 'test-grader', 'gen-grader', 'gen-negative', 'guided', 'no-test', 'verbose'],
  },
  'dev-all': {
    desc: 'Run dev-guide pipeline for all guides',
    flags: ['verbose'],
  },
  eval: {
    desc: 'Run the full evaluation suite, or specific tasks',
    flags: ['agent', 'numRuns', 'negative', 'enableSkills', 'mcpServers', 'verbose'],
  },
  audit: {
    desc: 'Show status of all guides',
    flags: ['usecases'],
  },
  run: {
    desc: 'Run an ad-hoc agent test against a template',
    flags: ['verbose'],
  },
  dashboard: { desc: 'Start the evaluation dashboard', flags: [] },
  deploy: { desc: 'Deploy the dashboard to GitHub Pages', flags: [] },
  upload: { desc: 'Upload generated evaluation suite to GCS', flags: [] },
  baselinestatus: { desc: 'Check browser support and Baseline status', flags: [] },
  'setup-completion': { desc: 'Install shell auto-completion', flags: [] },
  'gen-negative-suite': { desc: 'Generate resources for negative suite', flags: [] },
} satisfies Record<string, { desc: string; flags: OptionName[] }>;

const COMMANDS = Object.keys(COMMAND_METADATA);
type CommandName = keyof typeof COMMAND_METADATA;

// --- Shell Auto-Completion ---

function listGuideDirs(): string[] {
  const guidesDir = path.join(rootDir, 'guides');
  if (!fs.existsSync(guidesDir)) return [];
  const categories = fs.readdirSync(guidesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);
  const dirs: string[] = [];
  for (const cat of categories) {
    const catDir = path.join(guidesDir, cat);
    if (!fs.existsSync(catDir)) continue;
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(`guides/${cat}/${entry.name}`);
    }
  }
  return dirs;
}

const completion = omelette('gd <command> <arg1> <arg2> <arg3> <arg4> <arg5>');

completion.on('command', ({ reply }) => {
  reply(COMMANDS);
});

function getFlagsForLine(line: string): string[] {
  const parts = line.split(/\s+/).filter(Boolean);
  const cmd = parts[1] as CommandName; // gd <cmd>
  const meta = COMMAND_METADATA[cmd];
  return meta ? meta.flags.map(f => '--' + f) : [];
}

completion.on('arg1', ({ before, line, reply }) => {
  const flags = getFlagsForLine(line);
  if (before === 'eval') {
    const tasksDir = path.join(rootDir, 'harness', 'tasks');
    const tasks = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')) : [];
    reply(['suite', ...tasks, ...flags]);
  } else if (before === 'gen') {
    reply(['grader', 'negative']);
  } else if (before === 'audit') {
    reply(flags);
  } else if (['dev', 'test', 'grade'].includes(before)) {
    reply([...listGuideDirs(), ...flags]);
  } else {
    reply(flags);
  }
});

completion.on('arg2', ({ before, line, reply }) => {
  const flags = getFlagsForLine(line);
  if (line.includes('gd eval')) {
    reply(flags);
  } else if (line.includes('gd dev') && before.startsWith('guides/')) {
    reply(flags);
  } else if (before === 'run') {
    const baseAppsDir = path.join(rootDir, 'harness', 'base_apps');
    if (fs.existsSync(baseAppsDir)) {
      reply(fs.readdirSync(baseAppsDir).filter(d => fs.statSync(path.join(baseAppsDir, d)).isDirectory()));
    }
  } else if (['grader', 'negative'].includes(before) && line.includes('gen')) {
    reply(listGuideDirs());
  } else {
    reply(flags);
  }
});

completion.on('arg3', ({ line, reply }) => reply(getFlagsForLine(line)));
completion.on('arg4', ({ line, reply }) => reply(getFlagsForLine(line)));
completion.on('arg5', ({ line, reply }) => reply(getFlagsForLine(line)));

completion.init();

// --- Argument Parsing ---

const parseOptions: any = {};
for (const [key, val] of Object.entries(ALL_OPTIONS)) {
  parseOptions[key] = { type: val.type };
  if ((val as any).short) parseOptions[key].short = (val as any).short;
}

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: parseOptions,
  allowPositionals: true,
  strict: false,
});

// --- Helpers ---

function spawnChild(command: string, args: string[], options: import('child_process').SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: 'inherit', cwd: rootDir, ...options });
    p.on('close', (code) => resolve(code ?? 0));
    p.on('error', (err) => reject(err));
  });
}

function runNpm(args: string[]) {
  return spawnChild('pnpm', args);
}

function requireArg(arg: string | undefined, usage: string): string {
  if (!arg) {
    console.error(`${cRed('Missing argument.')} Usage: ${usage}`);
    process.exit(1);
  }
  return arg;
}

// --- Command Routing ---

async function main() {
  const command = positionals[0];

  if (values.help || !command) {
    console.log(`
${cBold('Guidance CLI')}

${cCyan('Usage:')} gd <command> [options]

${cBold('Commands:')}
${Object.entries(COMMAND_METADATA).map(([cmd, meta]) => {
  const flags = meta.flags.length > 0 ? ' [options]' : '';
  return `  ${cCyan(cmd.padEnd(18))} ${meta.desc}${flags}`;
}).join('\n')}

${cBold('Options:')}
${Object.entries(ALL_OPTIONS).map(([name, opt]) => {
  const short = opt.short ? `-${opt.short}, ` : '    ';
  return `  ${cDim(`${short}--${name.padEnd(15)}`)} ${opt.desc}`;
}).join('\n')}
    `);
    process.exit(0);
  }

  switch (command) {
    case 'setup-completion': {
      completion.setupShellInitFile();
      console.log('Auto-completion installed. Restart your terminal to apply.');
      process.exit(0);
    }

    case 'dev': {
      const dir = requireArg(positionals[1], 'gd dev <path/to/guide>');
      if (values.grade) {
        const { gradeFile } = await import('../guides/run-grader.ts');
        await gradeFile(path.resolve(process.cwd(), dir));
        break;
      }
      if (values['test-grader']) {
        const { testGrader } = await import('../guides/test-grader.ts');
        const result = await testGrader(dir);
        process.exit(result.success ? 0 : 1);
      }
      if (values['gen-grader']) {
        const { generateGrader } = await import('../guides/grader-gen.ts');
        await generateGrader(dir);
        break;
      }
      if (values['gen-negative']) {
        const { generateNegative } = await import('../guides/negative-gen.ts');
        await generateNegative(dir);
        break;
      }
      // Default dev-guide pipeline
      const { devGuide } = await import('../guides/dev-guide.ts');
      const success = await devGuide(dir, {
        guidedOnly: !!values.guided,
        verbose: !!values.verbose,
      });
      process.exit(success ? 0 : 1);
    }

    // not documented because it's UBER-powerful.
    case 'dev-all': {
      const { devAll } = await import('../guides/dev-guide.ts');
      await devAll({ verbose: !!values.verbose });
      break;
    }

    case 'audit': {
      const { auditGuides } = await import('../guides/dev-guide.ts');
      auditGuides({ groupByUsecases: !!values.usecases });
      break;
    }
    
    case 'run': {
      const tmpl = requireArg(positionals[1], 'gd run <template> <prompt>');
      const prompt = requireArg(positionals[2], 'gd run <template> <prompt>');
      const { runAgent } = await import('../harness/run_suite.ts');
      await runAgent(tmpl, prompt);
      break;
    }

    case 'dashboard': {
      process.chdir(path.join(rootDir, 'eval-view'));
      await import('../eval-view/server.js');
      break;
    }

    case 'eval': {
      const action = positionals[1] || 'suite';
      
      if (action === 'dashboard') {
        console.error(`${cRed(`'gd eval dashboard' has moved.`)} Run: ${cCyan(`gd dashboard`)}\n`);
        process.exit(1);
      }
      
      const buildCode = await runNpm(['build:mcp']);
      if (buildCode !== 0) process.exit(buildCode);
      const { runSuite } = await import('../harness/run_suite.ts');

      const tasks = positionals.slice(1).filter(a => a !== 'suite');
      const overrides: any = {};
      if (values.agent) overrides.agent = values.agent;
      if (values.numRuns) overrides.numRuns = parseInt(values.numRuns as string, 10);
      if (values.negative) overrides.negative = values.negative;
      if (values.enableSkills) overrides.enableSkills = values.enableSkills;
      if (values.mcpServers) overrides.mcpServersToEnable = (values.mcpServers as string).split(',');
      if (process.env.SUITE_AGENT) overrides.agent = process.env.SUITE_AGENT;
      if (process.env.SUITE_NUM_RUNS) overrides.numRuns = parseInt(process.env.SUITE_NUM_RUNS, 10);
      if (process.env.SUITE_NEGATIVE) overrides.negative = process.env.SUITE_NEGATIVE === 'true';

      const runOptions: any = { overrides };
      if (tasks.length > 0) runOptions.tasks = tasks;

      await runSuite(runOptions);
      break;
    }

    case 'upload': {
      const args = positionals.slice(1);
      const code = await runNpm(['upload', ...args]);
      process.exit(code);
    }

    case 'deploy': {
      const code = await runNpm(['deploy:dashboard']);
      process.exit(code);
    }

    case 'baselinestatus': {
      const args = positionals.slice(1);
      const code = await runNpm(['baselinestatus', ...args]);
      process.exit(code);
    }

    case 'gen-negative-suite': {
      const { generateNegativeSuite } = await import('../guides/negative-suite-gen.ts');
      await generateNegativeSuite();
      break;
    }

    default: {
      // Legacy fallbacks — guide namespace was flattened
      if (command === 'guide') {
        const action = positionals[1] || '';
        const remap: Record<string, string> = {
          'dev': 'dev', 'dev-all': 'dev-all', 'grade': 'grade',
          'test-grader': 'test', 'gen-grader': 'gen grader', 'gen-negative': 'gen negative',
        };
        if (remap[action]) {
          const rest = positionals.slice(2).join(' ');
          console.error(`${cRed(`'gd guide ${action}' has moved.`)}  Run: ${cCyan(`gd ${remap[action]}${rest ? ' ' + rest : ''}`)}\n`);
        } else {
          console.error(`${cRed(`The 'guide' namespace has been removed.`)} Run ${cCyan('gd --help')} for the new commands.\n`);
        }
      } else if (['suite', 'task', 'smoke', 'report'].includes(command)) {
        console.error(`${cRed(`'gd ${command}' has moved.`)}  Run: ${cCyan(`gd eval ${command}`)}\n`);
      } else if (command === 'agent') {
        console.error(`${cRed(`'gd agent' has moved.`)}  Run: ${cCyan(`gd run <template> <prompt>`)}\n`);
      } else if (['grade'].includes(command)) {
        console.error(`${cRed(`'gd grade' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --grade`)}\n`);
      } else if (['test', 'test-grader'].includes(command)) {
        console.error(`${cRed(`'gd test' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --test-grader`)}\n`);
      } else if (['gen', 'gen-grader', 'gen-negative', 'gen:grader', 'gen:negative'].includes(command)) {
        console.error(`${cRed(`'gd ${command}' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --gen-grader`)} or ${cCyan(`--gen-negative`)}\n`);
      } else {
        console.error(`${cRed(`Unknown command: ${command}.`)} Run ${cCyan('gd --help')} for usage.`);
      }
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
