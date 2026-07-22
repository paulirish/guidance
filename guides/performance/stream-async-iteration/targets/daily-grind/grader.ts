import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'node:path';
import * as fs from 'node:fs';
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

test.describe('Stream to Async Iteration Grader', () => {

  test('Static Analysis: Promise.withResolvers and Event Queuing', () => {
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    let foundWithResolvers = false;
    let foundQueue = false;
    let foundManualDeferred = false;

    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      const jsStr = fs.readFileSync(file, 'utf8');
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('temp.ts', jsStr);

      // Check for Promise.withResolvers() call (ignoring the polyfill definition itself)
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExpressions) {
        if (call.getExpression().getText() === 'Promise.withResolvers') {
          // Ensure it's not inside a function named "withResolvers" (part of the polyfill)
          const parentFunc = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                             call.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ||
                             call.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
          if (parentFunc && (parentFunc as any).getName?.() === 'withResolvers') continue;
          
          foundWithResolvers = true;
        }
      }

      // Check for data queue (array push/shift pattern)
      const variableDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const decl of variableDecls) {
        const initializer = decl.getInitializer();
        if (initializer?.getKind() === SyntaxKind.ArrayLiteralExpression) {
          // Look for usages of this array that look like a queue
          const references = decl.findReferencesAsNodes();
          let hasPush = false;
          let hasShift = false;
          for (const ref of references) {
            const parent = ref.getParent();
            if (parent?.getKind() === SyntaxKind.PropertyAccessExpression) {
              const propName = (parent as any).getName();
              if (propName === 'push') hasPush = true;
              if (propName === 'shift') hasShift = true;
            }
          }
          if (hasPush && hasShift) foundQueue = true;
        }
      }

      // Check for manual deferred pattern (let resolve, reject outside of new Promise)
      const functions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
      for (const func of functions) {
        if (func.getName() === 'streamToAsyncIterable') {
          const body = func.getBody();
          if (body) {
            const vars = body.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
            let hasResolve = false;
            let hasReject = false;
            for (const v of vars) {
              if (v.getName() === 'resolve') hasResolve = true;
              if (v.getName() === 'reject') hasReject = true;
            }
            if (hasResolve && hasReject && !foundWithResolvers) {
               foundManualDeferred = true;
            }
          }
        }
      }
    }

    expect(foundWithResolvers, 'Must utilize Promise.withResolvers()').toBe(true);
    expect(foundQueue, 'Must implement a queue to ensure no data is lost').toBe(true);
    expect(foundManualDeferred, 'Must avoid manual deferred pattern (legacy resolve/reject variables)').toBe(false);
  });

  test('Static Analysis: Event Listener Cleanup', () => {
    const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    let foundCleanup = false;

    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      const jsStr = fs.readFileSync(file, 'utf8');
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('temp.ts', jsStr);

      // Look for calls to .off() or .removeListener()
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of callExpressions) {
        const text = call.getExpression().getText();
        if (text.endsWith('.off') || text.endsWith('.removeListener') || text.includes('off.call')) {
          foundCleanup = true;
          break;
        }
      }
    }

    expect(foundCleanup, 'Must correctly handle stream termination by cleaning up event listeners').toBe(true);
  });

  test.describe('Browser tests', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }: { page: any, TARGET_URL: string }) => {
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

    test('Async iterable yields data in correct order and handles queueing', async ({ page }: { page: any }) => {
      // Find the utility file
      const utilsFile = targetFiles.find(f => f.endsWith('stream-utils.js'));
      expect(utilsFile).toBeDefined();

      const results = await page.evaluate(async (modulePath: string) => {
        const { streamToAsyncIterable } = await import(modulePath);
        
        // Mock EventEmitter
        class MockEmitter {
          listeners: Record<string, any[]>;
          constructor() {
            this.listeners = {};
          }
          on(event: string, cb: any) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(cb);
          }
          off(event: string, cb: any) {
            if (!this.listeners[event]) return;
            this.listeners[event] = this.listeners[event].filter(l => l !== cb);
          }
          emit(event: string, data?: any) {
            if (!this.listeners[event]) return;
            this.listeners[event].forEach(cb => cb(data));
          }
        }

        const emitter = new MockEmitter();
        const iterable = streamToAsyncIterable(emitter);
        const data = [];
        
        // Simulate rapid events before iteration starts (testing queue)
        emitter.emit('data', 'chunk 1');
        emitter.emit('data', 'chunk 2');
        
        const iterator = iterable[Symbol.asyncIterator]();
        
        data.push((await iterator.next()).value);
        data.push((await iterator.next()).value);
        
        // Emit more events during iteration
        setTimeout(() => emitter.emit('data', 'chunk 3'), 10);
        data.push((await iterator.next()).value);
        
        // End stream
        emitter.emit('end');
        const last = await iterator.next();
        
        return {
          data: data.map(d => d),
          done: last.done
        };
      }, `./${utilsFile}`);

      expect(results.data).toEqual(['chunk 1', 'chunk 2', 'chunk 3']);
      expect(results.done).toBe(true);
    });

    test('Async iterable handles cleanup on return()', async ({ page }: { page: any }) => {
      const utilsFile = targetFiles.find(f => f.endsWith('stream-utils.js'));
      expect(utilsFile).toBeDefined();

      const results = await page.evaluate(async (modulePath: string) => {
        const { streamToAsyncIterable } = await import(modulePath);
        
        let listenersRemoved = false;
        const emitter = {
          on: () => {},
          off: (event: string) => {
            if (event === 'data') listenersRemoved = true;
          }
        };

        const iterable = streamToAsyncIterable(emitter);
        const iterator = iterable[Symbol.asyncIterator]();
        
        await iterator.return();
        
        return { listenersRemoved };
      }, `./${utilsFile}`);

      expect(results.listenersRemoved).toBe(true);
    });
  });
});
