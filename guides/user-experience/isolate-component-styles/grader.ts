import { test, expect } from '@playwright/test';

// @ts-ignore
const targetFile = process.env.TARGET_FILE || 'demo.html';

test.describe('CSS Style Isolation Grader', () => {
  test.beforeEach(async ({ page }) => {
    // @ts-ignore
    const url = targetFile.startsWith('/') ? `file://${targetFile}` : `file://${process.cwd()}/${targetFile}`;
    await page.goto(url);
  });

  test('should use the "revert" keyword for style isolation', async ({ page }) => {
    const usesRevert = await page.evaluate(() => {
      const hasRevertInSheets = Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              return rule.style.getPropertyValue('all') === 'revert' || 
                     rule.style.cssText.toLowerCase().includes('revert');
            }
            return false;
          });
        } catch {
          return false;
        }
      });
      const hasRevertInline = Array.from(document.querySelectorAll('*')).some(el => {
        const style = (el as HTMLElement).style;
        return style && (style.getPropertyValue('all') === 'revert' || 
                         style.cssText.toLowerCase().includes('revert'));
      });
      return hasRevertInSheets || hasRevertInline;
    });
    expect(usesRevert).toBe(true);
  });

  test('should have a div or section with display: block in isolated components', async ({ page }) => {
    const allDivsCorrect = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const className = el.className || '';
        const styleAttr = el.getAttribute('style') || '';
        const classStr = typeof className === 'string' ? className : (typeof className === 'object' && className !== null ? (className as any).baseVal : '');
        return /(?:^|\s)(?:reset|isolated|component|target)(?:$|\s|-)/i.test(classStr || '') ||
               styleAttr.toLowerCase().includes('revert');
      });
      
      if (containers.length === 0) return false;

      return containers.every(container => {
        // Check container itself if it's a div/section
        if (container.tagName === 'DIV' || container.tagName === 'SECTION') {
          if (window.getComputedStyle(container).display === 'inline') return false;
        }
        // Check divs inside
        const innerDivs = Array.from(container.querySelectorAll('div'));
        return innerDivs.every(div => window.getComputedStyle(div).display === 'block');
      });
    });
    expect(allDivsCorrect).toBe(true);
  });

  test('should isolate from inherited styles like color', async ({ page }) => {
    const isIsolated = await page.evaluate(() => {
      // Set a unique color on the body to test inheritance
      const testColor = 'rgb(1, 2, 3)';
      document.body.style.setProperty('color', testColor, 'important');
      
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const className = el.className || '';
        const styleAttr = el.getAttribute('style') || '';
        const classStr = typeof className === 'string' ? className : (typeof className === 'object' && className !== null ? (className as any).baseVal : '');
        return /(?:^|\s)(?:reset|isolated|component|target)(?:$|\s|-)/i.test(classStr || '') ||
               styleAttr.toLowerCase().includes('revert');
      });

      if (containers.length === 0) return false;

      return containers.every(container => {
        const p = container.querySelector('p');
        if (!p) return true;
        
        const pColor = window.getComputedStyle(p).color;
        // If isolated correctly, it should NOT inherit the testColor from body
        return pColor !== testColor;
      });
    });
    expect(isIsolated).toBe(true);
  });

  test('should not use the "initial" keyword for the "all" property', async ({ page }) => {
    const usesInitial = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              return rule.style.getPropertyValue('all') === 'initial' || 
                     rule.style.cssText.toLowerCase().includes('all: initial');
            }
            return false;
          });
        } catch { return false; }
      });
    });
    expect(usesInitial).toBe(false);
  });

  test('should not use the "unset" keyword for the "all" property', async ({ page }) => {
    const usesUnset = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            if (rule instanceof CSSStyleRule) {
              return rule.style.getPropertyValue('all') === 'unset' || 
                     rule.style.cssText.toLowerCase().includes('all: unset');
            }
            return false;
          });
        } catch { return false; }
      });
    });
    expect(usesUnset).toBe(false);
  });

  test('should maintain native browser appearance for buttons in isolated components', async ({ page }) => {
    const allButtonsNative = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('*')).filter(el => {
        const className = el.className || '';
        const styleAttr = el.getAttribute('style') || '';
        const classStr = typeof className === 'string' ? className : (typeof className === 'object' && className !== null ? (className as any).baseVal : '');
        return /(?:^|\s)(?:reset|isolated|component|target)(?:$|\s|-)/i.test(classStr || '') ||
               styleAttr.toLowerCase().includes('revert');
      });

      if (containers.length === 0) return false;

      return containers.every(container => {
        const buttons = Array.from(container.querySelectorAll('button'));
        if (buttons.length === 0) return true;
        
        return buttons.every(button => {
          const style = window.getComputedStyle(button);
          // Heuristics for manual styles in negative-demo
          const isManual = style.backgroundColor === 'rgb(128, 128, 128)' || 
                           style.backgroundImage.includes('linear-gradient') ||
                           style.borderStyle === 'outset' ||
                           style.cursor === 'crosshair';
          
          return !isManual;
        });
      });
    });
    expect(allButtonsNative).toBe(true);
  });
});
