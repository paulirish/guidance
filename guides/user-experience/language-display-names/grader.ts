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

test.describe(`Language Display Names Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Spy on Intl.DisplayNames to ensure it's used and with correct options
    await page.addInitScript(() => {
      const OriginalDisplayNames = Intl.DisplayNames;
      (window as any).__intlDisplayNamesCalls = [];
      // @ts-ignore
      Intl.DisplayNames = class extends OriginalDisplayNames {
        constructor(locales: any, options: any) {
          super(locales, options);
          (window as any).__intlDisplayNamesCalls.push({ locales, options });
        }
      };
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
  });

  test('should utilize the native Intl.DisplayNames API', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__intlDisplayNamesCalls);
    expect(calls.length).toBeGreaterThan(0);
  });

  test('should initialize Intl.DisplayNames with the "language" type', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__intlDisplayNamesCalls);
    const hasLanguageType = calls.some((c: any) => c.options && c.options.type === 'language');
    expect(hasLanguageType).toBe(true);
  });

  test('should correctly translate language codes in the current locale', async ({ page }) => {
    const expectedName = await page.evaluate(() => {
      const locale = (document.querySelector('select') as HTMLSelectElement)?.value || 'en';
      return new Intl.DisplayNames([locale], { type: 'language' }).of('it');
    });

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toContain(expectedName!.toLowerCase());
  });

  test('should dynamically update localized names when the UI locale changes', async ({ page }) => {
    const selector = page.locator('select');
    await selector.selectOption('es');
    // Allow time for the application to react to the change event
    await page.waitForTimeout(200);

    const expectedName = await page.evaluate(() => {
      return new Intl.DisplayNames(['es'], { type: 'language' }).of('it');
    });

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toContain(expectedName!.toLowerCase());
  });

  test('should handle standard BCP 47 tags like "zh" correctly', async ({ page }) => {
    const expectedZh = await page.evaluate(() => {
        const locale = (document.querySelector('select') as HTMLSelectElement)?.value || 'en';
        return new Intl.DisplayNames([locale], { type: 'language' }).of('zh');
    });
    
    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).toContain(expectedZh!.toLowerCase());
  });

});
