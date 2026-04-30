
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

const TARGET_FILE = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');

test.describe('URLPattern Request Interception', () => {
    let server: http.Server;
    let baseUrl: string;
    let swCode: string = '';
    const content = fs.readFileSync(TARGET_FILE, 'utf8');

    test.beforeAll(async () => {
        const swMatch = content.match(/<script id="service-worker-source"[^>]*>([\s\S]*?)<\/script>/);
        swCode = swMatch ? swMatch[1] : '';

        server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url!, `http://${req.headers.host}`);
            if (url.pathname === '/' || url.pathname === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            } else if (url.pathname === '/sw.js') {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(swCode);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        await new Promise<void>(resolve => {
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address() as any;
                baseUrl = `http://127.0.0.1:${addr.port}`;
                resolve();
            });
        });
    });

    test.afterAll(async () => {
        if (server) server.close();
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
            (navigator.serviceWorker as any).register = (url: string | URL, options?: any) => {
                return originalRegister('/sw.js', { ...options, scope: '/' });
            };
        });

        await page.goto(baseUrl);
        
        try {
            await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 3000 });
        } catch (e) {
            await page.reload();
            await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 5000 });
        }
    });

    test('should use the URLPattern API to identify specific requests', async () => {
        expect(swCode.includes('URLPattern'), 'Service Worker should initialize URLPattern instances').toBe(true);
    });

    test('should use URLPattern.test() or URLPattern.exec() in the fetch handler', async () => {
        expect(swCode.includes('URLPattern') && /\.(test|exec)\(/.test(swCode), 'Service Worker should use URLPattern matching methods').toBe(true);
    });

    test('should handle intercepted requests with event.respondWith() using URLPattern', async ({ page }) => {
        const responsePromise = page.waitForResponse(res => res.url().includes('/api/books/'));
        await page.evaluate(() => fetch('/api/books/123'));
        const response = await responsePromise;
        expect(swCode.includes('URLPattern') && response.fromServiceWorker(), 'Requests should be intercepted by a URLPattern-based Service Worker').toBe(true);
    });

    test('should leverage URLPattern syntax like named groups or wildcards', async () => {
        const hasAdvancedSyntax = /new\s+URLPattern\s*\(\s*\{?[\s\S]*?pathname\s*:\s*['"`][^'"`]*[:*]/.test(swCode) ||
                                  /new\s+URLPattern\s*\(\s*['"`][^'"`]*[:*]/.test(swCode);
        expect(swCode.includes('URLPattern') && hasAdvancedSyntax, 'URLPattern should use named groups or wildcards').toBe(true);
    });

    test('should not use RegExp objects for primary routing instead of URLPattern', async () => {
        const hasRegExpRouting = swCode.includes('new RegExp') || /\/[^/]+\/\.test\(/.test(swCode) || /\.match\(\s*\/[^/]+\//.test(swCode);
        expect(swCode.includes('URLPattern') && !hasRegExpRouting, 'Service Worker should not rely on RegExp for primary routing').toBe(true);
    });

    test('should not use manual string parsing like split or indexOf for routing structured URLs', async () => {
        const hasManualParsing = swCode.includes('.split(') || swCode.includes('.indexOf(');
        expect(swCode.includes('URLPattern') && !hasManualParsing, 'Service Worker should not use split or indexOf for structured routing').toBe(true);
    });

    test('should correctly intercept and extract parameters from URLs using URLPattern', async ({ page }) => {
        const testId = 'ID-' + Math.floor(Math.random() * 10000);
        const responsePromise = page.waitForResponse(res => res.url().includes(`/api/books/${testId}`));
        await page.evaluate((id: string) => fetch(`/api/books/${id}`), testId);
        const response = await responsePromise;
        const body = await response.text();
        expect(swCode.includes('URLPattern') && body.includes(testId), 'Service Worker should extract and use URL parameters').toBe(true);
    });

    test('should correctly extract multiple parameters using URLPattern', async ({ page }) => {
        const user = 'u' + Math.floor(Math.random() * 100);
        const action = 'a' + Math.floor(Math.random() * 100);
        const testUrl = `/api/users/${user}/${action}`;
        const responsePromise = page.waitForResponse(res => res.url().includes(testUrl));
        await page.evaluate((url: string) => fetch(url), testUrl);
        const response = await responsePromise;
        const body = await response.text();
        expect(swCode.includes('URLPattern') && body.includes(user) && body.includes(action), 'Service Worker should extract multiple named parameters').toBe(true);
    });
});
