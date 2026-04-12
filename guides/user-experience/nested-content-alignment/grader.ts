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

// Tests
test.describe(`CSS Subgrid Alignment Expectations: ${demoName}`, () => {

  // Setup browser testing
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

  test('The nested component defines its grid columns or rows using the subgrid keyword', async ({ page }) => {
    const hasSubgrid = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns === 'subgrid' || 
               style.gridTemplateRows === 'subgrid' ||
               style.gridTemplateColumns.includes('subgrid') ||
               style.gridTemplateRows.includes('subgrid');
      });
    });
    expect(hasSubgrid).toBe(true);
  });

  test('The nested component is a child of a grid container and is itself configured as a grid container', async ({ page }) => {
    const isGridSubgrid = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const subgrids = elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });
      
      if (subgrids.length === 0) return false;

      return subgrids.every(el => {
        const style = window.getComputedStyle(el);
        const parent = el.parentElement;
        if (!parent) return false;
        const parentStyle = window.getComputedStyle(parent);
        
        const isSelfGrid = style.display === 'grid' || style.display === 'inline-grid';
        const isParentGrid = parentStyle.display === 'grid' || parentStyle.display === 'inline-grid';
        
        return isSelfGrid && isParentGrid;
      });
    });
    expect(isGridSubgrid).toBe(true);
  });

  test('Child elements of the nested component are positioned according to the parent grid tracks', async ({ page }) => {
    const alignsWithParent = await page.evaluate(() => {
      const subgrids = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });

      if (subgrids.length === 0) return false;

      return subgrids.every(subgrid => {
        const parent = subgrid.parentElement;
        if (!parent) return false;

        const subgridChildren = Array.from(subgrid.children);
        if (subgridChildren.length === 0) return true;

        const siblings = Array.from(parent.children).filter(c => c !== subgrid);
        if (siblings.length === 0) return true;

        // Check if each child of the subgrid aligns its horizontal start with at least one sibling of the subgrid
        // This confirms they are sharing the same grid tracks.
        return subgridChildren.every(child => {
          const childRect = child.getBoundingClientRect();
          return siblings.some(sib => {
            const sibRect = sib.getBoundingClientRect();
            return Math.abs(childRect.left - sibRect.left) < 1;
          });
        });
      });
    });
    expect(alignsWithParent).toBe(true);
  });
});
