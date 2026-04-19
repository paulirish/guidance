import { test as base, expect } from '@playwright/test';
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';

/**
 * Grader for AbortSignal.timeout() expectations.
 * This script verifies that the application uses the native AbortSignal.timeout API
 * and handles the resulting TimeoutError correctly, while avoiding anti-patterns
 * like manual setTimeout/AbortController pairs or Promise.race() for timeouts.
 */

// Setup from environment
// @ts-ignore
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

// @ts-ignore
const filePath = path.resolve(targetFile);
// @ts-ignore
const targetDir = path.dirname(filePath);
// @ts-ignore
const demoName = path.basename(filePath);

// Extend the test object to include a mock TARGET_URL
const test = base.extend<{ TARGET_URL: string }>({
  TARGET_URL: async ({}, use) => {
    await use('http://localhost/');
  },
});

declare global {
  interface Window {
    __abortSignalTimeoutCalled: boolean;
    __manualAbortCalled: boolean;
    __promiseRaceCalled: boolean;
  }
}

test.describe(`AbortSignal.timeout() Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Serve the local file at the mock URL
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    // Inject spies to monitor API usage
    await page.addInitScript(() => {
      window.__abortSignalTimeoutCalled = false;
      window.__manualAbortCalled = false;
      window.__promiseRaceCalled = false;

      // Spy on AbortSignal.timeout
      const originalTimeout = (AbortSignal as any).timeout;
      if (typeof originalTimeout === 'function') {
        (AbortSignal as any).timeout = function(ms: number) {
          window.__abortSignalTimeoutCalled = true;
          return originalTimeout.call(AbortSignal, ms);
        };
      }

      // Spy on AbortController.prototype.abort to detect manual cancellation triggers
      const originalAbort = AbortController.prototype.abort;
      AbortController.prototype.abort = function(this: AbortController, reason?: any) {
        window.__manualAbortCalled = true;
        return originalAbort.call(this, reason);
      };

      // Spy on Promise.race to detect the timer promise anti-pattern
      const originalRace = Promise.race;
      (Promise as any).race = function(this: typeof Promise, values: any) {
        window.__promiseRaceCalled = true;
        return originalRace.call(this, values);
      };
    });

    await page.goto(TARGET_URL);
  });

  test('The implementation utilizes AbortSignal.timeout() to create the cancellation signal', async ({ page }) => {
    // Locate the start button - using a broad selector to be app-agnostic
    const startButton = page.locator('button').first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Give some time for the task to initiate and call the API
    await page.waitForTimeout(500);

    const utilized = await page.evaluate(() => window.__abortSignalTimeoutCalled);
    expect(utilized, 'AbortSignal.timeout() should be called to create the signal.').toBe(true);
  });

  test('The application correctly identifies and handles the TimeoutError when the signal triggers', async ({ page }) => {
    const startButton = page.locator('button').first();
    await startButton.click();

    // Wait for the timeout to occur (demos use ~2s budget)
    // We wait slightly longer than the expected timeout.
    await page.waitForTimeout(3000);

    // Check for "Timed Out" in the UI, which indicates the application recognized the specific error
    const statusText = await page.evaluate(() => {
      // Look for common status containers
      const el = document.querySelector('.test-status') || 
                 document.querySelector('#status') || 
                 document.querySelector('[class*="status"]') ||
                 document.body;
      return el ? el.textContent : '';
    });

    expect(statusText).toMatch(/Timed Out/i);
  });

  test('The implementation does not use a manual setTimeout() to trigger AbortController.abort()', async ({ page }) => {
    const startButton = page.locator('button').first();
    await startButton.click();
    
    // Wait long enough for potential manual timeouts to fire (negative demo uses 2s)
    await page.waitForTimeout(3000);

    const manualAbort = await page.evaluate(() => window.__manualAbortCalled);
    expect(manualAbort, 'Manual AbortController.abort() should not be used when AbortSignal.timeout() is sufficient.').toBe(false);
  });

  test('The implementation does not use Promise.race() with a timer for timeout management', async ({ page }) => {
    const startButton = page.locator('button').first();
    await startButton.click();
    
    // Negative demo calls Promise.race immediately, but we wait to be consistent
    await page.waitForTimeout(3000);

    const promiseRace = await page.evaluate(() => window.__promiseRaceCalled);
    expect(promiseRace, 'Promise.race() should not be used as a substitute for signal-based cancellation.').toBe(false);
  });

  test('Asynchronous tasks receive and respect the AbortSignal', async ({ page }) => {
    // We verify this by checking if the task stops early (around 2s) 
    // instead of running to completion (3s).
    const startButton = page.locator('button').first();
    
    const startTime = Date.now();
    await startButton.click();
    
    // Wait for the "Timed Out" status to appear
    await page.waitForFunction(() => {
      const el = document.querySelector('.test-status') || 
                 document.querySelector('#status') || 
                 document.querySelector('[class*="status"]');
      return el && el.textContent && /Timed Out/i.test(el.textContent);
    }, { timeout: 5000 });
    
    const duration = Date.now() - startTime;
    
    // The task should have aborted around 2000ms. 
    // If it didn't respect the signal, it would either hang or take 3000ms+
    expect(duration).toBeLessThan(2800);
    expect(duration).toBeGreaterThan(1500);
  });

});
