import { test, expect } from '@playwright/test';
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

test.describe(`AbortSignal.timeout() Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Mock localhost to serve the target file
    const TARGET_URL = 'http://localhost/';
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // Inject spies
    await page.addInitScript(() => {
      (window as any).__spy = {
        timeoutCalled: false,
        signalUsed: false,
        removeCalled: false,
        controllerCreated: false
      };

      // Spy on AbortSignal.timeout
      if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
        const originalTimeout = AbortSignal.timeout;
        AbortSignal.timeout = function(ms: number) {
          (window as any).__spy.timeoutCalled = true;
          return originalTimeout.call(AbortSignal, ms);
        };
      }

      // Spy on addEventListener
      const originalAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type: string, listener: any, options: any) {
        if (options && typeof options === 'object' && options.signal instanceof AbortSignal) {
          (window as any).__spy.signalUsed = true;
        }
        return originalAdd.apply(this, arguments as any);
      };

      // Spy on removeEventListener
      const originalRemove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.removeEventListener = function(type: string, listener: any, options: any) {
        (window as any).__spy.removeCalled = true;
        return originalRemove.apply(this, arguments as any);
      };

      // Spy on AbortController
      const originalController = window.AbortController;
      (window as any).AbortController = function() {
        (window as any).__spy.controllerCreated = true;
        return new originalController();
      };
      (window as any).AbortController.prototype = originalController.prototype;
    });

    await page.goto(TARGET_URL);
  });

  const triggerSelector = '.test-start-btn, #trigger';
  const targetSelector = '.test-target-btn, #target';

  test('utilizes AbortSignal.timeout() to generate a signal', async ({ page }) => {
    await page.click(triggerSelector);
    const used = await page.evaluate(() => (window as any).__spy.timeoutCalled);
    expect(used).toBe(true);
  });

  test('registers event listener using the signal property', async ({ page }) => {
    await page.click(triggerSelector);
    const used = await page.evaluate(() => (window as any).__spy.signalUsed);
    expect(used).toBe(true);
  });

  test('automatically deactivates after timeout duration via AbortSignal', async ({ page }) => {
    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount++;
      await dialog.dismiss();
    });

    await page.click(triggerSelector);
    
    // Test active state
    await page.click(targetSelector);
    expect(dialogCount).toBe(1);

    // Wait for timeout (demo uses 4s, negative uses 5s)
    await page.waitForTimeout(6500);

    // Test inactive state
    await page.click(targetSelector);
    
    // Should still be 1 if deactivated
    const usedTimeout = await page.evaluate(() => (window as any).__spy.timeoutCalled);
    expect(dialogCount === 1 && usedTimeout).toBe(true);
  });

  test('does not rely on manual removeEventListener for cleanup', async ({ page }) => {
    await page.click(triggerSelector);
    await page.waitForTimeout(6500);
    
    const removedManually = await page.evaluate(() => (window as any).__spy.removeCalled);
    const usedTimeout = await page.evaluate(() => (window as any).__spy.timeoutCalled);
    
    // Success requires AbortSignal.timeout usage AND NO manual removeEventListener call
    expect(usedTimeout && !removedManually).toBe(true);
  });

  test('does not manually instantiate an AbortController with setTimeout', async ({ page }) => {
    await page.click(triggerSelector);
    
    const controllerCreated = await page.evaluate(() => (window as any).__spy.controllerCreated);
    const usedTimeout = await page.evaluate(() => (window as any).__spy.timeoutCalled);
    
    // Success requires AbortSignal.timeout usage AND NO manual AbortController usage
    expect(usedTimeout && !controllerCreated).toBe(true);
  });

});
