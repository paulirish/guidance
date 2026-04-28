/// <reference types="node" />
import { test, expect } from '@playwright/test';

interface CapturedData {
  swScript: string;
  apisCalled: string[];
  routes: any[];
}

let captured: CapturedData = {
  swScript: '',
  apisCalled: [],
  routes: []
};

async function setupAndLoad(page: any, targetFile: string) {
  // Reset captured data
  captured = {
    swScript: '',
    apisCalled: [],
    routes: []
  };

  await page.addInitScript(() => {
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = async function(url: string | URL, options?: RegistrationOptions) {
      try {
        const response = await fetch(url.toString());
        (window as any).__sw_script = await response.text();
      } catch (e) {
        // Fallback for analysis if fetch fails
      }
      // We don't actually need it to succeed for analysis
      return originalRegister.apply(this, [url, options]).catch(() => ({}) as ServiceWorkerRegistration);
    };
  });

  const url = targetFile.startsWith('/') ? `file://${targetFile}` : `file://${process.cwd()}/${targetFile}`;
  await page.goto(url);
  await page.waitForTimeout(1000);

  const data = await page.evaluate(() => {
    const script = (window as any).__sw_script || '';
    const apis: string[] = [];
    const routes: any[] = [];

    if (script) {
      // Mock environment to capture API calls
      const mockSelf = {
        addEventListener: (type: string, listener: Function) => {
          if (type === 'install') {
            const mockEvent = {
              registerRouter: (r: any) => {
                apis.push('registerRouter');
                if (Array.isArray(r)) routes.push(...r);
              },
              addRoutes: (r: any) => {
                apis.push('addRoutes');
                if (Array.isArray(r)) routes.push(...r);
              },
              skipWaiting: () => {}
            };
            try { listener(mockEvent); } catch (e) {}
          }
          if (type === 'fetch') {
            apis.push('fetch');
          }
        },
        skipWaiting: () => {},
        registration: { scope: './' }
      };

      try {
        // Simple check for URLPattern usage in script string
        if (script.includes('URLPattern')) {
          apis.push('URLPattern_Found');
        }

        // Execute script in mock context
        const fn = new Function('self', 'URLPattern', script);
        fn(mockSelf, (window as any).URLPattern);
      } catch (e) {
        // Ignore execution errors
      }
    }

    return {
      swScript: script,
      apisCalled: apis,
      routes: routes
    };
  });

  captured = data;
}

test.describe('Service Worker Static Routing Grader', () => {
  const target = process.env.TARGET_FILE || 'demo.html';

  test.beforeEach(async ({ page }) => {
    await setupAndLoad(page, target);
  });

  test('The service worker must use the Service Worker Static Routing API (registerRouter or addRoutes)', async () => {
    expect(captured.apisCalled.some(a => a === 'registerRouter' || a === 'addRoutes')).toBe(true);
  });

  test('The implementation must use URLPattern for declarative routing rules', async () => {
    expect(captured.apisCalled.includes('URLPattern_Found')).toBe(true);
  });

  test('The implementation must not use imperative string methods for path-based bypassing in the fetch event', async () => {
    const script = captured.swScript;
    const imperativeMethods = ['indexOf', 'includes', 'endsWith', 'startsWith'];
    const usedMethods = imperativeMethods.filter(method => {
      // Look for .method( used on potential URL variables
      // This matches negative-demo.html's patterns
      const regex = new RegExp(`\\.(?:${method})\\s*\\(`, 'g');
      return regex.test(script);
    });
    
    // In negative-demo, these are used for routing logic.
    // In demo, they are not used at all in the SW.
    expect(usedMethods.length, `Used imperative methods: ${usedMethods.join(', ')}`).toBe(0);
  });

  test('Routing rules must use "network" source and specify conditions with URLPattern syntax', async () => {
    expect(captured.routes.length).toBeGreaterThan(0);
    const hasNetworkSource = captured.routes.some(r => r.source === 'network');
    const hasUrlPattern = captured.routes.some(r => r.condition && (r.condition.urlPattern || r.condition.pathname));
    
    expect(hasNetworkSource).toBe(true);
    expect(hasUrlPattern).toBe(true);
  });
});
