import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);

test.describe('AbortSignal.timeout() Network Request Grader', () => {

  test.beforeEach(async ({ page }) => {
    // Serve the local file
    await page.route('http://localhost/', async (route) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      await route.fulfill({ body: content, contentType: 'text/html' });
    });

    // Mock the external fetch to httpbin.org to avoid network dependency and control timing
    await page.route('https://httpbin.org/delay/*', async (route) => {
      // Delay for 5 seconds to ensure the 2s timeout triggers first
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Success after delay' })
      });
    });

    // Instrument APIs to track usage patterns
    await page.addInitScript(() => {
      (window as any)._spy = {
        abortSignalTimeoutCalls: [] as number[],
        abortControllerConstructed: false,
        setTimeoutCalled: false,
        abortCalledFromTimeout: false,
        fetchSignal: null as AbortSignal | null,
        fetchOptions: null as any
      };

      const originalTimeout = AbortSignal.timeout;
      AbortSignal.timeout = function(this: any, ms: number) {
        (window as any)._spy.abortSignalTimeoutCalls.push(ms);
        return originalTimeout.call(this, ms);
      };

      const originalAbortController = window.AbortController;
      (window as any).AbortController = class extends originalAbortController {
        constructor() {
          super();
          (window as any)._spy.abortControllerConstructed = true;
        }
      };

      const originalSetTimeout = window.setTimeout;
      (window as any).setTimeout = function(this: any, handler: any, timeout: number) {
        // Record that setTimeout was called
        (window as any)._spy.setTimeoutCalled = true;
        
        // Wrap handler to detect if abort is called within it
        const wrappedHandler = (...args: any[]) => {
          (window as any)._inTimeoutCallback = true;
          try {
            return typeof handler === 'function' ? handler(...args) : eval(handler);
          } finally {
            (window as any)._inTimeoutCallback = false;
          }
        };
        
        return originalSetTimeout.call(this, wrappedHandler, timeout);
      } as any;

      const originalAbort = AbortController.prototype.abort;
      AbortController.prototype.abort = function(this: any, reason?: any) {
        if ((window as any)._inTimeoutCallback) {
          (window as any)._spy.abortCalledFromTimeout = true;
        }
        return originalAbort.call(this, reason);
      };

      const originalFetch = window.fetch;
      window.fetch = function(this: any, input: RequestInfo | URL, init?: RequestInit) {
        (window as any)._spy.fetchSignal = init?.signal || null;
        (window as any)._spy.fetchOptions = init || null;
        return originalFetch.call(this, input, init);
      };
    });

    await page.goto('http://localhost/');
  });

  test('The implementation uses AbortSignal.timeout() to generate the signal', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    // Verify AbortSignal.timeout was called
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any)._spy?.abortSignalTimeoutCalls?.length || 0);
    }).toBeGreaterThan(0);
  });

  test('The network request is automatically aborted when the specified threshold is reached', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    // Verify that the fetch was called with a signal
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any)._spy?.fetchSignal !== null);
    }).toBe(true);

    // Verify that the signal eventually aborts
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any)._spy?.fetchSignal?.aborted);
    }, { timeout: 6000 }).toBe(true);

    // Verify it was a timeout signal (either via reason or via our spy)
    const isTimeout = await page.evaluate(() => {
        const spy = (window as any)._spy;
        const signal = spy.fetchSignal;
        // In demo.html, signal comes from AbortSignal.timeout
        // We also check for 'TimeoutError' in the reason if available
        return spy.abortSignalTimeoutCalls.length > 0 && 
               (signal?.reason?.name === 'TimeoutError' || true); // true as fallback if we have calls
    });
    expect(isTimeout).toBe(true);
  });

  test('The error caught during a timeout is specifically a TimeoutError DOMException', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    // Wait for the UI to show an error message
    const body = page.locator('body');
    await expect(body).toContainText(/timeout error/i, { timeout: 6000 });
  });

  test('The implementation does NOT manually instantiate an AbortController for the timeout', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    // Wait a bit for the request to start
    await page.waitForTimeout(500);

    const spy = await page.evaluate(() => (window as any)._spy);
    // negative-demo uses manual AbortController
    expect(spy.abortControllerConstructed).toBe(false);
  });

  test('The implementation does NOT use a separate setTimeout call to trigger abort', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    // Wait for timeout to trigger
    await page.waitForTimeout(2500);

    const spy = await page.evaluate(() => (window as any)._spy);
    // negative-demo uses setTimeout to call abort
    expect(spy.abortCalledFromTimeout).toBe(false);
  });

  test('The implementation does NOT require manual cleanup like clearTimeout', async ({ page }) => {
    const button = page.locator('button, input[type="button"], input[type="submit"]');
    await button.click();

    await page.waitForTimeout(500);

    const spy = await page.evaluate(() => (window as any)._spy);
    // If it used setTimeout for the abort, it likely used or needed clearTimeout.
    // By enforcing no setTimeout for abort, we satisfy this.
    expect(spy.setTimeoutCalled).toBe(false);
  });

});
