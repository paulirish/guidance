import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedHome, copySkills, cleanupIsolatedHome } from '../lib/agent-shared.ts';
import { Agents } from '../config.ts';

test('createIsolatedHome and cleanup', () => {
  const tempHome = createIsolatedHome('test-isolation');
  assert.ok(fs.existsSync(tempHome), 'Temp home should exist');
  assert.match(tempHome, /^\/tmp\/test-isolation-/);

  cleanupIsolatedHome(tempHome);
  assert.ok(!fs.existsSync(tempHome), 'Temp home should be removed');
});

test('copySkills (disciplines mode)', () => {
  const tempHome = createIsolatedHome('test-skills-discipline');
  
  const success = copySkills(tempHome, Agents.JETSKI, false);
  assert.ok(success, 'copySkills should succeed');

  const destDir = path.join(tempHome, '.gemini', 'jetski', 'skills');
  assert.ok(fs.existsSync(destDir), 'Skills dir should exist');

  // Verify at least one skill was copied (subdirectories with SKILL.md)
  const dirs = fs.readdirSync(destDir);
  assert.ok(dirs.length > 0, 'Should have copied some skills');

  cleanupIsolatedHome(tempHome);
});

test('copySkills (cli mode)', () => {
  const tempHome = createIsolatedHome('test-skills-cli');
  
  const success = copySkills(tempHome, Agents.JETSKI, true);
  assert.ok(success, 'copySkills should succeed');

  const destDir = path.join(tempHome, '.gemini', 'jetski', 'skills', 'modern-web-use-cases');
  assert.ok(fs.existsSync(destDir), 'modern-web-use-cases should exist');
  assert.ok(fs.existsSync(path.join(destDir, 'SKILL.md')), 'SKILL.md should exist');
  
  // The vector_store and guides should be copied as part of the directory
  assert.ok(fs.existsSync(path.join(destDir, 'vector_store')), 'vector_store should exist');
  assert.ok(fs.existsSync(path.join(destDir, 'guides')), 'guides should exist');

  cleanupIsolatedHome(tempHome);
});
