import { test, expect, type Page } from '@playwright/test';

declare const process: any;
const targetUrl = (typeof process !== 'undefined' ? process.env.TARGET_FILE : null) || 'http://localhost:3000/demo.html';

// Helper to get cards - more robustly identifying the card components
async function getCards(page: Page) {
  // First, identify all potential candidates
  const candidates = await page.locator('article, .card, [class*="card"], [class*="Card"]').all();
  const cards = [];
  for (const candidate of candidates) {
    const info = await candidate.evaluate(el => {
      const cls = el.className.toLowerCase();
      const isInternal = cls.includes('header') || cls.includes('footer') || cls.includes('content') || cls.includes('body') || cls.includes('title');
      return {
        isInternal,
        tagName: el.tagName,
        className: el.className
      };
    });
    
    if (!info.isInternal && (info.tagName === 'ARTICLE' || info.className.toLowerCase().includes('card'))) {
      // Check if we already have this element (to avoid duplicates from multiple selectors)
      cards.push(candidate);
    }
  }
  
  // Deduplicate by comparing element handles
  const uniqueCards = [];
  for (const card of cards) {
    let isDuplicate = false;
    for (const unique of uniqueCards) {
      if (await card.evaluate((el, other) => el === other, await unique.elementHandle())) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) uniqueCards.push(card);
  }
  
  return uniqueCards;
}

test.describe('Subgrid Alignment Grader', () => {
  test.setTimeout(10000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${targetUrl}`);
    // Wait for a bit to ensure styles are applied and JS has run (if any)
    await page.waitForTimeout(500);
  });

  test('Parent container must be a grid container', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThan(0);
    
    const firstCard = cards[0];
    const parentDisplay = await firstCard.evaluate(el => {
      const parent = el.parentElement;
      return parent ? window.getComputedStyle(parent).display : '';
    });
    expect(parentDisplay).toBe('grid');
  });

  test('Card components must use subgrid for grid-template-rows', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThan(0);
    
    for (const card of cards) {
      const isSubgrid = await card.evaluate(el => {
        const style = window.getComputedStyle(el);
        if (style.gridTemplateRows === 'subgrid') return true;
        
        // In some environments, getComputedStyle returns the resolved tracks.
        // We check the CSS rules as a fallback.
        try {
          return Array.from(document.styleSheets).some(sheet => {
            try {
              return Array.from(sheet.cssRules).some(rule => {
                if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                  return rule.style.gridTemplateRows === 'subgrid';
                }
                return false;
              });
            } catch (e) { return false; }
          });
        } catch (e) { return false; }
      });
      
      const display = await card.evaluate(el => window.getComputedStyle(el).display);
      
      expect(display).toBe('grid');
      expect(isSubgrid).toBe(true);
    }
  });

  test('Internal elements must have identical heights across cards in a row', async ({ page }) => {
    const cards = await getCards(page);
    expect(cards.length).toBeGreaterThan(1);

    const cardRects = await Promise.all(cards.map(c => c.boundingBox()));
    
    const rows: any[][] = [];
    for (let i = 0; i < cards.length; i++) {
      const rect = cardRects[i];
      if (!rect) continue;
      let foundRow = false;
      for (const row of rows) {
        const firstInRowRect = await row[0].boundingBox();
        if (firstInRowRect && Math.abs(rect.y - firstInRowRect.y) < 10) {
          row.push(cards[i]);
          foundRow = true;
          break;
        }
      }
      if (!foundRow) rows.push([cards[i]]);
    }

    for (const row of rows) {
      if (row.length < 2) continue;

      const headers = [];
      const bodies = [];
      const footers = [];

      for (const card of row) {
        headers.push(card.locator('header, [class*="header"], [class*="title"]').first());
        bodies.push(card.locator('div:not(header):not(footer):not([class*="header"]):not([class*="footer"]):not([class*="title"]), [class*="content"], [class*="body"]').first());
        footers.push(card.locator('footer, [class*="footer"]').first());
      }

      // Check headers
      const headerRects = await Promise.all(headers.map(h => h.isVisible().then((v: boolean) => v ? h.boundingBox() : null)));
      const firstHeaderHeight = headerRects.find(r => r)?.height;
      if (firstHeaderHeight !== undefined) {
        for (const rect of headerRects) {
          if (rect) {
            expect(rect.height).toBeCloseTo(firstHeaderHeight, 1);
            expect(rect.y).toBeCloseTo(headerRects.find(r => r)!.y, 1);
          }
        }
      }

      // Check bodies
      const bodyRects = await Promise.all(bodies.map(b => b.isVisible().then((v: boolean) => v ? b.boundingBox() : null)));
      const firstBodyHeight = bodyRects.find(r => r)?.height;
      if (firstBodyHeight !== undefined) {
        for (const rect of bodyRects) {
          if (rect) {
            expect(rect.height).toBeCloseTo(firstBodyHeight, 1);
          }
        }
      }

      // Check footers
      const footerRects = await Promise.all(footers.map(f => f.isVisible().then((v: boolean) => v ? f.boundingBox() : null)));
      const firstFooterHeight = footerRects.find(r => r)?.height;
      if (firstFooterHeight !== undefined) {
        for (const rect of footerRects) {
          if (rect) {
            expect(rect.height).toBeCloseTo(firstFooterHeight, 1);
          }
        }
      }
    }
  });

  test('Should not use fixed heights or magic numbers on internal elements', async ({ page }) => {
    const cards = await getCards(page);
    const firstCard = cards[0];
    const internalElements = await firstCard.locator('header, footer, [class*="header"], [class*="footer"], [class*="content"], [class*="body"]').all();
    
    for (const el of internalElements) {
      const isFixedHeight = await el.evaluate(node => {
        const style = window.getComputedStyle(node);
        if ((node as HTMLElement).style.height && (node as HTMLElement).style.height !== 'auto') return true;
        
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              if (rule instanceof CSSStyleRule && node.matches(rule.selectorText)) {
                const h = rule.style.height;
                const mh = rule.style.minHeight;
                const isFixed = (h && h !== 'auto' && h !== 'initial' && h !== 'inherit' && h !== '100%' && !h.includes('fr')) ||
                                (mh && mh !== '0px' && mh !== 'auto' && mh !== 'initial' && mh !== 'inherit' && mh !== '100%');
                return isFixed;
              }
              return false;
            });
          } catch (e) { return false; }
        });
      });
      expect(isFixedHeight, `Internal element ${await el.evaluate(e => e.className)} should not have fixed height`).toBe(false);
    }
  });

  test('Should not rely on JavaScript for alignment', async ({ page }) => {
    // Check for inline height styles (common symptom of JS height syncing)
    const cards = await getCards(page);
    for (const card of cards) {
      const internals = await card.locator('header, footer, [class*="header"], [class*="footer"], [class*="content"], [class*="body"]').all();
      for (const el of internals) {
        const inlineHeight = await el.evaluate(node => (node as HTMLElement).style.height);
        expect(inlineHeight).toBe('');
      }
    }
  });

  test('Alignment must be responsive to content changes without JS intervention', async ({ page }) => {
    const cards = await getCards(page);
    if (cards.length < 2) return;

    const row1 = cards.slice(0, 2);
    const header1 = row1[0].locator('header, [class*="header"], [class*="title"]').first();
    const header2 = row1[1].locator('header, [class*="header"], [class*="title"]').first();

    if (!(await header1.isVisible()) || !(await header2.isVisible())) return;

    const initialHeight2 = (await header2.boundingBox())?.height || 0;

    // Inject content into header1
    await header1.evaluate(el => {
      const div = document.createElement('div');
      div.style.height = '100px';
      div.innerText = 'Extra Content';
      el.appendChild(div);
    });

    // Wait a frame for layout
    await page.evaluate(() => new Promise(requestAnimationFrame));

    const newHeight1 = (await header1.boundingBox())?.height || 0;
    const newHeight2 = (await header2.boundingBox())?.height || 0;
    
    // In a subgrid layout, header2 MUST grow to match header1
    expect(newHeight2).toBeGreaterThan(initialHeight2);
    expect(newHeight2).toBeCloseTo(newHeight1, 1);
  });
});
