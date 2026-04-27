import { test, expect, Page } from '@playwright/test';
import path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const targetUrl = `file://${targetFile}`;

/**
 * Robustly find form rows.
 * A row is defined as a container that is a parent of a <label> and an <input>.
 * We expect multiple such rows to exist within a common parent.
 */
async function getFormRows(page: Page) {
  return await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const rows = labels
      .map(label => {
        const row = label.parentElement;
        const input = row?.querySelector('input, select, textarea');
        if (row && input) {
          return {
            rowSelector: `label[for="${label.getAttribute('for')}"]`,
            labelElement: label,
            inputElement: input as HTMLElement,
            rowElement: row
          };
        }
        return null;
      })
      .filter(item => item !== null);
    
    const uniqueRows = Array.from(new Set(rows.map(r => r.rowElement)));
    return uniqueRows.map(row => {
      const label = row.querySelector('label');
      const input = row.querySelector('input, select, textarea');
      return {
        rowTagName: row.tagName,
        rowClassName: row.className,
        labelTagName: label?.tagName,
        inputTagName: input?.tagName
      };
    });
  });
}

test.describe('Form Label-Input Alignment Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');
  });

  test('The parent container must establish a grid context with defined column tracks', async ({ page }) => {
    const gridStatus = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length < 2) return { error: 'Not enough labels found' };
      
      const row1 = labels[0].parentElement;
      const row2 = labels[1].parentElement;
      if (!row1 || !row2) return { error: 'Rows not found' };
      
      const container = row1.parentElement;
      if (!container || container !== row2.parentElement) return { error: 'Rows do not share the same parent' };
      
      const style = window.getComputedStyle(container);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns
      };
    });

    expect(gridStatus.display).toBe('grid');
    expect(gridStatus.gridTemplateColumns).not.toBe('none');
    expect(gridStatus.gridTemplateColumns).not.toBe('');
  });

  test('Structural row wrappers must use subgrid to align children with the parent grid', async ({ page }) => {
    const rowStatus = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return { error: 'No labels found' };
      
      const row = labels[0].parentElement;
      if (!row) return { error: 'Row not found' };
      
      const style = window.getComputedStyle(row);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns
      };
    });

    expect(rowStatus.display).toBe('grid');
    expect(rowStatus.gridTemplateColumns).toMatch(/^subgrid/);
  });

  test('Labels and input fields must maintain consistent vertical alignment across different rows', async ({ page }) => {
    const alignment = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      
      if (labels.length < 2 || inputs.length < 2) return { error: 'Not enough elements' };
      
      const labelLefts = labels.map(l => l.getBoundingClientRect().left);
      const inputLefts = inputs.map(i => i.getBoundingClientRect().left);
      
      const allLabelsAligned = labelLefts.every(left => Math.abs(left - labelLefts[0]) <= 1);
      const allInputsAligned = inputLefts.every(left => Math.abs(left - inputLefts[0]) <= 1);
      
      return {
        allLabelsAligned,
        allInputsAligned
      };
    });

    expect(alignment.allLabelsAligned).toBe(true);
    expect(alignment.allInputsAligned).toBe(true);
    
    const rowStatus = await page.evaluate(() => {
      const label = document.querySelector('label');
      const row = label?.parentElement;
      if (!row) return null;
      return window.getComputedStyle(row).gridTemplateColumns;
    });
    expect(rowStatus).toMatch(/^subgrid/);
  });

  test('The layout must dynamically adjust the label column width to accommodate the longest label', async ({ page }) => {
    const dynamicAdjustment = await page.evaluate(async () => {
      const labels = Array.from(document.querySelectorAll('label'));
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      if (labels.length < 2 || inputs.length < 2) return { error: 'Not enough elements' };

      const initialInputLeft = inputs[0].getBoundingClientRect().left;
      const targetLabel = labels[0];
      const originalText = targetLabel.textContent;
      
      targetLabel.textContent = "This is an extremely long label that should push the input column further to the right";
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      const newInputLefts = inputs.map(i => i.getBoundingClientRect().left);
      const allStillAligned = newInputLefts.every(left => Math.abs(left - newInputLefts[0]) <= 1);
      const hasPushed = newInputLefts[0] > initialInputLeft + 50;

      targetLabel.textContent = originalText;
      
      return {
        allStillAligned,
        hasPushed
      };
    });

    expect(dynamicAdjustment.allStillAligned).toBe(true);
    expect(dynamicAdjustment.hasPushed).toBe(true);
  });

  test('Should not use fixed width or min-width on labels for alignment', async ({ page }) => {
    const isFixed = await page.evaluate(() => {
      const label = document.querySelector('label');
      if (!label) return false;
      
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j] as CSSStyleRule;
            if (rule.selectorText && rule.selectorText.includes('label')) {
              if (rule.style.width && rule.style.width.endsWith('px')) return true;
              if (rule.style.minWidth && rule.style.minWidth.endsWith('px')) return true;
              if (rule.style.flexBasis && rule.style.flexBasis.endsWith('px')) return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(isFixed).toBe(false);
  });

  test('Row wrappers should not use display: flex', async ({ page }) => {
    const rowDisplay = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return null;
      const row = labels[0].parentElement;
      return window.getComputedStyle(row!).display;
    });

    expect(rowDisplay).not.toBe('flex');
    expect(rowDisplay).not.toBe('inline-flex');
  });

  test('Row wrappers should not manually duplicate grid track definitions', async ({ page }) => {
    const gridTracks = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return null;
      const row = labels[0].parentElement;
      if (!row) return null;
      return window.getComputedStyle(row).gridTemplateColumns;
    });

    expect(gridTracks).toMatch(/^subgrid/);
  });
});
