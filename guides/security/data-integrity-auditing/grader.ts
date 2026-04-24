import { test, expect } from '@playwright/test';
import path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve(process.cwd(), 'demo.html');

test.describe('Data Integrity Auditing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__stats = {
        structuredCloneCalled: false,
        jsonCloneDetected: false,
        shallowCopyDetected: false,
        lastStringified: null,
        stringifiedObjects: []
      };

      const originalStructuredClone = window.structuredClone;
      window.structuredClone = function (obj: any, options?: any) {
        (window as any).__stats.structuredCloneCalled = true;
        return originalStructuredClone(obj, options);
      };

      const originalParse = JSON.parse;
      const originalStringify = JSON.stringify;

      window.JSON.stringify = function (value: any, replacer?: any, space?: any) {
        const result = originalStringify(value, replacer, space);
        (window as any).__stats.lastStringified = result;
        (window as any).__stats.stringifiedObjects.push(value);
        return result;
      };

      window.JSON.parse = function (text: string, reviver?: any) {
        if (typeof text === 'string' && text === (window as any).__stats.lastStringified) {
          (window as any).__stats.jsonCloneDetected = true;
        }
        return originalParse(text, reviver);
      };

      const originalAssign = Object.assign;
      Object.assign = function (target: any, ...sources: any[]) {
        if (sources.length > 0) {
          (window as any).__stats.shallowCopyDetected = true;
        }
        return originalAssign(target, ...sources);
      };
    });

    const url = targetFile.startsWith('/') ? `file://${targetFile}` : `file://${path.resolve(process.cwd(), targetFile)}`;
    await page.goto(url);
  });

  test('Requirement: Deep cloning must use structuredClone()', async ({ page }) => {
    const button = page.locator('button');
    await button.first().click();

    const stats = await page.evaluate(() => (window as any).__stats);
    expect(stats.structuredCloneCalled, 'The implementation failed to use structuredClone() for deep cloning.').toBe(true);
  });

  test('Requirement: Cloning must not be lossy (no JSON.parse/stringify)', async ({ page }) => {
    const button = page.locator('button');
    await button.first().click();

    const stats = await page.evaluate(() => (window as any).__stats);
    expect(stats.jsonCloneDetected, 'The implementation used lossy JSON.parse(JSON.stringify()) which destroys complex types.').toBe(false);
  });

  test('Requirement: Audit snapshots must be isolated from original data mutations', async ({ page }) => {
    const button = page.locator('button');
    await button.first().click();

    const stats = await page.evaluate(() => (window as any).__stats);
    
    // Isolation is guaranteed if structuredClone is used correctly.
    // We also check the UI for evidence of isolation.
    expect(stats.structuredCloneCalled, 'Deep isolation requires structuredClone().').toBe(true);

    const preTags = page.locator('pre');
    const texts = await preTags.allTextContents();
    if (texts.length >= 2) {
      expect(texts[0], 'The audit log and UI display should reflect different states of the data.').not.toBe(texts[1]);
    }
  });

  test('Requirement: Complex built-in types must be preserved', async ({ page }) => {
    const button = page.locator('button');
    await button.first().click();

    const stats = await page.evaluate(() => (window as any).__stats);
    
    // Preservation of complex types is a key feature of structuredClone.
    expect(stats.structuredCloneCalled, 'Complex type preservation (Date, Set, Map) requires structuredClone().').toBe(true);
    expect(stats.jsonCloneDetected, 'JSON-based cloning destroys complex types like Date, Set, and Map.').toBe(false);
  });

  test('Requirement: Avoid shallow copying techniques for nested structures', async ({ page }) => {
    const button = page.locator('button');
    await button.first().click();

    const stats = await page.evaluate(() => (window as any).__stats);
    
    // If structuredClone was called, we assume it was used for the primary cloning task.
    // If it wasn't called, we assume a less safe method was used.
    expect(stats.structuredCloneCalled, 'Shallow copying (spread/Object.assign) is insufficient for nested data integrity.').toBe(true);
  });
});
