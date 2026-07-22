import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

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

test.describe('Daily Grind Asynchronous Job Tracking Grader', () => {

  // --- STATIC ASSERTIONS ---

  test('Must use Promise.withResolvers() to generate promises', () => {
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.html'));
    let foundWithResolvers = false;
    
    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      
      let jsCode = content;
      if (file.endsWith('.html')) {
        const { document } = parseHTML(content);
        jsCode = Array.from(document.querySelectorAll('script'))
          .map(s => s.textContent)
          .join('\n');
      }

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('temp.ts', jsCode);
      
      // Look for Promise.withResolvers() calls
      const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const text = call.getExpression().getText();
        if (text === 'Promise.withResolvers' || text === 'window.Promise.withResolvers') {
          // Verify it's not the polyfill definition itself
          const parent = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                         call.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ||
                         call.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
          
          const parentText = parent?.getText() || '';
          // If the call is inside a function that IS the polyfill, keep looking
          if (!parentText.includes('Promise.withResolvers = function')) {
             foundWithResolvers = true;
             break;
          }
        }
      }
      if (foundWithResolvers) break;
    }
    expect(foundWithResolvers, 'Implementation should use Promise.withResolvers() in business logic.').toBe(true);
  });

  test('Must NOT manually extract resolve/reject from new Promise() outside of polyfill', () => {
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.html'));
    
    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      
      let jsCode = content;
      if (file.endsWith('.html')) {
        const { document } = parseHTML(content);
        jsCode = Array.from(document.querySelectorAll('script'))
          .map(s => s.textContent)
          .join('\n');
      }

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('temp.ts', jsCode);
      
      const newPromises = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)
        .filter(n => n.getExpression().getText() === 'Promise');

      for (const np of newPromises) {
        const args = np.getArguments();
        if (args.length > 0 && (args[0].getKind() === SyntaxKind.FunctionExpression || args[0].getKind() === SyntaxKind.ArrowFunction)) {
          const executor = args[0] as any;
          const params = executor.getParameters();
          if (params.length >= 1) {
            const resolveName = params[0].getName();
            const rejectName = params.length >= 2 ? params[1].getName() : null;
            
            const body = executor.getBody();
            const assignments = body.getDescendantsOfKind(SyntaxKind.BinaryExpression)
              .filter((be: any) => be.getOperatorToken().getText() === '=');
            
            for (const assignment of assignments) {
              const right = assignment.getRight().getText();
              if (right === resolveName || (rejectName && right === rejectName)) {
                // Potential manual extraction.
                // Check if this is part of the polyfill itself.
                let isPolyfill = false;
                let current: any = np;
                while (current) {
                  const text = current.getText();
                  if (text.includes('Promise.withResolvers =') || 
                      text.includes('typeof Promise.withResolvers')) {
                    isPolyfill = true;
                    break;
                  }
                  current = current.getParent();
                }
                
                if (!isPolyfill) {
                  throw new Error('Manual extraction of resolve/reject from new Promise() detected in business logic.');
                }
              }
            }
          }
        }
      }
    }
  });

  test('Must maintain a collection (Map, Set, or Array) for multiple tasks', () => {
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.html'));
    let hasCollection = false;
    
    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      
      let jsCode = content;
      if (file.endsWith('.html')) {
        const { document } = parseHTML(content);
        jsCode = Array.from(document.querySelectorAll('script'))
          .map(s => s.textContent)
          .join('\n');
      }

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('temp.ts', jsCode);
      
      const newMap = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some(n => n.getExpression().getText() === 'Map');
      const newSet = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some(n => n.getExpression().getText() === 'Set');
      const arrayPush = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some(c => {
        const text = c.getExpression().getText();
        return text.endsWith('.push') || text.endsWith('.set');
      });

      if (newMap || newSet || arrayPush) {
        hasCollection = true;
        break;
      }
    }
    expect(hasCollection, 'Should use a Map, Set, or Array to track multiple active tasks.').toBe(true);
  });

  // --- BROWSER ASSERTIONS ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }: any) => {
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

    test('Should support multiple concurrent tasks settled independently', async ({ page }: any) => {
      // Check for the Order Tracker UI
      const tracker = page.locator('#order-section');
      await expect(tracker, 'Order tracker UI should be present.').toBeVisible();

      // Trigger multiple orders
      const orderButtons = page.locator('button:has-text("Order Now")');
      const btnCount = await orderButtons.count();
      expect(btnCount).toBeGreaterThan(0);

      // Order 2 drinks
      await orderButtons.nth(0).click();
      await orderButtons.nth(1).click();

      // Verify both are in pending list
      const pendingItems = page.locator('#pending-list .order-item');
      await expect(pendingItems).toHaveCount(2);

      // Settle the second one first (independently)
      const baristaActions = page.locator('#barista-list .order-item');
      await expect(baristaActions).toHaveCount(2);

      // The barista console should have buttons to settle
      const serveButtons = baristaActions.locator('.btn-complete');
      await expect(serveButtons).toHaveCount(2);

      // Click the second serve button
      await serveButtons.nth(1).click();

      // Verify one is gone, one remains
      await expect(pendingItems).toHaveCount(1);
      
      // Verify success log
      const log = page.locator('#log');
      await expect(log).toContainText('SUCCESS');

      // Settle the first one
      await serveButtons.nth(0).click();
      await expect(pendingItems).toHaveCount(0);
    });
  });
});
