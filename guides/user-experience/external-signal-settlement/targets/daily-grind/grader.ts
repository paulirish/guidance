// @ts-nocheck
import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind, Node } from 'ts-morph';

// Setup target workspace details
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map(f => path.join(targetDir, f));

// Helper to get script content from HTML
function getScriptsFromHtml(htmlContent: string) {
  const { document } = parseHTML(htmlContent);
  return Array.from(document.querySelectorAll('script'))
    .map(script => script.textContent || '')
    .filter(content => content.trim().length > 0);
}

// Grader tests
test.describe('Daily Grind Logout Signal Grader', () => {

  test('Static Analysis: Implementation uses Promise.withResolvers() and avoids polling', () => {
    let withResolversCalled = false;
    let newPromiseExtractionUsed = false;
    let pollingUsed = false;
    let promiseReturnedOrAwaited = false;

    const project = new Project({ useInMemoryFileSystem: true });

    for (const file of absoluteTargetFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const scripts = file.endsWith('.html') ? getScriptsFromHtml(content) : [content];

      for (const script of scripts) {
        const sourceFile = project.createSourceFile(`temp_${Math.random()}.ts`, script);

        // Check for Promise.withResolvers() call
        const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of callExpressions) {
          const expression = call.getExpression();
          const text = expression.getText().replace(/\s+/g, '');
          
          if (text === 'Promise.withResolvers' || 
              text === 'window.Promise.withResolvers' ||
              (Node.isPropertyAccessExpression(expression) && expression.getName() === 'withResolvers')) {
            withResolversCalled = true;
          }

          if (text === 'setInterval' || text === 'setTimeout' || text === 'window.setInterval' || text === 'window.setTimeout') {
            // Look for polling pattern: checking a variable in a loop
            const callback = call.getArguments()[0];
            if (callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))) {
              const bodyText = callback.getText();
              // Heuristic for polling: if statement or while loop checking a flag
              if (bodyText.includes('if') || bodyText.includes('while')) {
                pollingUsed = true;
              }
            }
          }
        }

        // Check for new Promise extraction anti-pattern
        const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);
        for (const newExp of newExpressions) {
          const typeText = newExp.getExpression().getText();
          if (typeText === 'Promise' || typeText === 'window.Promise') {
            const executor = newExp.getArguments()[0];
            if (executor && (Node.isArrowFunction(executor) || Node.isFunctionExpression(executor))) {
              const params = executor.getParameters();
              if (params.length >= 1) {
                const resolveName = params[0].getName();
                const rejectName = params[1]?.getName();
                const body = executor.getBody();
                if (!body) continue;
                
                // Check if resolve/reject are assigned to variables in outer scope
                const assignments = body.getDescendantsOfKind(SyntaxKind.BinaryExpression)
                  .filter(bin => bin.getOperatorToken().getKind() === SyntaxKind.EqualsToken);
                
                for (const assign of assignments) {
                  const right = assign.getRight().getText();
                  if (right === resolveName || (rejectName && right === rejectName)) {
                    // Check if we are inside a polyfill definition
                    let parent: Node | undefined = newExp.getParent();
                    let isInsidePolyfill = false;
                    while (parent) {
                      const pText = parent.getText().replace(/\s+/g, '');
                      if (pText.includes('Promise.withResolvers=function') || 
                          pText.includes('Promise.withResolvers=()=>') ||
                          pText.includes('withResolvers=function') ||
                          pText.includes('withResolvers:function')) {
                        isInsidePolyfill = true;
                        break;
                      }
                      parent = parent.getParent();
                    }
                    if (!isInsidePolyfill) {
                      newPromiseExtractionUsed = true;
                    }
                  }
                }
              }
            }
          }
        }

        // Check for promise being returned or awaited
        const awaitExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
        if (awaitExpressions.length > 0) {
           promiseReturnedOrAwaited = true;
        }
        const returnStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        for (const ret of returnStatements) {
          if (ret.getExpression()) {
            promiseReturnedOrAwaited = true; 
          }
        }
      }
    }

    expect(withResolversCalled, 'Should use Promise.withResolvers()').toBe(true);
    expect(newPromiseExtractionUsed, 'Should NOT manually extract resolve/reject from new Promise() to outer scope').toBe(false);
    expect(pollingUsed, 'Should NOT use periodic polling (setInterval/setTimeout)').toBe(false);
    expect(promiseReturnedOrAwaited, 'The promise should be returned or awaited').toBe(true);
  });

  test.describe('Browser Behavior and API Usage', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }: { page: any, TARGET_URL: string }) => {
      // Instrument browser APIs
      await page.addInitScript(() => {
        window.__withResolversCalled = false;
        window.__pollingDetected = false;

        const originalWithResolvers = Promise.withResolvers;
        Promise.withResolvers = function() {
          window.__withResolversCalled = true;
          if (originalWithResolvers) return originalWithResolvers.apply(this, arguments);
          // Polyfill fallback
          let resolve, reject;
          const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          });
          return { promise, resolve, reject };
        };

        const originalSetInterval = window.setInterval;
        window.setInterval = function(cb, delay) {
          // Heuristic: if called with small delay and looks like it's checking something
          if (delay && delay < 200) {
            window.__pollingDetected = true;
          }
          return originalSetInterval.apply(this, arguments);
        };
      });

      if (TARGET_URL.startsWith('http://localhost/')) {
        await page.route('http://localhost/*', async (route: any) => {
          const requestPath = new URL(route.request().url()).pathname;
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

          if (fs.existsSync(localFilePath)) {
            await route.fulfill({ path: localFilePath });
          } else {
            await route.continue();
          }
        });
      }
      await page.goto(TARGET_URL);
    });

    test('Logout interaction uses Promise.withResolvers and remains pending', async ({ page }: { page: any }) => {
      const logoutLink = page.locator('.logout-link');
      await expect(logoutLink).toBeVisible();

      // Click logout link
      await logoutLink.click();

      // Modal should be visible
      const modal = page.locator('#logout-modal');
      await expect(modal).toBeVisible();

      // Check if Promise.withResolvers was called
      const withResolversCalled = await page.evaluate(() => window.__withResolversCalled);
      expect(withResolversCalled, 'Promise.withResolvers should be called upon interaction start').toBe(true);

      // Check for polling
      const pollingDetected = await page.evaluate(() => window.__pollingDetected);
      expect(pollingDetected, 'Should NOT use setInterval polling').toBe(false);

      // Click cancel
      const cancelBtn = page.locator('#cancel-logout');
      await cancelBtn.click();
      await expect(modal).not.toBeVisible();

      // Click logout again to verify final navigation
      await logoutLink.click();
      await expect(modal).toBeVisible();

      // Click confirm
      const confirmBtn = page.locator('#confirm-logout');
      
      const navigationPromise = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
      await confirmBtn.click();
      await navigationPromise;
      
      // Verification of completion (URL change or modal close)
      await expect(modal).not.toBeVisible();
      const currentUrl = page.url();
      // We expect some indication of navigation or operation completion
      // Since it's a demo, we accept URL change or just modal closing if navigation is mocked
    });
  });
});
