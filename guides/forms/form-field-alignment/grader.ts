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

test.describe(`Subgrid Form Alignment Expectations: ${demoName}`, () => {

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

  test('Parent container must establish a grid layout with at least two column tracks', async ({ page }) => {
    const gridParent = await page.evaluate(() => {
      const grids = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'grid' || style.display === 'inline-grid';
      });

      // Find a grid that contains label-input pairs in its descendants
      return grids.find(grid => {
        const style = window.getComputedStyle(grid);
        const columns = style.gridTemplateColumns.split(' ').filter(c => c !== '');
        return columns.length >= 2 && grid.querySelector('label') && (grid.querySelector('input') || grid.querySelector('select') || grid.querySelector('textarea'));
      }) !== undefined;
    });

    expect(gridParent).toBe(true);
  });

  test('Row containers wrapping label-input pairs must use grid-template-columns: subgrid', async ({ page }) => {
    const hasSubgridRow = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      return labels.some(label => {
        const row = label.parentElement;
        if (!row) return false;
        const style = window.getComputedStyle(row);
        return style.display === 'grid' && style.gridTemplateColumns.startsWith('subgrid');
      });
    });

    expect(hasSubgridRow).toBe(true);
  });

  test('Labels and input fields must be placed into distinct grid columns', async ({ page }) => {
    const distinctColumns = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const subgridRows = labels.map(l => l.parentElement).filter(row => {
        if (!row) return false;
        const style = window.getComputedStyle(row);
        return style.display === 'grid' && style.gridTemplateColumns.startsWith('subgrid');
      });

      if (subgridRows.length === 0) return false;

      return subgridRows.every(row => {
        const label = row?.querySelector('label');
        const input = row?.querySelector('input, select, textarea');
        if (!label || !input) return false;

        const labelRect = label.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();

        // They should not overlap horizontally if they are in distinct columns
        const distinctHorizontal = labelRect.right <= inputRect.left + 1 || inputRect.right <= labelRect.left + 1;
        
        return distinctHorizontal;
      });
    });

    expect(distinctColumns).toBe(true);
  });

  test('Alignment must not be driven by manual width adjustments or flexbox on individual items', async ({ page }) => {
    const usesManualWidths = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      
      // Check if any label has a fixed width or flex-basis
      return labels.some(label => {
        const style = window.getComputedStyle(label);
        const parentStyle = window.getComputedStyle(label.parentElement!);
        
        // If parent is flex, it's not using subgrid for alignment (though subgrid check already covers this, 
        // we check specifically for the "Must fail" conditions)
        if (parentStyle.display === 'flex') return true;

        // Check for hardcoded widths
        const width = label.style.width || '';
        const flexBasis = label.style.flexBasis || '';
        
        // Also check computed style if it looks hardcoded (not auto/max-content)
        // This is tricky because computed width is always in pixels.
        // But we can check if the width property is set in the inline style or a stylesheet that isn't 'auto'
        // However, a better way is to see if the width is exactly the same across all labels even if text length differs,
        // but subgrid also does that.
        
        // The most reliable check for "manual width" in this context is checking if the 
        // row container is NOT a subgrid OR if labels have a fixed width property set.
        const inlineWidth = label.style.width;
        if (inlineWidth && inlineWidth !== 'auto' && inlineWidth !== 'initial') return true;
        
        return false;
      });
    });

    // We want this to be false for demo.html
    expect(usesManualWidths).toBe(false);
  });

  test('Row containers should not define their own independent grid-template-columns', async ({ page }) => {
    const rowHasIncorrectLayout = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return true;
      return labels.some(label => {
        const row = label.parentElement;
        if (!row) return true;
        const style = window.getComputedStyle(row);
        
        // It must be a grid
        if (style.display !== 'grid' && style.display !== 'inline-grid') return true;
        
        // It must be a subgrid
        return !style.gridTemplateColumns.startsWith('subgrid');
      });
    });

    expect(rowHasIncorrectLayout).toBe(false);
  });

});
