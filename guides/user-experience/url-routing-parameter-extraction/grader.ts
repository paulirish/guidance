import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetUrl = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');

test.describe('URL Routing and Parameter Extraction Grader', () => {
    
    test.beforeEach(async ({ page }) => {
        const html = fs.readFileSync(targetUrl, 'utf-8');
        // Serve the same HTML for all routes on localhost:3000
        await page.route('http://localhost:3000/**', route => {
            route.fulfill({
                contentType: 'text/html',
                body: html
            });
        });

        // Instrument the page to track API usage before any scripts run
        await page.addInitScript(() => {
            (window as any).urlPatternUsed = false;
            (window as any).urlPatternExecCalled = false;
            (window as any).groupsAccessed = false;
            (window as any).forbiddenAPICalls = [];

            const OriginalURLPattern = (window as any).URLPattern;
            if (OriginalURLPattern) {
                const originalExec = OriginalURLPattern.prototype.exec;
                OriginalURLPattern.prototype.exec = function(...args: any[]) {
                    (window as any).urlPatternExecCalled = true;
                    sessionStorage.setItem('urlPatternExecCalled', 'true');
                    const result = originalExec.apply(this, args);
                    if (result) {
                        const wrapGroups = (obj: any) => {
                            if (!obj) return obj;
                            return new Proxy(obj, {
                                get(t, p) {
                                    if (p === 'groups') {
                                        (window as any).groupsAccessed = true;
                                        sessionStorage.setItem('groupsAccessed', 'true');
                                    }
                                    return t[p as any];
                                },
                                ownKeys(t) { return Reflect.ownKeys(t); },
                                getOwnPropertyDescriptor(t, p) { return Reflect.getOwnPropertyDescriptor(t, p); },
                                getPrototypeOf(t) { return Reflect.getPrototypeOf(t); }
                            });
                        };
                        return new Proxy(result, {
                            get(t, p) {
                                if (p === 'pathname' || p === 'search' || p === 'hostname' || p === 'hash') {
                                    return wrapGroups(t[p as any]);
                                }
                                return t[p as any];
                            },
                            ownKeys(t) { return Reflect.ownKeys(t); },
                            getOwnPropertyDescriptor(t, p) { return Reflect.getOwnPropertyDescriptor(t, p); },
                            getPrototypeOf(t) { return Reflect.getPrototypeOf(t); }
                        });
                    }
                    return result;
                };

                (window as any).URLPattern = function(...args: any[]) {
                    (window as any).urlPatternUsed = true;
                    return new OriginalURLPattern(...args);
                };
                (window as any).URLPattern.prototype = OriginalURLPattern.prototype;
            }

            // Detect forbidden RegExp usage for routing
            const reportForbidden = (data: any) => {
                const calls = JSON.parse(sessionStorage.getItem('forbiddenCalls') || '[]');
                calls.push(data);
                sessionStorage.setItem('forbiddenCalls', JSON.stringify(calls));
                (window as any).forbiddenAPICalls.push(data);
            };

            const OriginalTest = RegExp.prototype.test;
            RegExp.prototype.test = function(str: any) {
                if (typeof str === 'string' && str.length > 1 && str.includes('/') && this.source.length > 2) {
                    reportForbidden({ api: 'RegExp', pattern: this.source });
                }
                return OriginalTest.call(this, str);
            };

            const OriginalExec = RegExp.prototype.exec;
            RegExp.prototype.exec = function(str: any) {
                if (typeof str === 'string' && str.length > 1 && str.includes('/') && this.source.length > 2) {
                    reportForbidden({ api: 'RegExp', pattern: this.source });
                }
                return OriginalExec.call(this, str);
            };

            // Detect forbidden String method usage for routing
            const OriginalSplit = String.prototype.split;
            String.prototype.split = function(separator: any, limit?: number) {
                if (separator === '/') {
                     reportForbidden({ api: 'split', value: String(this) });
                }
                return (OriginalSplit as any).call(this, separator, limit);
            };

            const OriginalSubstring = String.prototype.substring;
            String.prototype.substring = function(start: number, end?: number) {
                if (typeof this === 'string' && this.includes('/') && (start !== 0 || end !== undefined)) {
                     reportForbidden({ api: 'substring', value: this });
                }
                return (OriginalSubstring as any).call(this, start, end);
            };
        });

        await page.goto('http://localhost:3000/');
        await page.evaluate(() => sessionStorage.clear());
    });

    test('The implementation must utilize the URLPattern constructor to define route templates.', async ({ page }) => {
        const used = await page.evaluate(() => (window as any).urlPatternUsed);
        expect(used).toBe(true);
    });

    test('The implementation must extract named dynamic parameters using the groups property of the match object.', async ({ page }) => {
        // Click a link with parameters
        const link = page.locator('a[href*="/products/"], a[href*="/user/"], a[href*="/category/"]').first();
        await link.click();
        
        // Wait for the UI to reflect the change
        await expect(page.locator('.test-params-output, #params-list, #params-output')).not.toBeEmpty();
        
        const accessed = await page.evaluate(() => {
            const val = sessionStorage.getItem('groupsAccessed');
            const calls = val ? JSON.parse(val) : false;
            return (window as any).groupsAccessed || calls;
        });
        expect(accessed).toBe(true);
    });

    test('The implementation must successfully match and route requests using URLPattern.exec().', async ({ page }) => {
        const link = page.locator('a[href*="/products/"], a[href*="/user/"], a[href*="/category/"]').first();
        await link.click();

        // Wait for the UI to reflect the change
        await expect(page.locator('.test-params-output, #params-list, #params-output')).not.toBeEmpty();
        
        const called = await page.evaluate(() => {
            const val = sessionStorage.getItem('urlPatternExecCalled');
            const calls = val ? JSON.parse(val) : false;
            return (window as any).urlPatternExecCalled || calls;
        });
        expect(called).toBe(true);
    });

    test('The router must not use manual RegExp objects for URL parsing or parameter extraction.', async ({ page }) => {
        // Trigger routing by clicking available links
        const links = page.locator('a[href^="/"]');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
            await links.nth(i).click();
        }

        const forbidden = await page.evaluate(() => {
            const val = sessionStorage.getItem('forbiddenCalls');
            const calls = val ? JSON.parse(val) : [];
            return calls.filter((c: any) => c.api === 'RegExp');
        });
        expect(forbidden.length).toBe(0);
    });

    test('The router must not use String.prototype.split() or substring() for identifying dynamic segments.', async ({ page }) => {
        // Trigger routing by clicking available links
        const links = page.locator('a[href^="/"]');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
            await links.nth(i).click();
        }

        const forbidden = await page.evaluate(() => {
            const val = sessionStorage.getItem('forbiddenCalls');
            const calls = val ? JSON.parse(val) : [];
            return calls.filter((c: any) => c.api === 'split' || c.api === 'substring');
        });
        expect(forbidden.length).toBe(0);
    });
});
