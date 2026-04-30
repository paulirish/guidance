import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';

/**
 * Grader for Nested State Management
 * 
 * Expectations:
 * - Use structuredClone() for deep cloning.
 * - Modifying nested properties in the clone should not affect the original.
 * - Complex types (Date, Map, Set) must be preserved.
 * - Circular references must be handled correctly.
 * - Fail on shallow copy or JSON.parse/stringify degradation.
 */

test.describe('Nested State Management Requirements', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${targetFile}`);
  });

  test('Requirement 1: Should use structuredClone for deep cloning', async ({ page }) => {
    // We spy on structuredClone to ensure it is called when a cloning action is triggered.
    await page.evaluate(() => {
      (window as any)._structuredCloneCalled = false;
      const original = window.structuredClone;
      if (typeof original === 'function') {
        window.structuredClone = function(...args) {
          (window as any)._structuredCloneCalled = true;
          return original.apply(this, args);
        };
      }
    });

    // Attempt to trigger a clone action using common button labels or test classes
    const cloneBtn = page.locator('button').filter({ hasText: /clone|buffer|copy/i }).first();
    await cloneBtn.click();

    const called = await page.evaluate(() => (window as any)._structuredCloneCalled);
    expect(called).toBe(true);
  });

  test('Requirement 2: Nested properties in the clone must be independent of the original', async ({ page }) => {
    // We find the "Original" display and the "Mutate" button.
    // If we mutate the clone, the original display should not change.
    
    // 1. Identify the displays and buttons
    const originalPre = page.locator('pre').filter({ hasText: /id|meta/i }).first();
    const cloneBtn = page.locator('button').filter({ hasText: /clone|buffer|copy/i }).first();
    const mutateBtn = page.locator('button').filter({ hasText: /mutate|update|modify/i }).first();

    // 2. Capture initial state
    const initialText = await originalPre.innerText();

    // 3. Perform Clone and then Mutate
    await cloneBtn.click();
    await mutateBtn.click();

    // 4. Verify original text remains unchanged
    const finalText = await originalPre.innerText();
    expect(finalText).toBe(initialText);
  });

  test('Requirement 3: The implementation must handle circular references correctly', async ({ page }) => {
    // We search for a cloning function in the global scope and test it with a circular structure.
    const handlesCircular = await page.evaluate(() => {
      // Look for a function that performs deep cloning (excluding native structuredClone)
      const candidates = Object.entries(window)
        .filter(([k, v]) => typeof v === 'function' && k !== 'structuredClone' && !k.startsWith('webkit') && !k.startsWith('__'))
        .map(([k, v]) => v as Function);

      for (const fn of candidates) {
        try {
          // Simple check: does it return a new object for {a:{b:1}}?
          const testObj = { a: { b: 1 } };
          const result = fn(testObj);
          if (result !== testObj && result.a !== testObj.a && result.a.b === 1) {
            // Test circular ref
            const circular: any = { val: 42 };
            circular.self = circular;
            const circResult = fn(circular);
            if (circResult !== circular && circResult.self === circResult && circResult.val === 42) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(handlesCircular).toBe(true);
  });

  test('Requirement 4: The implementation must preserve complex types like Date, Map, or Set', async ({ page }) => {
    // We search for a cloning function in the global scope and test it with complex types.
    const preservesTypes = await page.evaluate(() => {
      const candidates = Object.entries(window)
        .filter(([k, v]) => typeof v === 'function' && k !== 'structuredClone' && !k.startsWith('webkit') && !k.startsWith('__'))
        .map(([k, v]) => v as Function);

      for (const fn of candidates) {
        try {
          const complex = {
            s: new Set([1, 2]),
            m: new Map([[1, 'one']]),
            d: new Date(123456789)
          };
          const result = fn(complex);
          if (result.s instanceof Set && result.s.has(1) && 
              result.m instanceof Map && result.m.get(1) === 'one' &&
              result.d instanceof Date && result.d.getTime() === 123456789 &&
              result.s !== complex.s) {
            return true;
          }
        } catch (e) {}
      }
      return false;
    });

    expect(preservesTypes).toBe(true);
  });

  test('Requirement 5: Should not exhibit shared reference leaks or type degradation in UI feedback', async ({ page }) => {
    // Trigger clone and mutate
    const cloneBtn = page.locator('button').filter({ hasText: /clone|buffer|copy/i }).first();
    const mutateBtn = page.locator('button').filter({ hasText: /mutate|update|modify/i }).first();
    
    await cloneBtn.click();
    await mutateBtn.click();

    // Check for feedback messages that indicate failure
    // We check the entire body text for keywords that indicate a leak or sharing
    const bodyText = await page.innerText('body');
    const hasLeakWarning = /shared|leaked|leak|mutation leaked|changed primary/i.test(bodyText);
    const hasTypeWarning = /converted|lost|degradation/i.test(bodyText);
    
    // In negative-demo.html, these words appear.
    // In demo.html, they don't (or they are in a different context, but we should be careful).
    // Wait, demo.html HAS "Mutation leaked" in its script but only shows it on failure.
    // innerText only gets VISIBLE text.
    
    expect(hasLeakWarning || hasTypeWarning).toBe(false);
  });

  test('Requirement 6: UI status should indicate success and use appropriate visual cues', async ({ page }) => {
    // We check if the status message has a "success" style (e.g., green background)
    // in demo.html, success has background #dcfce7 (greenish).
    // in negative-demo.html, it's just bold text or contains "shared" notice.
    
    const cloneBtn = page.locator('button').filter({ hasText: /clone|buffer|copy/i }).first();
    const mutateBtn = page.locator('button').filter({ hasText: /mutate|update|modify/i }).first();
    
    await cloneBtn.click();
    await mutateBtn.click();
    
    // Find the status element
    const status = page.locator('.test-status-msg, #status, #feedback').first();
    
    // Assert it contains success keywords and doesn't contain failure ones
    const text = await status.innerText();
    const isSuccessText = /success|safe|untouched|successful/i.test(text);
    const isFailureText = /leak|shared|change|warn|converted/i.test(text);
    
    // Check computed styles for visual feedback (demo.html uses success classes)
    const bgColor = await status.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const isGreenish = (color: string) => {
        // Simple RGB check for green-dominant colors
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const [_, r, g, b] = match.map(Number);
            return g > r && g > b;
        }
        return false;
    };

    // For demo.html, both text and color should be good.
    // For negative-demo.html, it fails on text or lacks success cues.
    expect(isSuccessText && !isFailureText && isGreenish(bgColor)).toBe(true);
  });

});
