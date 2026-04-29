import { test, expect } from '@playwright/test';

declare const process: {
  env: {
    TARGET_FILE?: string;
  };
  cwd(): string;
};

const targetFile = process.env.TARGET_FILE;

if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not set');
}

test.describe('Interactive UI Fallbacks', () => {

  test('The implementation uses the @media (scripting: ...) media queries to manage component visibility', async ({ page }) => {
    await page.goto(`file://${targetFile}`);

    const hasScriptingMediaQuery = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule && (rule.conditionText.includes('scripting: none') || rule.conditionText.includes('scripting: enabled'))) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      }
      return false;
    });

    expect(hasScriptingMediaQuery).toBe(true);
  });

  test('Static fallback content is visible to the user when JavaScript is disabled and does not rely on <noscript>', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`file://${targetFile}`);

    const fallbackVisibleCorrectly = await page.evaluate(() => {
      const isVisible = (el: Element) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
      };

      const allElements = Array.from(document.body.querySelectorAll('*'));
      const visibleElements = allElements.filter(isVisible);
      
      return visibleElements.some(el => {
        let parent: Element | null = el;
        while (parent) {
          if (parent.tagName === 'NOSCRIPT') return false;
          parent = parent.parentElement;
        }

        const text = el.textContent?.toLowerCase() || '';
        return text.includes('manual') || text.includes('disabled') || text.includes('enable javascript') || text.includes('scripting') || text.includes('select and copy');
      });
    });

    expect(fallbackVisibleCorrectly).toBe(true);
    await context.close();
  });

  test('Interactive components are revealed via scripting media query when enabled', async ({ page }) => {
    await page.goto(`file://${targetFile}`);

    const revealedViaMediaQuery = await page.evaluate(() => {
      const interactiveElements = Array.from(document.querySelectorAll('button, [id*="interactive"], [class*="interactive"], [id*="action"], [class*="action"]'));
      if (interactiveElements.length === 0) return false;
      
      const el = interactiveElements[0];
      const isVisible = (element: Element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
      };

      if (!isVisible(el)) return false;

      // Check if the element or any of its parents are affected by a scripting: enabled media query
      let foundMediaQuery = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule && rule.conditionText.includes('scripting: enabled')) {
               for (const subRule of rule.cssRules) {
                 if (subRule instanceof CSSStyleRule) {
                   // Check if el or any parent matches the selector
                   let current: Element | null = el;
                   while (current && current !== document.body) {
                     if (current.matches(subRule.selectorText)) {
                       if (subRule.style.display || subRule.style.visibility || subRule.style.opacity) {
                         foundMediaQuery = true;
                         break;
                       }
                     }
                     current = current.parentElement;
                   }
                   if (foundMediaQuery) break;
                 }
               }
            }
            if (foundMediaQuery) break;
          }
        } catch (e) {}
        if (foundMediaQuery) break;
      }
      return foundMediaQuery;
    });

    expect(revealedViaMediaQuery).toBe(true);
  });

  test('The implementation does not use manual JavaScript to add a .js or .no-js class for conditional styling', async ({ page }) => {
    await page.goto(`file://${targetFile}`);

    const usesManualJSClass = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const hasClassToggling = scripts.some(s => {
        const content = s.textContent || '';
        return (content.includes('classList.add') || content.includes('className =') || content.includes('className +=') || content.includes('classList.remove')) && 
               (content.includes('js') || content.includes('no-js'));
      });
      
      if (!hasClassToggling) return false;

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText.includes('.js') || rule.selectorText.includes('.no-js')) {
                if (rule.style.display || rule.style.visibility || rule.style.opacity) return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(usesManualJSClass).toBe(false);
  });

  test('The implementation does not use <noscript> tags for styling or layout logic possible with scripting media query', async ({ page }) => {
    await page.goto(`file://${targetFile}`);

    const hasNoscriptForLayout = await page.evaluate(() => {
      const noscripts = Array.from(document.querySelectorAll('noscript'));
      if (noscripts.length === 0) return false;
      
      return noscripts.some(ns => {
        const content = ns.innerHTML;
        return /<(div|p|section|article|header|footer|style)/i.test(content);
      });
    });

    expect(hasNoscriptForLayout).toBe(false);
  });
});
