
import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const OUT_DIR = path.join(ROOT_DIR, 'build/cli-tools');

async function build() {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }

  try {
    const result = await esbuild.build({
      entryPoints: [
        path.join(ROOT_DIR, 'src/cli/search.ts'),
        path.join(ROOT_DIR, 'src/cli/retrieve.ts')
      ],
      outdir: OUT_DIR,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      packages: 'external', // Exclude all dependencies
      sourcemap: true,
      logLevel: 'info',
    });

    console.log('CLI tools built successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
