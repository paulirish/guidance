import { test, expect } from '@playwright/test';

const targetUrl = process.env.TARGET_FILE || 'http://localhost:3000';

test.describe('Restore Element Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${targetUrl}`);
  });

  test('should reveal hidden elements using the revert keyword', async ({ page }) => {
    // Reveal elements
    const button = page.getByRole('button');
    await button.first().click();

    const usedRevert = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && (el.classList.contains('test-target-element') || el.id.startsWith('element-') || el.classList.contains('chip') || el.classList.contains('box'));
      });

      return targets.some(el => {
        const inlineStyle = (el as HTMLElement).style.display;
        const hasRevertRule = Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule instanceof CSSStyleRule && el.matches(rule.selectorText) && rule.style.display === 'revert';
            });
          } catch (e) { return false; }
        });
        return inlineStyle === 'revert' || hasRevertRule;
      });
    });

    expect(usedRevert).toBe(true);
  });

  test('should not have hardcoded display values in any style origin when revealed', async ({ page }) => {
    // Reveal
    const button = page.getByRole('button');
    await button.first().click();

    const hasHardcoded = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && (el.classList.contains('test-target-element') || el.id.startsWith('element-') || el.classList.contains('chip') || el.classList.contains('box'));
      });

      const hardcodedValues = ['block', 'inline', 'flex', 'grid', 'list-item', 'table'];

      return targets.some(el => {
        // Check inline style
        const inline = (el as HTMLElement).style.display;
        if (hardcodedValues.includes(inline)) return true;

        // Check CSS rules specifically for the revealed state (not the base state)
        // We look for rules that are NOT 'revert' but set a hardcoded display
        // and are likely responsible for revelation (e.g. they don't have 'none')
        return Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                const val = rule.style.display;
                return hardcodedValues.includes(val);
              }
              return false;
            });
          } catch (e) { return false; }
        });
      });
    });

    expect(hasHardcoded).toBe(false);
  });

  test('should not use manual data-attributes for layout tracking', async ({ page }) => {
    const hasManualTracking = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      return all.some(el => {
        const attrs = el.getAttributeNames();
        return attrs.some(name => 
          name.includes('data-original') || 
          name.includes('data-display') || 
          name.includes('data-old')
        );
      });
    });

    expect(hasManualTracking).toBe(false);
  });

  test('should correctly restore the natural layout behavior for diverse element types using revert', async ({ page }) => {
    // Reveal
    const button = page.getByRole('button');
    await button.first().click();

    const results = await page.evaluate(() => {
      const div = document.querySelector('div.test-target-element, div#element-1') as HTMLElement;
      const span = document.querySelector('span.test-target-element, span#element-2') as HTMLElement;
      const li = document.querySelector('li.test-target-element, li#element-4') as HTMLElement;

      const checkRevert = (el: HTMLElement | null) => {
        if (!el) return false;
        const inline = el.style.display;
        const hasRevertRule = Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => {
              return rule instanceof CSSStyleRule && el.matches(rule.selectorText) && rule.style.display === 'revert';
            });
          } catch (e) { return false; }
        });
        return inline === 'revert' || hasRevertRule;
      };

      return {
        div: div ? { display: window.getComputedStyle(div).display, usesRevert: checkRevert(div) } : null,
        span: span ? { display: window.getComputedStyle(span).display, usesRevert: checkRevert(span) } : null,
        li: li ? { display: window.getComputedStyle(li).display, usesRevert: checkRevert(li) } : null
      };
    });

    // Check that they have correct display AND used revert
    if (results.div) {
      expect(results.div.display).toBe('block');
      expect(results.div.usesRevert).toBe(true);
    }
    if (results.span) {
      expect(results.span.display).toBe('inline');
      expect(results.span.usesRevert).toBe(true);
    }
    if (results.li) {
      expect(results.li.display).toBe('list-item');
      expect(results.li.usesRevert).toBe(true);
    }
  });
});
