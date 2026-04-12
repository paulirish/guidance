import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Subgrid Card Alignment Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  async function getCards(page: Page) {
    const selectors = ['.test-card', '.card', '[class*="card"]'];
    for (const selector of selectors) {
      const cards = await page.$$(selector);
      if (cards.length >= 2) return cards;
    }
    const container = await page.$('main, .container, .test-grid-container, #container');
    if (container) {
      const children = await container.$$(':scope > *');
      if (children.length >= 2) return children;
    }
    return [];
  }

  test('Grid container should define a multi-track layout', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThanOrEqual(2);
    
    const container = await cards[0].evaluateHandle((el: any) => el.parentElement);
    const containerStyle = await container.evaluate((el: any) => {
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        gridTemplateRows: s.gridTemplateRows
      };
    });
    
    expect({
      display: containerStyle.display,
      hasMultipleTracks: containerStyle.gridTemplateRows.split(' ').length >= 2
    }).toEqual({
      display: 'grid',
      hasMultipleTracks: true
    });
  });

  test('Card components should be grid items and use display: grid', async ({ page }) => {
    const cards = await getCards(page);
    const cardStyle = await cards[0].evaluate((el: any) => window.getComputedStyle(el).display);
    expect(cardStyle).toBe('grid');
  });

  test('Card components should use subgrid for row/column inheritance', async ({ page }) => {
    const cards = await getCards(page);
    const cardStyle = await cards[0].evaluate((el: any) => {
      const s = window.getComputedStyle(el);
      return {
        gridTemplateRows: s.gridTemplateRows,
        gridTemplateColumns: s.gridTemplateColumns
      };
    });
    
    expect(cardStyle.gridTemplateRows.startsWith('subgrid') || cardStyle.gridTemplateColumns.startsWith('subgrid')).toBe(true);
  });

  test('Internal sections (headers) should align perfectly across cards via subgrid', async ({ page }) => {
    const cards = await getCards(page);
    const header1 = await cards[0].$(':first-child');
    const header2 = await cards[1].$(':first-child');
    
    const box1 = await header1?.boundingBox();
    const box2 = await header2?.boundingBox();
    const isSubgrid = await cards[0].evaluate((el: any) => window.getComputedStyle(el).gridTemplateRows.startsWith('subgrid'));
    
    expect({
      aligned: Math.abs((box1?.y || 0) - (box2?.y || 0)) < 2,
      usingSubgrid: isSubgrid
    }).toEqual({
      aligned: true,
      usingSubgrid: true
    });
  });

  test('Internal sections (bodies) should align perfectly across cards via subgrid', async ({ page }) => {
    const cards = await getCards(page);
    const sections1 = await cards[0].$$(':scope > *');
    const sections2 = await cards[1].$$(':scope > *');
    
    const body1 = sections1[1];
    const body2 = sections2[1];
    
    const box1 = await body1?.boundingBox();
    const box2 = await body2?.boundingBox();
    const isSubgrid = await cards[0].evaluate((el: any) => window.getComputedStyle(el).gridTemplateRows.startsWith('subgrid'));
    
    expect({
      aligned: Math.abs((box1?.y || 0) - (box2?.y || 0)) < 2,
      usingSubgrid: isSubgrid
    }).toEqual({
      aligned: true,
      usingSubgrid: true
    });
  });

  test('Internal sections (footers) should align perfectly across cards via subgrid', async ({ page }) => {
    const cards = await getCards(page);
    const sections1 = await cards[0].$$(':scope > *');
    const sections2 = await cards[1].$$(':scope > *');
    
    const footer1 = sections1[sections1.length - 1];
    const footer2 = sections2[sections2.length - 1];
    
    const box1 = await footer1?.boundingBox();
    const box2 = await footer2?.boundingBox();
    const isSubgrid = await cards[0].evaluate((el: any) => window.getComputedStyle(el).gridTemplateRows.startsWith('subgrid'));
    
    expect({
      aligned: Math.abs((box1?.y || 0) - (box2?.y || 0)) < 2,
      usingSubgrid: isSubgrid
    }).toEqual({
      aligned: true,
      usingSubgrid: true
    });
  });

  test('Layout should not rely on fixed heights for alignment', async ({ page }) => {
    const cards = await getCards(page);
    const header = await cards[0].$(':first-child');
    
    const hasBadStyles = await header?.evaluate((el: any) => {
      const s = window.getComputedStyle(el);
      const isSubgrid = window.getComputedStyle(el.parentElement!).gridTemplateRows.startsWith('subgrid');
      return (s.height === '60px' || s.minHeight === '100px') && !isSubgrid;
    });
    
    expect(hasBadStyles).toBe(false);
  });

  test('Cards should not define independent grid tracks', async ({ page }) => {
    const cards = await getCards(page);
    const gridTemplateRows = await cards[0].evaluate((el: any) => window.getComputedStyle(el).gridTemplateRows);
    expect(gridTemplateRows.startsWith('subgrid')).toBe(true);
  });

  test('Layout should not rely on Flexbox for alignment synchronization', async ({ page }) => {
    const cards = await getCards(page);
    const container = await cards[0].evaluateHandle((el: any) => el.parentElement);
    const display = await container.evaluate((el: any) => window.getComputedStyle(el).display);
    expect(display).toBe('grid');
  });

});
