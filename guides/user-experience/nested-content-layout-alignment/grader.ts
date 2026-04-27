import { test, expect } from '@playwright/test';
import * as path from 'path';

const TARGET_FILE = process.env.TARGET_FILE || '';
const TARGET_URL = TARGET_FILE ? `file://${path.resolve(TARGET_FILE)}` : '';

test.describe('Nested Content Layout Alignment (Subgrid)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TARGET_URL);
  });

  test('Nested elements must use subgrid to inherit tracks', async ({ page }) => {
    const subgridCount = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.startsWith('subgrid') || style.gridTemplateRows.startsWith('subgrid');
      }).length;
    });
    expect(subgridCount).toBeGreaterThan(0);
  });

  test('Nested grid items must align precisely with the ancestor grid', async ({ page }) => {
    const alignment = await page.evaluate(() => {
      const rootGrid = Array.from(document.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'grid' && (!el.parentElement || window.getComputedStyle(el.parentElement).display !== 'grid');
      }) || document.body;

      const references = Array.from(rootGrid.children).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && el.getBoundingClientRect().width > 0;
      });

      const nestedItems = Array.from(document.querySelectorAll('*')).filter(el => {
        const parent = el.parentElement;
        if (!parent) return false;
        const parentStyle = window.getComputedStyle(parent);
        const isChildOfSubgrid = parentStyle.gridTemplateColumns.startsWith('subgrid') || parentStyle.gridTemplateRows.startsWith('subgrid');
        
        let depth = 0;
        let p = parent;
        while (p && p !== rootGrid) {
          depth++;
          p = p.parentElement!;
        }
        
        return isChildOfSubgrid && depth >= 1 && el.getBoundingClientRect().width > 0 && !el.matches('header, footer, nav');
      });

      if (references.length === 0 || nestedItems.length === 0) return false;
      
      for (const nested of nestedItems) {
        const nestedRect = nested.getBoundingClientRect();
        for (const ref of references) {
          const refRect = ref.getBoundingClientRect();
          const startsMatch = Math.abs(refRect.left - nestedRect.left) < 1;
          const widthsMatch = Math.abs(refRect.width - nestedRect.width) < 1;
          if (startsMatch && widthsMatch) return true;
        }
      }
      return false;
    });
    expect(alignment).toBe(true);
  });

  test('Changes to parent grid tracks must automatically reflect in nested elements', async ({ page }) => {
    const isReactive = await page.evaluate(async () => {
      const rootGrid = Array.from(document.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'grid';
      }) as HTMLElement | undefined;

      if (!rootGrid) return false;

      const nested = Array.from(document.querySelectorAll('*')).find(el => {
        const parent = el.parentElement;
        if (!parent) return false;
        const parentStyle = window.getComputedStyle(parent);
        const isChildOfSubgrid = parentStyle.gridTemplateColumns.startsWith('subgrid') || parentStyle.gridTemplateRows.startsWith('subgrid');
        return isChildOfSubgrid && el.getBoundingClientRect().width > 0;
      });

      if (!nested) return false;

      const initialWidth = nested.getBoundingClientRect().width;
      rootGrid.style.setProperty('grid-template-columns', '[page-full-start] 20px [page-content-start] 200px [page-content-end] 20px [page-full-end]', 'important');
      
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 100)); 
      
      const newWidth = nested.getBoundingClientRect().width;
      return Math.abs(initialWidth - newWidth) > 1;
    });
    expect(isReactive).toBe(true);
  });

  test('Must not use display: contents on nested containers for alignment', async ({ page }) => {
    const usesDisplayContents = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => el.children.length > 0);
      return containers.some(el => window.getComputedStyle(el).display === 'contents');
    });
    expect(usesDisplayContents).toBe(false);
  });

  test('Must not rely on manual calc() or percentages for alignment', async ({ page }) => {
    const usesManualAlignment = await page.evaluate(async () => {
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      const manualByStyle = allElements.some(el => el.style.width.includes('calc') || el.style.width.includes('%'));
      if (manualByStyle) return true;

      for (const el of allElements) {
        if (el.getBoundingClientRect().width === 0) continue;
        const parent = el.parentElement;
        if (!parent) continue;
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display.includes('grid') || parentStyle.gridTemplateColumns.startsWith('subgrid')) continue;

        const initialWidth = el.getBoundingClientRect().width;
        const initialParentWidth = parent.getBoundingClientRect().width;
        if (initialParentWidth === 0) continue;

        const originalWidth = parent.style.width;
        parent.style.setProperty('width', (initialParentWidth + 100) + 'px', 'important');
        await new Promise(r => requestAnimationFrame(r));
        const newWidth = el.getBoundingClientRect().width;
        parent.style.width = originalWidth;

        if (Math.abs(newWidth - initialWidth) > 0 && Math.abs(newWidth - (initialParentWidth + 100)) > 5) return true;
      }

      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule && (rule.style.width.includes('calc') || rule.style.width.includes('%'))) {
              const elements = document.querySelectorAll(rule.selectorText);
              return Array.from(elements).some(el => el.parentElement && !window.getComputedStyle(el.parentElement).display.includes('grid'));
            }
            return false;
          });
        } catch (e) { return false; }
      });
    });
    expect(usesManualAlignment).toBe(false);
  });

  test('Must not use negative margins or absolute positioning for breakout', async ({ page }) => {
    const usesBreakoutHacks = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.some(el => {
        const style = window.getComputedStyle(el);
        const hasNegativeMargin = parseInt(style.marginLeft) < 0 || parseInt(style.marginRight) < 0;
        const isAbsolute = style.position === 'absolute';
        if (isAbsolute || hasNegativeMargin) {
            const rect = el.getBoundingClientRect();
            const parentRect = el.parentElement ? el.parentElement.getBoundingClientRect() : rect;
            return rect.width > parentRect.width + 1;
        }
        return false;
      });
    });
    expect(usesBreakoutHacks).toBe(false);
  });
});


