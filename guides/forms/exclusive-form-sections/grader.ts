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

test.describe(`Exclusive Form Sections Expectations: ${demoName}`, () => {

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

    await page.goto(demoUrl);
  });

  test('At least two <details> elements with a name attribute are present', async ({ page }) => {
    const detailsCount = await page.locator('details[name]').count();
    expect(detailsCount).toBeGreaterThan(1);
  });

  test('All <details> elements in the group share the same name value', async ({ page }) => {
    const names = await page.locator('details').evaluateAll(els => 
      els.map(el => el.getAttribute('name'))
    );
    const uniqueNames = new Set(names.filter(n => n !== null));
    // Must have exactly one unique non-null name across all elements
    expect(uniqueNames.size).toBe(1);
  });

  test('The name attribute is not incorrectly applied to <summary> or parent <div> elements', async ({ page }) => {
    const incorrectElementsCount = await page.locator('div[name], summary[name]').count();
    expect(incorrectElementsCount).toBe(0);
  });

  test('Opening one <details> element automatically closes others without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    
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

    const details = page.locator('details');
    if (await details.count() < 2) {
      await context.close();
      throw new Error('Test requires at least 2 <details> elements');
    }

    // Find a closed details element and click its summary
    const closedIndex = await details.evaluateAll(els => 
        els.findIndex(el => !(el as HTMLDetailsElement).open)
    );
    const targetIndex = closedIndex === -1 ? 1 : closedIndex;
    
    await details.nth(targetIndex).locator('summary').click();

    const openIndices = await details.evaluateAll(els => 
        els.map((el, i) => (el as HTMLDetailsElement).open ? i : -1).filter(i => i !== -1)
    );
    
    // In a mutually exclusive group, exactly one should be open (the one we just clicked)
    expect(openIndices).toEqual([targetIndex]);

    await context.close();
  });

  test('The name attribute is present on all <details> elements', async ({ page }) => {
    const allHaveName = await page.locator('details').evaluateAll(els => 
      els.length > 0 && els.every(el => el.hasAttribute('name'))
    );
    expect(allHaveName).toBe(true);
  });

});
