import { test, expect } from '@playwright/test';
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';

// Setup
// @ts-ignore
const targetFile = (process as any).env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Intl.DisplayNames Currency Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // track API calls
    await page.addInitScript(() => {
      (window as any)._intlCalls = {
        displayNames: [] as any[],
        numberFormat: [] as any[]
      };

      const OriginalDisplayNames = Intl.DisplayNames;
      // @ts-ignore
      Intl.DisplayNames = function(locales: any, options: any) {
        (window as any)._intlCalls.displayNames.push({ locales, options });
        const instance = new OriginalDisplayNames(locales, options);
        const originalOf = instance.of;
        instance.of = function(code: string) {
          const result = originalOf.call(instance, code);
          const currentCall = (window as any)._intlCalls.displayNames[(window as any)._intlCalls.displayNames.length - 1];
          currentCall.ofCalls = currentCall.ofCalls || [];
          currentCall.ofCalls.push({ code, result });
          
          if ((window as any)._mockIntl) {
            return `MOCK_${result}`;
          }
          return result;
        };
        return instance;
      } as any;
      
      try {
        (Intl.DisplayNames as any).prototype = OriginalDisplayNames.prototype;
        (Intl.DisplayNames as any).supportedLocalesOf = OriginalDisplayNames.supportedLocalesOf;
      } catch (e) {
        // ignore
      }

      const OriginalNumberFormat = Intl.NumberFormat;
      // @ts-ignore
      Intl.NumberFormat = function(locales: any, options: any) {
        (window as any)._intlCalls.numberFormat.push({ locales, options });
        return new OriginalNumberFormat(locales, options);
      } as any;
      
      try {
        (Intl.NumberFormat as any).prototype = OriginalNumberFormat.prototype;
        (Intl.NumberFormat as any).supportedLocalesOf = OriginalNumberFormat.supportedLocalesOf;
      } catch (e) {
        // ignore
      }
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

  async function getSelectors(page: any) {
    const selects = await page.locator('select').all();
    let localeSelector = null;
    let currencySelector = null;

    for (const select of selects) {
      const options = await select.locator('option').all();
      const values = await Promise.all(options.map((o: any) => o.getAttribute('value')));
      if (values.some((v: string | null) => v?.includes('-'))) {
        localeSelector = select;
      } else if (values.some((v: string | null) => v && v.length === 3 && v === v.toUpperCase())) {
        currencySelector = select;
      }
    }

    return { localeSelector, currencySelector };
  }

  async function checkForbidden(page: any) {
    const calls = await page.evaluate(() => (window as any)._intlCalls);
    const usesNFForNames = calls.numberFormat.some((c: any) => 
      c.options?.style === 'currency' && c.options?.currencyDisplay === 'name'
    );
    if (usesNFForNames) {
      throw new Error('Forbidden usage of Intl.NumberFormat detected.');
    }
    
    // Check if Intl.DisplayNames was NOT used but a name is displayed
    // This is handled by each test calling it.
  }

  test('Uses Intl.DisplayNames constructor with type: "currency"', async ({ page }) => {
    const { localeSelector, currencySelector } = await getSelectors(page);
    if (localeSelector && currencySelector) {
      await localeSelector.selectOption({ index: 0 });
      await currencySelector.selectOption({ index: 0 });
    }

    await checkForbidden(page);
    const calls = await page.evaluate(() => (window as any)._intlCalls.displayNames);
    expect(calls.length, 'Intl.DisplayNames was not called.').toBeGreaterThan(0);
    expect(calls.some((c: any) => c.options?.type === 'currency'), 'Intl.DisplayNames type must be "currency".').toBe(true);
  });

  test('Correctly resolves full localized currency names via Intl.DisplayNames', async ({ page }) => {
    // Mock to detect hardcoded
    await page.evaluate(() => { (window as any)._mockIntl = true; });

    const { localeSelector, currencySelector } = await getSelectors(page);
    if (!localeSelector || !currencySelector) throw new Error('Selectors not found');

    const testCases = [
      { locale: 'en-US', currency: 'USD' }
    ];

    for (const tc of testCases) {
      await localeSelector.selectOption(tc.locale);
      await currencySelector.selectOption(tc.currency);
      
      await checkForbidden(page);
      
      const realValue = new Intl.DisplayNames([tc.locale], { type: 'currency' }).of(tc.currency);
      const mockValue = `MOCK_${realValue}`;
      
      // Must show MOCK value
      await expect(page.getByText(mockValue, { exact: true }), 'Page must use Intl.DisplayNames (not hardcoded data)').toBeVisible();
    }
  });

  test('Demonstrates dynamic localization using Intl.DisplayNames', async ({ page }) => {
    // Mock to detect hardcoded
    await page.evaluate(() => { (window as any)._mockIntl = true; });

    const { localeSelector, currencySelector } = await getSelectors(page);
    if (!localeSelector || !currencySelector) throw new Error('Selectors not found');

    const locales = ['en-US', 'de-DE'];
    const currency = 'USD';

    for (const locale of locales) {
      await localeSelector.selectOption(locale);
      await currencySelector.selectOption(currency);
      
      await checkForbidden(page);
      
      const realValue = new Intl.DisplayNames([locale], { type: 'currency' }).of(currency);
      const mockValue = `MOCK_${realValue}`;
      
      await expect(page.getByText(mockValue, { exact: true }), 'Page must use Intl.DisplayNames for dynamic localization').toBeVisible();
    }
  });

  test('Must not use hardcoded lookup object or local JSON', async ({ page }) => {
    await page.evaluate(() => {
      (window as any)._mockIntl = true;
    });

    const { localeSelector, currencySelector } = await getSelectors(page);
    if (localeSelector && currencySelector) {
      await localeSelector.selectOption('en-US');
      await currencySelector.selectOption('USD');

      const realValue = new Intl.DisplayNames(['en-US'], { type: 'currency' }).of('USD');
      const mockValue = `MOCK_${realValue}`;

      const isMockVisible = await page.getByText(mockValue, { exact: true }).isVisible();
      const isRealVisible = await page.getByText(realValue!, { exact: true }).isVisible();

      if (isRealVisible && !isMockVisible) {
        throw new Error('Hardcoded lookup detected.');
      }
      
      const calls = await page.evaluate(() => (window as any)._intlCalls.displayNames);
      expect(calls.length, 'Intl.DisplayNames was not called.').toBeGreaterThan(0);
    }
  });

  test('Must not use Intl.NumberFormat to extract currency names', async ({ page }) => {
    const { localeSelector, currencySelector } = await getSelectors(page);
    if (localeSelector && currencySelector) {
      // fr-FR in negative-demo triggers NumberFormat
      const hasFR = await localeSelector.locator('option[value="fr-FR"]').count() > 0;
      if (hasFR) {
        await localeSelector.selectOption('fr-FR');
        await currencySelector.selectOption('USD');
      }

      const nfCalls = await page.evaluate(() => (window as any)._intlCalls.numberFormat);
      const usesNFForNames = nfCalls.some((c: any) => 
        c.options?.style === 'currency' && c.options?.currencyDisplay === 'name'
      );

      expect(usesNFForNames, 'Forbidden usage of Intl.NumberFormat detected.').toBe(false);
    }
  });

});
