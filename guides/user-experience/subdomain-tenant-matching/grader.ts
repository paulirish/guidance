import { test, expect } from '@playwright/test';

const TARGET_URL = process.env.TARGET_FILE ? `file://${process.env.TARGET_FILE}` : '';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__api_usage = {
      urlPatternConstructed: false,
      urlPatternExecCalled: false,
      regExpUsedForParsing: false,
      stringManipulationUsed: false,
    };

    const OriginalURLPattern = (window as any).URLPattern;
    if (OriginalURLPattern) {
      (window as any).URLPattern = class extends OriginalURLPattern {
        constructor(...args: any[]) {
          (window as any).__api_usage.urlPatternConstructed = true;
          super(...args);
        }
        exec(...args: any[]) {
          (window as any).__api_usage.urlPatternExecCalled = true;
          return super.exec(...args);
        }
      };
    }

    // Trace RegExp usage for hostname parsing
    const OriginalRegExp = window.RegExp;
    (window as any).RegExp = function(...args: any[]) {
      const pattern = args[0];
      // Heuristic: check if regex looks like it's parsing a domain/subdomain
      if (typeof pattern === 'string' && (pattern.includes('\\.') || pattern.includes('[^.]') || pattern.includes('hostname'))) {
        (window as any).__api_usage.regExpUsedForParsing = true;
      }
      return new (OriginalRegExp as any)(...args);
    };
    (window as any).RegExp.prototype = OriginalRegExp.prototype;

    // Trace string manipulation on hostname-like strings
    const strProtos = ['split', 'slice', 'substring'];
    strProtos.forEach(method => {
      const original = (String.prototype as any)[method];
      (String.prototype as any)[method] = function(...args: any[]) {
        // Heuristic: if the string looks like a hostname or URL and we are using these methods
        if (this.includes('.') && (this.includes('http') || this.length > 5)) {
           // We only care if it's used for identification. 
           // In negative-demo it uses split('.') or split('//') or substring
           if (method === 'split' && (args[0] === '.' || args[0] === '//' || args[0] === '/')) {
             (window as any).__api_usage.stringManipulationUsed = true;
           }
           if (method === 'substring' || method === 'slice') {
             (window as any).__api_usage.stringManipulationUsed = true;
           }
        }
        return original.apply(this, args);
      };
    });
    
    // Also trace String.prototype.match for regex
    const originalMatch = String.prototype.match;
    String.prototype.match = function(regexp: any) {
        if (this.includes('.') && (this.includes('http') || this.length > 5)) {
            (window as any).__api_usage.regExpUsedForParsing = true;
        }
        return originalMatch.apply(this, [regexp]);
    };
  });

  if (TARGET_URL) {
    await page.goto(TARGET_URL);
  }
});

test('Utilize the URLPattern API to define and match hostname structures', async ({ page }) => {
  const usage = await page.evaluate(() => (window as any).__api_usage);
  expect(usage.urlPatternConstructed).toBe(true);
});

test('Extract named capture groups from the hostname using the exec() method', async ({ page }) => {
  // Trigger a match if not already triggered
  const input = page.locator('input').first();
  if (await input.isVisible()) {
    await input.fill('https://nike-staging.cloud-app.net/settings');
    const button = page.locator('button:has-text("Process"), button:has-text("Extract"), button:has-text("Route")').first();
    await button.click();
  }
  
  const usage = await page.evaluate(() => (window as any).__api_usage);
  expect(usage.urlPatternExecCalled).toBe(true);
});

test('Correctly route or configure the application state based on dynamic identifiers', async ({ page }) => {
  const input = page.locator('input').first();
  await input.fill('https://acme-prod.demo.io/dashboard');
  const button = page.locator('button:has-text("Process"), button:has-text("Extract"), button:has-text("Route")').first();
  await button.click();

  // Check if tenant 'acme' and env 'prod' are extracted AND URLPattern was used.
  const result = await page.evaluate(() => {
    const usage = (window as any).__api_usage;
    const content = document.body.textContent?.toLowerCase() || '';
    return usage.urlPatternExecCalled && content.includes('acme') && content.includes('prod');
  });
  expect(result).toBe(true);
});

test('Must not rely on manual RegExp objects to parse hostname/href for tenant identification', async ({ page }) => {
  // Reset usage and trigger action
  await page.evaluate(() => { (window as any).__api_usage.regExpUsedForParsing = false; });
  const input = page.locator('input').first();
  await input.fill('https://dev-acme.internal.com/dashboard');
  const button = page.locator('button:has-text("Process"), button:has-text("Extract"), button:has-text("Route")').first();
  await button.click();

  const usage = await page.evaluate(() => (window as any).__api_usage);
  expect(usage.regExpUsedForParsing).toBe(false);
});

test('Must not use fragile string manipulation (split, slice, substring) to extract identifiers', async ({ page }) => {
  // Reset usage and trigger action
  await page.evaluate(() => { (window as any).__api_usage.stringManipulationUsed = false; });
  const input = page.locator('input').first();
  await input.fill('https://dev-acme.internal.com/dashboard');
  const button = page.locator('button:has-text("Process"), button:has-text("Extract"), button:has-text("Route")').first();
  await button.click();

  const usage = await page.evaluate(() => (window as any).__api_usage);
  expect(usage.stringManipulationUsed).toBe(false);
});
