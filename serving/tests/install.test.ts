import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/
const DIST_SKILL_DIR = path.join(ROOT_DIR, "dist/skills-cli/skills/modern-web-use-cases");

test('Simulation of User Installation outside workspace', async () => {
  // 1. Ensure dist is built (similar to test-dist.test.ts)
  execSync('node --experimental-strip-types skills-cli/build-dist.ts', { 
    cwd: path.resolve(import.meta.dirname, '..'), 
    stdio: 'inherit' 
  });

  assert.ok(fs.existsSync(DIST_SKILL_DIR), 'Dist skill dir should exist');

  // 2. Create a temporary directory outside the repo
  const tempUserHome = path.join('/tmp', `temp-user-home-${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(tempUserHome, { recursive: true });

  const destSkillDir = path.join(tempUserHome, 'skills', 'modern-web-use-cases');
  fs.mkdirSync(path.dirname(destSkillDir), { recursive: true });

  // 3. Copy the skill folder to the temp user home
  fs.cpSync(DIST_SKILL_DIR, destSkillDir, { recursive: true });

  const binaryPath = path.join(destSkillDir, 'modern-web.mjs');
  assert.ok(fs.existsSync(binaryPath), 'Binary should exist in temp home');

  try {
    // 4. Run search from the temp home
    const searchOut = execSync(`node "${binaryPath}" --search "address form"`, { 
      encoding: 'utf8',
      cwd: tempUserHome 
    });
    
    const searchResults = JSON.parse(searchOut);
    assert.ok(Array.isArray(searchResults), 'Search output should be a JSON array');
    assert.ok(searchResults.length > 0, 'Should return at least one search result');

    // 5. Run retrieve
    const retrieveOut = execSync(`node "${binaryPath}" --retrieve accessible-error-announcement`, { 
      encoding: 'utf8',
      cwd: tempUserHome
    });
    assert.match(retrieveOut, /# Accessible Error/, 'Retrieve output should contain the guide title');

  } finally {
    // 6. Clean up
    fs.rmSync(tempUserHome, { recursive: true, force: true });
  }
});
