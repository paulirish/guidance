import { test, expect, chromium } from '@playwright/test';
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

test.describe(`Exclusive Status Logs Expectations: ${demoName}`, () => {

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

  test('Multiple <details> elements are present', async ({ page }) => {
    const detailsCount = await page.locator('details').count();
    expect(detailsCount).toBeGreaterThan(1);
  });

  test('All <details> elements in the group share a non-empty name attribute', async ({ page }) => {
    const details = page.locator('details');
    const count = await details.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const name = await details.nth(i).getAttribute('name');
      expect(name).not.toBeNull();
      expect(name?.trim()).not.toBe('');
    }
  });

  test('All <details> elements share the same name attribute value', async ({ page }) => {
    const details = page.locator('details');
    const count = await details.count();
    expect(count).toBeGreaterThan(0);
    
    const firstName = await details.first().getAttribute('name');
    for (let i = 1; i < count; i++) {
      const name = await details.nth(i).getAttribute('name');
      expect(name).toBe(firstName);
    }
  });

  test('Opening one <details> element closes others (Exclusivity Check)', async ({ page }) => {
    const details = page.locator('details');
    const count = await details.count();
    expect(count).toBeGreaterThan(1);

    // Open the first one
    await details.first().evaluate((el: HTMLDetailsElement) => el.open = true);
    // Open the second one
    await details.nth(1).evaluate((el: HTMLDetailsElement) => el.open = true);

    // The first one should now be closed
    const firstOpen = await details.first().evaluate((el: HTMLDetailsElement) => el.open);
    expect(firstOpen).toBe(false);
    
    // The second one should be open
    const secondOpen = await details.nth(1).evaluate((el: HTMLDetailsElement) => el.open);
    expect(secondOpen).toBe(true);
  });

  test('Exclusivity is achieved natively without JavaScript event listeners', async ({ browser }) => {
    // Create a new context with JavaScript disabled
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    
    // We need to setup the route again for this new context
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
    const count = await details.count();
    
    // If there are no details elements, this test should fail (for negative-demo)
    expect(count).toBeGreaterThan(1);

    // Better way to find an open/closed one without JS:
    const openDetails = page.locator('details[open]');
    const openCount = await openDetails.count();
    
    if (openCount > 0) {
      // Find one that is NOT open
      const count = await details.count();
      let closedIndex = -1;
      for (let i = 0; i < count; i++) {
        const isOpen = await details.nth(i).getAttribute('open') !== null;
        if (!isOpen) {
          closedIndex = i;
          break;
        }
      }

      if (closedIndex !== -1) {
        // Find which one was open
        let initialOpenIndex = -1;
        for (let i = 0; i < count; i++) {
          if (await details.nth(i).getAttribute('open') !== null) {
            initialOpenIndex = i;
            break;
          }
        }

        // Click the closed one
        await details.nth(closedIndex).locator('summary').click({ force: true });
        
        // Now the newly clicked one should be open
        await expect(details.nth(closedIndex)).toHaveAttribute('open', '');
        
        // And the previously open one should be closed
        if (initialOpenIndex !== -1 && initialOpenIndex !== closedIndex) {
          await expect(details.nth(initialOpenIndex)).not.toHaveAttribute('open');
        }
      }
    } else {
      // None are open, open two sequentially
      await details.nth(0).locator('summary').click({ force: true });
      await expect(details.nth(0)).toHaveAttribute('open', '');
      
      await details.nth(1).locator('summary').click({ force: true });
      await expect(details.nth(1)).toHaveAttribute('open', '');
      await expect(details.nth(0)).not.toHaveAttribute('open');
    }

    await context.close();
  });

  test('Implementation uses semantic <details> instead of div-based accordion', async ({ page }) => {
    // Check for common non-semantic patterns
    const accordionButtons = await page.locator('button.accordion-header, .accordion button').count();
    const panels = await page.locator('.panel, .accordion-content').count();
    
    // If it's a legacy pattern, it might have buttons and panels but no <details>
    const detailsCount = await page.locator('details').count();
    
    if (detailsCount === 0) {
      // If no details are found, and we see button/div patterns, it's definitely non-semantic
      expect(accordionButtons + panels).toBe(0); 
    }
    
    expect(detailsCount).toBeGreaterThan(0);
  });
});
