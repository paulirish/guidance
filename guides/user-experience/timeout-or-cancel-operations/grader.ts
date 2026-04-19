import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

// Extend the base test to include TARGET_URL and handle the environment
const test = base.extend<{ TARGET_URL: string }>({
  TARGET_URL: async ({}, use) => {
    await use('http://localhost/');
  },
});

test.describe(`AbortSignal.timeout() Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Mock local files
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // Inject spies
    await page.addInitScript(() => {
      (window as any).__apiCalls = {
        timeoutCalled: false,
        anyCalled: false,
        manualTimeoutDetected: false,
      };

      const originalTimeout = AbortSignal.timeout;
      AbortSignal.timeout = function(ms: number) {
        (window as any).__apiCalls.timeoutCalled = true;
        return originalTimeout.call(AbortSignal, ms);
      };

      const originalAny = AbortSignal.any;
      AbortSignal.any = function(signals: AbortSignal[]) {
        (window as any).__apiCalls.anyCalled = true;
        return originalAny.call(AbortSignal, signals);
      };

      let inSetTimeout = false;
      const originalSetTimeout = window.setTimeout;
      (window as any).setTimeout = function(cb: any, ms: number) {
        if (typeof cb === 'function') {
          const wrappedCb = (...args: any[]) => {
            inSetTimeout = true;
            try {
              return cb(...args);
            } finally {
              inSetTimeout = false;
            }
          };
          return originalSetTimeout(wrappedCb, ms);
        }
        return originalSetTimeout(cb, ms);
      };

      const originalAbort = AbortController.prototype.abort;
      AbortController.prototype.abort = function() {
        if (inSetTimeout) {
          (window as any).__apiCalls.manualTimeoutDetected = true;
        }
        return originalAbort.apply(this, arguments as any);
      };
    });

    await page.goto(TARGET_URL);
  });

  test('The implementation uses AbortSignal.timeout()', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    const timeoutCalled = await page.evaluate(() => (window as any).__apiCalls.timeoutCalled);
    expect(timeoutCalled).toBe(true);
  });

  test('The implementation uses AbortSignal.any()', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    const anyCalled = await page.evaluate(() => (window as any).__apiCalls.anyCalled);
    expect(anyCalled).toBe(true);
  });

  test('The implementation does not use manual setTimeout to call abort()', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    await page.waitForTimeout(4000);
    const manualTimeoutDetected = await page.evaluate(() => (window as any).__apiCalls.manualTimeoutDetected);
    expect(manualTimeoutDetected).toBe(false);
  });

  test('The operation is successfully aborted when the time limit is reached', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    await page.waitForTimeout(6000);
    const content = await page.locator('body').innerText();
    expect(content.toLowerCase()).toContain('timed out');
  });

  test('The operation is successfully aborted when the user-initiated signal is triggered', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /cancel|stop/i }).click();
    const content = await page.locator('body').innerText();
    expect(content.toLowerCase()).toContain('user');
  });

  test('The timeout abort is mediated by AbortSignal.any()', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    await page.waitForTimeout(6000);
    const anyCalled = await page.evaluate(() => (window as any).__apiCalls.anyCalled);
    expect(anyCalled).toBe(true);
  });

  test('The user-initiated abort is mediated by AbortSignal.any()', async ({ page }) => {
    await page.getByRole('button', { name: /start|run/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /cancel|stop/i }).click();
    const anyCalled = await page.evaluate(() => (window as any).__apiCalls.anyCalled);
    expect(anyCalled).toBe(true);
  });

});
