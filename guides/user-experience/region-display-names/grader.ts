import { test, expect } from '@playwright/test';
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';
// @ts-ignore
import * as process from 'process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Intl.DisplayNames Regions: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // We inject a spy/mock before the page loads to track Intl.DisplayNames usage
    await page.addInitScript(() => {
      const OriginalDisplayNames = Intl.DisplayNames;
      (window as any).__intlCalls = [];
      
      const SpiedDisplayNames = function(this: any, locales: any, options: any) {
        (window as any).__intlCalls.push({ locales, options });
        return new OriginalDisplayNames(locales, options);
      };
      SpiedDisplayNames.prototype = OriginalDisplayNames.prototype;
      SpiedDisplayNames.supportedLocalesOf = OriginalDisplayNames.supportedLocalesOf;
      
      (Intl as any).DisplayNames = SpiedDisplayNames;
    });

    await page.goto(demoUrl);
    await page.waitForLoadState('networkidle');
  });

  const getLocaleSelector = (page: any) => page.locator('#locale-select, #lang, .test-locale-selector').first();
  const getRegionSelector = (page: any) => page.locator('#region-select, #region, .test-region-selector').first();

  test('The implementation must utilize the Intl.DisplayNames API with type: "region"', async ({ page }) => {
    const hasRegionCall = await page.evaluate(() => {
      return (window as any).__intlCalls.some((call: any) => 
        call.options && call.options.type === 'region'
      );
    });
    expect(hasRegionCall).toBe(true);
  });

  test('The application must correctly display localized names for various geographic regions (e.g., Canada)', async ({ page }) => {
    const localeSelector = getLocaleSelector(page);
    const regionSelector = getRegionSelector(page);

    // Select English
    const englishOption = localeSelector.locator('option').filter({ hasText: /English|Anglais/i }).first();
    const englishVal = await englishOption.getAttribute('value');
    if (englishVal) {
      await localeSelector.selectOption(englishVal);
    }

    // Select CA (Canada) - This should exist in a dynamic implementation
    await regionSelector.selectOption('CA');
    
    await page.waitForTimeout(100);
    
    const optionText = await regionSelector.locator('option[value="CA"]').textContent();
    const resultText = await page.locator('.test-display-name, #result, .result, #display').first().textContent();
    
    const isLocalized = (optionText?.includes('Canada')) || (resultText?.includes('Canada'));
    expect(isLocalized).toBe(true);
  });

  test('The solution must dynamically handle various ISO region codes (e.g., JP for Japan)', async ({ page }) => {
    const localeSelector = getLocaleSelector(page);
    const regionSelector = getRegionSelector(page);

    // Select English
    const englishOption = localeSelector.locator('option').filter({ hasText: /English|Anglais/i }).first();
    const englishVal = await englishOption.getAttribute('value');
    if (englishVal) {
      await localeSelector.selectOption(englishVal);
    }
    
    // Select JP
    await regionSelector.selectOption('JP');
    
    await page.waitForTimeout(100);
    
    const optionText = await regionSelector.locator('option[value="JP"]').textContent();
    const resultText = await page.locator('.test-display-name, #result, .result, #display').first().textContent();
    
    const isLocalized = (optionText?.toLowerCase().includes('japan')) || (resultText?.toLowerCase().includes('japan'));
    expect(isLocalized).toBe(true);
  });

  test('The implementation must not use a static mapping object for region names', async ({ page }) => {
    await page.addInitScript(() => {
      const OriginalDisplayNames = Intl.DisplayNames;
      OriginalDisplayNames.prototype.of = function(code: string) {
        return `MOCKED_${code}`;
      };
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');

    const regionSelector = getRegionSelector(page);
    
    const optionText = await regionSelector.locator('option[value="US"]').textContent();
    expect(optionText?.trim()).toBe('MOCKED_US');
  });

  test('The application should not bundle static translation strings in scripts', async ({ page }) => {
    // Look for localized names that should be provided by the API, not hardcoded
    const scripts = await page.locator('script').allInnerTexts();
    const hasStaticNames = scripts.some(s => 
      s.includes('United States') || 
      s.includes('États-Unis') || 
      s.includes('Reino Unido') || 
      s.includes('Alemania')
    );
    expect(hasStaticNames).toBe(false);
  });
});
