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
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Intl.DisplayNames Expectations: ${demoName}`, () => {

  // Inject tracking and mocking logic before the page loads
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__intlCalls = {
        displayNames: [],
        formatToPartsCalled: false
      };

      const OriginalDisplayNames = Intl.DisplayNames;
      if (OriginalDisplayNames) {
        // @ts-ignore
        const MockedDisplayNames = function(...args) {
          const [locales, options] = args;
          (window as any).__intlCalls.displayNames.push({ locales, options });
          
          const instance = Reflect.construct(OriginalDisplayNames, args);
          const originalOf = instance.of.bind(instance);
          
          // Poison the output to ensure the UI is actually using this API
          instance.of = function(id: string) {
            const result = originalOf(id);
            return `MOCKED_${result}`;
          };
          return instance;
        };
        
        // Copy static methods
        // @ts-ignore
        MockedDisplayNames.supportedLocalesOf = OriginalDisplayNames.supportedLocalesOf;
        // @ts-ignore
        Intl.DisplayNames = MockedDisplayNames;
      }

      const OriginalDateTimeFormat = Intl.DateTimeFormat;
      // @ts-ignore
      Intl.DateTimeFormat = function(...args) {
        const instance = Reflect.construct(OriginalDateTimeFormat, args);
        const originalFormatToParts = instance.formatToParts.bind(instance);
        instance.formatToParts = function(...fArgs: any[]) {
          (window as any).__intlCalls.formatToPartsCalled = true;
          return originalFormatToParts(...fArgs);
        };
        return instance;
      };
      // @ts-ignore
      Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;
    });

    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
    // Wait for the page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('The implementation must use Intl.DisplayNames for calendar systems', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__intlCalls.displayNames);
    const hasCalendarCall = calls.some((c: any) => c.options?.type === 'calendar');
    expect(hasCalendarCall).toBe(true);
  });

  test('The implementation must use Intl.DisplayNames for dateTimeField labels', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__intlCalls.displayNames);
    const hasFieldCall = calls.some((c: any) => c.options?.type === 'dateTimeField');
    expect(hasFieldCall).toBe(true);
  });

  test('The output labels must be dynamic and derived from Intl.DisplayNames', async ({ page }) => {
    // If the page uses Intl.DisplayNames.of(), our poisoned "MOCKED_" prefix will appear.
    // If it uses hardcoded values, the prefix will be missing.
    const bodyContent = await page.innerText('body');
    expect(bodyContent).toContain('MOCKED_');
  });

  test('The implementation should update labels when the locale changes', async ({ page }) => {
    // Try to find a locale/language selector and change it
    const selectorFound = await page.evaluate(async () => {
      const selects = Array.from(document.querySelectorAll('select'));
      if (selects.length > 0) {
        const select = selects[0];
        const options = Array.from(select.options);
        if (options.length > 1) {
          const currentIndex = select.selectedIndex;
          const nextIndex = (currentIndex + 1) % options.length;
          select.selectedIndex = nextIndex;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });

    if (selectorFound) {
      // Small delay for potential async updates
      await page.waitForTimeout(200);
      const bodyContent = await page.innerText('body');
      expect(bodyContent).toContain('MOCKED_');
    } else {
      // If no selector, we assume the initial load used it (covered by previous tests)
      // but we still want to pass if it's dynamic by design.
      // For the purpose of this grader, if there's no selector, we've already checked initial load.
      const calls = await page.evaluate(() => (window as any).__intlCalls.displayNames);
      expect(calls.length).toBeGreaterThan(0);
    }
  });

  test('The implementation must not use hardcoded translation objects or switch statements', async ({ page }) => {
    // We check if the page contains the poisoned "MOCKED_" prefix.
    // If it doesn't, it's either not using the API or using a hardcoded fallback.
    const bodyContent = await page.innerText('body');
    
    // In negative-demo.html, it will have "Gregorian" or "Year" but NOT "MOCKED_".
    // We expect "MOCKED_" to be the source of truth.
    expect(bodyContent).toContain('MOCKED_');
  });

  test('The implementation must not use formatToParts to extract field names', async ({ page }) => {
    // Check if formatToParts was called
    const called = await page.evaluate(() => (window as any).__intlCalls.formatToPartsCalled);
    expect(called).toBe(false);

    // Also check script content for the forbidden pattern
    const hasFormatToPartsInScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(s => s.textContent?.includes('formatToParts'));
    });
    expect(hasFormatToPartsInScript).toBe(false);
  });

});
