import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';

test.describe('CSS Style Isolation Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${targetFile}`);
  });

  test('should use the revert keyword for style isolation', async ({ page }) => {
    const hasRevert = await page.evaluate(() => {
      function getTargetElements() {
        const selectors: string[] = [];
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule) {
                const cssText = rule.style.cssText.toLowerCase();
                if (cssText.includes('revert')) selectors.push(rule.selectorText);
              }
            }
          } catch (e) {}
        }
        let elements: Element[] = [];
        for (const sel of selectors) {
          try { elements.push(...Array.from(document.querySelectorAll(sel))); } catch (e) {}
        }
        elements.push(...Array.from(document.querySelectorAll('*')).filter(el => {
          const style = (el as HTMLElement).style;
          return style && (style.all === 'revert' || style.cssText.toLowerCase().includes('revert'));
        }));
        return Array.from(new Set(elements));
      }
      return getTargetElements().length > 0;
    });
    expect(hasRevert).toBe(true);
  });

  test('should not use the initial keyword for style isolation', async ({ page }) => {
    const usesInitial = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              const cssText = rule.style.cssText.toLowerCase();
              if (cssText.includes('all: initial') || rule.style.all === 'initial') return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(usesInitial).toBe(false);
  });

  test('should not use the unset keyword for style isolation', async ({ page }) => {
    const usesUnset = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              const cssText = rule.style.cssText.toLowerCase();
              if (cssText.includes('all: unset') || rule.style.all === 'unset') return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(usesUnset).toBe(false);
  });

  test('should have a div or section with display: block in isolated components', async ({ page }) => {
    const result = await page.evaluate(() => {
      function getTargetElements() {
        const selectors: string[] = [];
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule) {
                const cssText = rule.style.cssText.toLowerCase();
                if (cssText.includes('revert')) selectors.push(rule.selectorText);
              }
            }
          } catch (e) {}
        }
        let elements: Element[] = [];
        for (const sel of selectors) {
          try { elements.push(...Array.from(document.querySelectorAll(sel))); } catch (e) {}
        }
        elements.push(...Array.from(document.querySelectorAll('*')).filter(el => {
          const style = (el as HTMLElement).style;
          return style && (style.all === 'revert' || style.cssText.toLowerCase().includes('revert'));
        }));
        return Array.from(new Set(elements));
      }

      const isolated = getTargetElements();
      if (isolated.length === 0) return false;

      for (const root of isolated) {
        if ((root.tagName === 'DIV' || root.tagName === 'SECTION') && window.getComputedStyle(root).display === 'block') return true;
        const children = root.querySelectorAll('div, section');
        for (const child of Array.from(children)) {
          if (window.getComputedStyle(child).display === 'block') return true;
        }
      }
      return false;
    });
    expect(result).toBe(true);
  });

  test('should maintain UA default font-weight for headings in isolated components', async ({ page }) => {
    const result = await page.evaluate(() => {
      function getTargetElements() {
        const selectors: string[] = [];
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule) {
                const cssText = rule.style.cssText.toLowerCase();
                if (cssText.includes('revert')) selectors.push(rule.selectorText);
              }
            }
          } catch (e) {}
        }
        let elements: Element[] = [];
        for (const sel of selectors) {
          try { elements.push(...Array.from(document.querySelectorAll(sel))); } catch (e) {}
        }
        elements.push(...Array.from(document.querySelectorAll('*')).filter(el => {
          const style = (el as HTMLElement).style;
          return style && (style.all === 'revert' || style.cssText.toLowerCase().includes('revert'));
        }));
        return Array.from(new Set(elements));
      }

      const isolated = getTargetElements();
      if (isolated.length === 0) return false;

      for (const root of isolated) {
        let headings = [];
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(root.tagName)) headings.push(root);
        headings.push(...Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')));
        for (const h of headings) {
          const fw = window.getComputedStyle(h).fontWeight;
          if (fw === 'bold' || parseInt(fw) >= 700) return true;
        }
      }
      return false;
    });
    expect(result).toBe(true);
  });

  test('should isolate headings from inherited styles like font-weight', async ({ page }) => {
    const result = await page.evaluate(() => {
      function getTargetElements() {
        const selectors: string[] = [];
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule) {
                const cssText = rule.style.cssText.toLowerCase();
                if (cssText.includes('revert')) selectors.push(rule.selectorText);
              }
            }
          } catch (e) {}
        }
        let elements: Element[] = [];
        for (const sel of selectors) {
          try { elements.push(...Array.from(document.querySelectorAll(sel))); } catch (e) {}
        }
        elements.push(...Array.from(document.querySelectorAll('*')).filter(el => {
          const style = (el as HTMLElement).style;
          return style && (style.all === 'revert' || style.cssText.toLowerCase().includes('revert'));
        }));
        return Array.from(new Set(elements));
      }

      const isolated = getTargetElements();
      if (isolated.length === 0) return false;

      let h2 = null;
      for (const root of isolated) {
        if (root.tagName === 'H2') { h2 = root; break; }
        h2 = root.querySelector('h2');
        if (h2) break;
      }
      if (!h2) return false;

      const parent = (h2 as HTMLElement).parentElement!;
      const oldWeight = parent.style.fontWeight;
      parent.style.fontWeight = '100';
      const computedWeight = window.getComputedStyle(h2).fontWeight;
      parent.style.fontWeight = oldWeight;

      const weightNum = parseInt(computedWeight);
      return (computedWeight === 'bold' || weightNum >= 700);
    });
    expect(result).toBe(true);
  });
});
