import { test, expect } from '@playwright/test';

// @ts-ignore
const targetUrl = process.env.TARGET_FILE ? `file://${process.env.TARGET_FILE}` : 'about:blank';

test.describe('Background Data Transfer Coordination', () => {
  test.beforeEach(async ({ page }) => {
    // Inject spies before the page loads to capture early interactions
    await page.addInitScript(() => {
      (window as any).__workerCreated = false;
      (window as any).__lastWorkerData = null;
      (window as any).__structuredCloneCalled = false;
      
      const OriginalWorker = window.Worker;
      window.Worker = function(scriptURL: string | URL, options?: WorkerOptions) {
        (window as any).__workerCreated = true;
        const w = new OriginalWorker(scriptURL, options);
        const originalPostMessage = w.postMessage;
        w.postMessage = function(data: any, ...args: any[]) {
          (window as any).__lastWorkerData = data;
          // @ts-ignore
          return originalPostMessage.apply(this, [data, ...args]);
        };
        return w;
      } as any;
      
      const originalSC = window.structuredClone;
      if (typeof originalSC === 'function') {
        (window as any).structuredClone = function(...args: any[]) {
          (window as any).__structuredCloneCalled = true;
          // @ts-ignore
          return originalSC.apply(this, args);
        };
      }
    });
    
    await page.goto(targetUrl);
  });

  test('Worker usage: Data should be offloaded to a background worker', async ({ page }) => {
    // Trigger the job
    const startBtn = page.locator('button', { hasText: /start|run|process|heavy/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    // Allow time for worker initialization
    await page.waitForTimeout(500);
    
    const workerCreated = await page.evaluate(() => (window as any).__workerCreated);
    expect(workerCreated, 'Application should create a Web Worker for background processing').toBe(true);
  });

  test('Type Preservation: Transferred data must preserve Map and Date types', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: /start|run|process|heavy/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Wait for data to be sent to the worker
    await page.waitForFunction(() => (window as any).__lastWorkerData !== null, { timeout: 3000 }).catch(() => {});
    
    const result = await page.evaluate(() => {
      const data = (window as any).__lastWorkerData;
      if (!data) return null;

      const hasMap = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false;
        if (obj instanceof Map) return true;
        return Object.values(obj).some(hasMap);
      };
      
      const hasDate = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false;
        if (obj instanceof Date) return true;
        return Object.values(obj).some(hasDate);
      };

      return { map: hasMap(data), date: hasDate(data) };
    });
    
    expect(result, 'Data should be sent to the worker').not.toBeNull();
    expect(result?.map, 'Complex types like Map should be preserved during cloning').toBe(true);
    expect(result?.date, 'Complex types like Date should be preserved during cloning').toBe(true);
  });

  test('Cloning Strategy: Must use structuredClone to handle complex data and circular references', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: /start|run|process|heavy/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    await page.waitForTimeout(500);

    // 1. Verify structuredClone was used (it's the only native way to handle Map/Circular)
    const scCalled = await page.evaluate(() => (window as any).__structuredCloneCalled);
    expect(scCalled, 'The application should use structuredClone() for deep cloning').toBe(true);

    // 2. Verify no errors related to circular references appear in the UI
    const bodyText = await page.innerText('body');
    expect(bodyText.toLowerCase()).not.toContain('circular');
    expect(bodyText.toLowerCase(), 'UI should not display errors during cloning').not.toContain('error');
  });

  test('UI Responsiveness: Main thread should remain responsive during processing', async ({ page }) => {
    const maxDelay = await page.evaluate(async () => {
      let maxDelay = 0;
      let lastTime = performance.now();
      let stop = false;

      const check = () => {
        const now = performance.now();
        const delay = now - lastTime;
        if (delay > maxDelay) maxDelay = delay;
        lastTime = now;
        if (!stop) requestAnimationFrame(check);
      };
      requestAnimationFrame(check);

      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        /start|run|process|heavy/i.test(b.textContent || '')
      ) as HTMLButtonElement | undefined;
      if (btn) btn.click();

      // Monitor responsiveness for 2 seconds
      await new Promise(r => setTimeout(r, 2000));
      stop = true;
      return maxDelay;
    });

    // If maxDelay > 100ms, it indicates a "long task" that blocks the UI thread
    expect(maxDelay, 'The main thread should not be blocked for more than 100ms').toBeLessThan(100);
  });

  test('Data Integrity: Original data should not be mutated by tasks', async ({ page }) => {
    const startBtn = page.locator('button', { hasText: /start|run|process|heavy/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    await page.waitForTimeout(1000);
    
    const pageText = await page.innerText('body');
    
    // Check for common patterns indicating mutation (e.g., original list changing)
    if (pageText.includes('Original items:')) {
      const match = pageText.match(/Original items: ([\d, ]+)/);
      if (match) {
        const items = match[1].split(',').map(s => s.trim());
        // In the anti-example, a '4' is pushed to the original array
        expect(items, 'The original dataset should not be mutated').not.toContain('4');
      }
    }
    
    // structuredClone usage is also a proof of safety from mutation
    const scCalled = await page.evaluate(() => (window as any).__structuredCloneCalled);
    expect(scCalled, 'Should use a safe cloning method like structuredClone').toBe(true);
  });
});
