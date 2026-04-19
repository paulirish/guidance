import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Target file configuration
const targetFile = process.env.TARGET_FILE || 'demo.html';
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

// Define fixture type
type MyFixtures = {
  TARGET_URL: string;
};

// Extend base test
const test = base.extend<MyFixtures>({
  TARGET_URL: async ({}, use) => {
    // We'll use a local URL and intercept it in beforeEach
    await use(`http://localhost/${demoName}`);
  },
});

test.describe(`AbortSignal.timeout() Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Intercept requests to serve the local file
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      
      if (requestPath === '/' || requestPath === `/${demoName}`) {
        const content = fs.readFileSync(filePath, 'utf-8');
        await route.fulfill({
          contentType: 'text/html',
          body: content,
        });
      } else {
        const localFilePath = path.join(targetDir, requestPath);
        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      }
    });

    // Spy on APIs before navigation to verify usage patterns
    await page.addInitScript(() => {
      const originalTimeout = AbortSignal.timeout;
      (window as any)._abortSignalTimeoutCalled = false;
      (window as any)._lastSignal = null;
      (window as any)._signalHasListeners = false;
      (window as any)._signalUsedInFetch = false;
      
      AbortSignal.timeout = function(ms: number) {
        (window as any)._abortSignalTimeoutCalled = true;
        const signal = originalTimeout.call(AbortSignal, ms);
        (window as any)._lastSignal = signal;
        
        const originalAddEventListener = signal.addEventListener;
        signal.addEventListener = function(type: string, listener: any, options: any) {
          if (type === 'abort') {
            (window as any)._signalHasListeners = true;
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
        
        return signal;
      };

      const originalFetch = window.fetch;
      window.fetch = function(input: any, init: any) {
        if (init && init.signal === (window as any)._lastSignal) {
          (window as any)._signalUsedInFetch = true;
        }
        return originalFetch.call(this, input, init);
      };

      const originalAbort = AbortController.prototype.abort;
      (window as any)._abortControllerAbortCalled = false;
      AbortController.prototype.abort = function(reason?: any) {
        (window as any)._abortControllerAbortCalled = true;
        return originalAbort.call(this, reason);
      };
    });

    await page.goto(TARGET_URL);
  });

  test('The implementation utilizes AbortSignal.timeout() to create the cancellation signal', async ({ page }) => {
    const startBtn = page.locator('#start-btn, #runBtn');
    await startBtn.click();

    // Allow time for the task to initialize and call AbortSignal.timeout()
    await page.waitForTimeout(500);

    const usedNativeTimeout = await page.evaluate(() => (window as any)._abortSignalTimeoutCalled);
    expect(usedNativeTimeout, 'AbortSignal.timeout() should be called').toBe(true);
  });

  test('The asynchronous task respects the AbortSignal and stops work upon timeout', async ({ page }) => {
    const startBtn = page.locator('#start-btn, #runBtn');
    await startBtn.click();

    // Wait past the common 2s budget
    await page.waitForTimeout(2500);

    // Verify signal was not only created but also had listeners or was passed to fetch
    const signalWasUsed = await page.evaluate(() => {
        return (window as any)._abortSignalTimeoutCalled && 
               ((window as any)._signalHasListeners || (window as any)._signalUsedInFetch);
    });
    expect(signalWasUsed, 'The task must use and respect the AbortSignal').toBe(true);

    const logs = await page.evaluate(() => document.querySelector('.console, #log')?.textContent || '');
    // Ensure the task didn't finish successfully despite the timeout
    expect(logs).not.toContain('Completed step: Heavy Processing');
    
    await page.waitForTimeout(1000);
    const finalLogs = await page.evaluate(() => document.querySelector('.console, #log')?.textContent || '');
    expect(finalLogs.toLowerCase()).not.toContain('success');
  });

  test('The application correctly identifies and handles the TimeoutError DOMException', async ({ page }) => {
    const startBtn = page.locator('#start-btn, #runBtn');
    await startBtn.click();

    await page.waitForTimeout(2500);

    const statusText = await page.textContent('#status-badge, #status');
    // Ensure the UI reflects a timeout specifically
    expect(statusText?.toLowerCase()).toMatch(/time.*out/);
  });

  test('The implementation does not use a manual setTimeout() to trigger AbortController.abort()', async ({ page }) => {
    const startBtn = page.locator('#start-btn, #runBtn');
    await startBtn.click();

    await page.waitForTimeout(500);

    const abortCalled = await page.evaluate(() => (window as any)._abortControllerAbortCalled);
    const nativeTimeoutCalled = await page.evaluate(() => (window as any)._abortSignalTimeoutCalled);

    // If a timeout occurred via AbortController, it must have used the native AbortSignal.timeout
    if (abortCalled && !nativeTimeoutCalled) {
        throw new Error('Manual setTimeout() used to trigger AbortController.abort()');
    }

    expect(nativeTimeoutCalled, 'Must use AbortSignal.timeout() instead of manual timers').toBe(true);
  });

  test('The implementation propagates the cancellation signal to underlying operations', async ({ page }) => {
    const startBtn = page.locator('#start-btn, #runBtn');
    await startBtn.click();

    await page.waitForTimeout(2500);

    const signalWasUsed = await page.evaluate(() => {
        return (window as any)._abortSignalTimeoutCalled && 
               ((window as any)._signalHasListeners || (window as any)._signalUsedInFetch);
    });
    
    expect(signalWasUsed, 'The AbortSignal from timeout should be passed to operations').toBe(true);
    
    const logs = await page.evaluate(() => document.querySelector('.console, #log')?.textContent || '');
    // Check for negative patterns that indicate lack of propagation
    expect(logs).not.toContain('Processing part 2'); 
  });

});
