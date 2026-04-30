import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Grader for the "script-initialization-fouc" guide.
 * This test suite verifies that the implementation prevents Flash of Unstyled Content (FOUC)
 * and layout shifts using the standard @media (scripting: enabled) media query.
 */

const targetFile = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const targetUrl = `file://${targetFile}`;

test.describe('Scripting Media Query Grader', () => {

  test('CSS must use the @media (scripting: enabled) media query', async ({ page }) => {
    await page.goto(targetUrl);
    const hasScriptingMedia = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.some(sheet => {
        try {
          const rules = Array.from(sheet.cssRules);
          return rules.some(rule => 
            rule.type === CSSRule.MEDIA_RULE && 
            /scripting\s*:\s*enabled/.test((rule as CSSMediaRule).media.mediaText)
          );
        } catch (e) {
          return false;
        }
      });
    });
    expect(hasScriptingMedia).toBe(true);
  });

  test('Main content must be visible when JavaScript is disabled', async ({ browser }) => {
    // Environments with scripting: none should still show content.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(targetUrl);
    
    const isVisible = await page.evaluate(() => {
      // Find elements that represent the main content/UI.
      // We look for any visible element that contains text and isn't just a meta/script/style tag.
      const elements = Array.from(document.querySelectorAll('body *:not(script):not(style):not(noscript)'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const hasContent = el.textContent?.trim().length ?? 0 > 0;
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0 &&
               hasContent;
      });
    });
    
    expect(isVisible).toBe(true);
    await context.close();
  });

  test('Implementation must not rely on inline scripts adding classes to html/body', async ({ page }) => {
    await page.goto(targetUrl);
    const hasHacking = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).filter(s => !s.src);
      return scripts.some(s => {
        const t = s.textContent || '';
        // Look for patterns that touch documentElement or body and modify classList/className
        const targetsDocumentElement = t.includes('documentElement');
        const targetsBody = t.includes('document.body');
        const manipulatesClass = t.includes('className') || t.includes('classList');
        const commonClassNames = /js-active|js-enabled|no-js|has-js/.test(t);
        return (targetsDocumentElement || targetsBody) && (manipulatesClass || commonClassNames);
      });
    });
    expect(hasHacking).toBe(false);
  });

  test('Script-dependent elements must be hidden while uninitialized but occupy space', async ({ page }) => {
    await page.goto(targetUrl);
    
    // We identify "script-dependent elements" as those targeted by the (scripting: enabled) media query.
    const stats = await page.evaluate(() => {
      const selectors: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.type === CSSRule.MEDIA_RULE && /scripting\s*:\s*enabled/.test((rule as CSSMediaRule).media.mediaText)) {
              for (const subRule of Array.from((rule as CSSMediaRule).cssRules)) {
                if ((subRule as CSSStyleRule).selectorText) {
                  selectors.push((subRule as CSSStyleRule).selectorText);
                }
              }
            }
          }
        } catch (e) {}
      }
      
      if (selectors.length === 0) return null;
      
      return selectors.flatMap(sel => {
        // We match elements that currently fit the "uninitialized" selector state.
        // e.g., ".test-target-element:not(.js-initialized)"
        const els = Array.from(document.querySelectorAll(sel));
        return els.map(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            selector: sel,
            isHidden: style.visibility === 'hidden' || style.opacity === '0' || style.display === 'none',
            hasSpace: rect.height > 0 && rect.width > 0,
            rect: { height: rect.height, width: rect.width }
          };
        });
      });
    });

    expect(stats, 'Should find elements targeted by @media (scripting: enabled)').not.toBeNull();
    if (stats) {
      expect(stats.length).toBeGreaterThan(0);
      for (const s of stats) {
        expect(s.isHidden, `Element matching selector "${s.selector}" should be hidden initially to prevent FOUC`).toBe(true);
        expect(s.hasSpace, `Element matching selector "${s.selector}" should reserve space to prevent layout shift`).toBe(true);
      }
    }
  });

  test('Page must maintain a stable layout during initialization (low CLS)', async ({ page }) => {
    // Measurement for Cumulative Layout Shift (CLS)
    await page.addInitScript(() => {
      (window as any).cumulativeLayoutShift = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).cumulativeLayoutShift += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(targetUrl);
    
    // Wait for typical script-driven initialization (demo uses 1.5s/2s)
    await page.waitForTimeout(3000);
    
    const cls = await page.evaluate(() => (window as any).cumulativeLayoutShift);
    
    // A stable layout should have a CLS near 0. 
    // negative-demo.html will trigger a significant shift when the chart jumps from 0 to 500px.
    expect(cls, 'Cumulative Layout Shift should be minimal (< 0.01)').toBeLessThan(0.01);
  });
});
