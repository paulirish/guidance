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

test.describe(`Exclusive Accordion Expectations: ${demoName}`, () => {

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

  test('Related <details> elements are grouped using identical name attribute values', async ({ page }) => {
    const detailsWithNames = await page.evaluate(() => {
      const details = Array.from(document.querySelectorAll('details'));
      const names = details.map(d => d.getAttribute('name')).filter(n => n !== null && n !== '');
      return names;
    });

    // Check if there are at least two details elements with the same name
    const nameCounts = detailsWithNames.reduce((acc, name) => {
      acc[name!] = (acc[name!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const hasGroup = Object.values(nameCounts).some(count => count >= 2);
    expect(hasGroup).toBe(true);
  });

  test('Only one <details> element in a named group possesses the open attribute at any given time', async ({ page }) => {
    // We'll test this by finding a group of details with the same name and interacting with them
    const groupName = await page.evaluate(() => {
      const details = Array.from(document.querySelectorAll('details[name]'));
      if (details.length === 0) return null;
      return details[0].getAttribute('name');
    });

    expect(groupName).not.toBeNull();

    const selector = `details[name="${groupName}"]`;
    const detailsElements = page.locator(selector);
    const count = await detailsElements.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Open each one (if not already open) and check others
    for (let i = 0; i < count; i++) {
      const isOpenBefore = await detailsElements.nth(i).evaluate((el: HTMLDetailsElement) => el.open);
      
      if (!isOpenBefore) {
        const summary = detailsElements.nth(i).locator('summary');
        await summary.click();
        
        // Wait for any potential transitions or browser processing
        await page.waitForTimeout(100);
      }

      const openCount = await page.evaluate((sel) => {
        return document.querySelectorAll(`${sel}[open]`).length;
      }, selector);
      
      expect(openCount).toBe(1);
      
      const isOpenAfter = await detailsElements.nth(i).evaluate((el: HTMLDetailsElement) => el.open);
      expect(isOpenAfter).toBe(true);
    }
  });

  test('Mutual exclusivity does not rely on JavaScript event listeners', async ({ browser, page }) => {
    // We need to check if it works with JS disabled
    const context = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await context.newPage();
    
    // Set up routing for the new context
    await noJsPage.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await noJsPage.goto(demoUrl);

    const groupName = await noJsPage.evaluate(() => {
      const details = Array.from(document.querySelectorAll('details[name]'));
      if (details.length === 0) return null;
      return details[0].getAttribute('name');
    });

    // If there's no name attribute, it's already failing the requirement
    expect(groupName).not.toBeNull();

    const selector = `details[name="${groupName}"]`;
    const detailsElements = noJsPage.locator(selector);
    const count = await detailsElements.count();
    
    if (count < 2) {
       // Should not happen if previous tests pass but good for robustness
       throw new Error('Not enough details elements in group to test mutual exclusivity');
    }

    // Try to open the second one (assuming first might be open)
    // In many browsers, clicking summary toggles 'open' even without JS.
    // However, the NATIVE 'name' attribute handling should close others.
    
    // First, find which one is NOT open
    let targetIndex = 0;
    for (let i = 0; i < count; i++) {
      const isOpen = await detailsElements.nth(i).evaluate((el: HTMLDetailsElement) => el.open);
      if (!isOpen) {
        targetIndex = i;
        break;
      }
    }

    // Click it
    await detailsElements.nth(targetIndex).locator('summary').click();
    await noJsPage.waitForTimeout(100);

    // Check if others are closed
    const openCount = await noJsPage.evaluate((sel) => {
      return document.querySelectorAll(`${sel}[open]`).length;
    }, selector);

    expect(openCount).toBe(1);
    
    const isOpen = await detailsElements.nth(targetIndex).evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpen).toBe(true);

    await context.close();
  });

  test('Multiple <details> elements with the same name cannot be open simultaneously', async ({ page }) => {
     const groupName = await page.evaluate(() => {
      const details = Array.from(document.querySelectorAll('details[name]'));
      if (details.length === 0) return null;
      return details[0].getAttribute('name');
    });

    expect(groupName).not.toBeNull();

    const selector = `details[name="${groupName}"]`;
    
    // Force multiple to be open by setting the attribute directly in JS
    // then check if the browser closes others (it should if native support exists)
    // Actually, browsers might not close them if set via JS simultaneously, 
    // but the spec says "when a details element has a name attribute, it is in a group... 
    // only one details element in a group can be open at a time."
    // If we try to set multiple to open, we should see if the browser handles it.
    
    // Better test: Click one, then click another, and verify only one is open.
    // We already do this in 'Only one <details> element...'.
    
    // Another edge case: What if they are initialized as open?
    // "In a named group, the browser ensures that only the last element declared with the open attribute remains open if multiple are specified."
    
    // Let's test the state after multiple interactions.
    const detailsElements = page.locator(selector);
    const count = await detailsElements.count();
    
    for (let i = 0; i < count; i++) {
        await detailsElements.nth(i).locator('summary').click();
        const openCount = await page.evaluate((sel) => document.querySelectorAll(`${sel}[open]`).length, selector);
        expect(openCount).toBeLessThanOrEqual(1);
    }
  });

});
