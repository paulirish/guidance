import { test, expect } from '@playwright/test';

declare var process: any;

const target = process.env.TARGET_FILE || 'demo.html';
const url = target.startsWith('http') ? target : `file://${target}`;

test.describe('Undo/Redo State Snapshots Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__clones = [];
      (window as any).__restorations = [];
      (window as any).__scCalls = 0;
      (window as any).__jsonCloneCalls = 0;
      (window as any).__shallowPushes = 0;

      function isStateLike(obj: any) {
        return obj && typeof obj === 'object' && !Array.isArray(obj) && 
               (obj.tasks || obj.items || obj.metadata || obj.sessionStarted);
      }

      // Monkey-patch structuredClone
      const originalSC = window.structuredClone;
      if (originalSC) {
        window.structuredClone = function(obj: any) {
          (window as any).__scCalls++;
          const res = originalSC(obj);
          if (isStateLike(obj)) {
            (window as any).__clones.push({ type: 'sc', input: obj, output: res });
          }
          return res;
        };
      }

      // Monkey-patch JSON.stringify
      const originalJSON = JSON.stringify;
      JSON.stringify = function(obj: any, replacer?: any, space?: any) {
        let isCloneCall = arguments.length === 1 && isStateLike(obj);
        if (isCloneCall) {
          (window as any).__jsonCloneCalls++;
        }
        try {
          return originalJSON.apply(JSON, arguments as any);
        } catch (e: any) {
          if (e.message.includes('circular') && !isCloneCall) {
            return "[Circular]"; // For UI display
          }
          throw e;
        }
      } as any;

      // Monkey-patch Array.prototype.push
      const originalPush = Array.prototype.push;
      Array.prototype.push = function(val: any) {
        if (isStateLike(val)) {
          // Detect shallow clone: if this looks like a stack push, check if it's the same ref as a known state
          // For now, just track it
          (window as any).__clones.push({ type: 'push', input: val, output: val });
        }
        return originalPush.apply(this, arguments as any);
      };

      // Monkey-patch Array.prototype.pop
      const originalPop = Array.prototype.pop;
      Array.prototype.pop = function() {
        const res = originalPop.apply(this, arguments as any);
        if (isStateLike(res)) {
          (window as any).__restorations.push(res);
        }
        return res;
      };
    });

    await page.goto(url);
    await page.waitForLoadState('networkidle');
  });

  async function clickButton(page: any, labelRegex: RegExp) {
    const btn = page.locator('button').filter({ hasText: labelRegex }).first();
    await btn.click();
  }

  test('Requirement: History consists of deep copies (no shallow cloning)', async ({ page }) => {
    await clickButton(page, /add/i);
    
    const success = await page.evaluate(() => {
      // Find the state object from the first clone action
      const clone = (window as any).__clones[0];
      if (!clone) return false;
      const state = clone.input;
      const nested = { val: 1 };
      if (state.tasks) state.testNested = nested;
      else if (state.items) {
          if (!state.items[0]) state.items.push({ id: 1, info: { label: 'test' } });
          state.items[0].testNested = nested;
      }
      (window as any).__originalNested = nested;
      return true;
    });
    expect(success).toBe(true);

    await clickButton(page, /add/i);
    await clickButton(page, /undo/i);

    const isDeep = await page.evaluate(() => {
      // The restored state should be in __restorations
      const restored = (window as any).__restorations[(window as any).__restorations.length - 1];
      if (!restored) return false;
      
      let resNested = null;
      if (restored.testNested) resNested = restored.testNested;
      else if (restored.items && restored.items[0] && restored.items[0].testNested) resNested = restored.items[0].testNested;
      
      return resNested && resNested !== (window as any).__originalNested;
    });
    expect(isDeep).toBe(true);
  });

  test('Requirement: Preserve complex types like Set/Map', async ({ page }) => {
    await clickButton(page, /add/i);
    await page.evaluate(() => {
      const clone = (window as any).__clones[0];
      const s = clone?.input;
      if (s) {
        s.testSet = new Set(['gold']);
        s.testMap = new Map([['k', 'v']]);
        s.testDate = new Date(123456);
      }
    });

    await clickButton(page, /add/i);
    await clickButton(page, /undo/i);

    const check = await page.evaluate(() => {
      const restored = (window as any).__restorations[(window as any).__restorations.length - 1];
      if (!restored) return null;
      return {
        isSet: restored.testSet instanceof Set && restored.testSet.has('gold'),
        isMap: restored.testMap instanceof Map && restored.testMap.get('k') === 'v',
        isDate: restored.testDate instanceof Date && restored.testDate.getTime() === 123456
      };
    });
    expect(check?.isSet).toBe(true);
    expect(check?.isMap).toBe(true);
    expect(check?.isDate).toBe(true);
  });

  test('Requirement: Handle circular references safely', async ({ page }) => {
    await clickButton(page, /add/i);
    await page.evaluate(() => {
      const clone = (window as any).__clones[0];
      const s = clone?.input;
      if (s) s.circular = s;
    });

    let error: string | null = null;
    page.on('pageerror', e => error = e.message);
    page.on('console', msg => { if (msg.type() === 'error') error = msg.text(); });

    const beforeCount = await page.evaluate(() => (window as any).__clones.length);
    await clickButton(page, /add/i).catch(e => error = e.message);
    await page.waitForTimeout(500);

    const afterCount = await page.evaluate(() => (window as any).__clones.length);
    expect(error).toBeNull();
    expect(afterCount).toBeGreaterThan(beforeCount);
    
    // Verify it still works and circular ref is preserved
    await clickButton(page, /undo/i);
    const circularPreserved = await page.evaluate(() => {
      const restored = (window as any).__restorations[(window as any).__restorations.length - 1];
      return restored && restored.circular === restored;
    });
    expect(circularPreserved).toBe(true);
  });

  test('Requirement: Use structuredClone for deep copies', async ({ page }) => {
    await clickButton(page, /add/i);
    const results = await page.evaluate(() => ({
      usedSC: (window as any).__scCalls > 0,
      usedJSONClone: (window as any).__jsonCloneCalls > 0
    }));

    expect(results.usedSC).toBe(true);
    expect(results.usedJSONClone).toBe(false);
  });
});
