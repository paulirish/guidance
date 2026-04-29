/// <reference types="node" />
import { test, expect } from '@playwright/test';

/**
 * Grader for 'preserve-accessibility-settings'
 * 
 * This grader verifies that custom author styles are undone using methods
 * that preserve user-defined accessibility settings and the CSS cascade (like 'revert').
 */

const TARGET_FILE = process.env.TARGET_FILE || 'demo.html';

test.describe('Preserve Accessibility Settings', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${TARGET_FILE}`);
  });

  /**
   * TEST 1: Reverting should restore inherited values from the parent.
   * This distinguishes 'revert' from 'initial' and hardcoded values.
   */
  test('undoing custom styles should restore inherited color from the parent', async ({ page }) => {
    // Set a distinct inherited color on the parent (body)
    // Blue (rgb(0, 0, 255)) is distinct from both demo.html (#333, #999) and negative-demo.html (#000, #ff0000)
    const customParentColor = 'rgb(0, 0, 255)'; 
    await page.evaluate((color) => {
      document.body.style.color = color;
    }, customParentColor);

    const target = page.locator('#target, .test-target-element').first();
    const applyBtn = page.locator('button').filter({ hasText: /Apply Custom|Set Styles/i }).first();
    const undoBtns = page.locator('button').filter({ hasText: /revert|initial|hardcoded|reset|undo/i });

    await expect(applyBtn).toBeVisible();
    const count = await undoBtns.count();
    expect(count, 'Should find at least one button to undo/reset styles').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await applyBtn.click();
      
      const authorColor = await target.evaluate(el => window.getComputedStyle(el).color);
      expect(authorColor, 'Author style should have changed the color').not.toBe(customParentColor);

      const btn = undoBtns.nth(i);
      const btnText = await btn.innerText();
      await btn.click();
      
      const resultColor = await target.evaluate(el => window.getComputedStyle(el).color);
      
      // 'revert' or removing the class will inherit from body (blue).
      // 'initial' or hardcoded values will fail to match.
      expect(resultColor, `Button "${btnText}" failed to restore inherited color.`).toBe(customParentColor);
    }
  });

  /**
   * TEST 2: Reverting should restore inherited font-size from the parent.
   */
  test('undoing custom styles should restore inherited font-size from the parent', async ({ page }) => {
    const customParentSize = '37px';
    await page.evaluate((size) => {
      document.body.style.fontSize = size;
    }, customParentSize);

    const target = page.locator('#target, .test-target-element').first();
    const applyBtn = page.locator('button').filter({ hasText: /Apply Custom|Set Styles/i }).first();
    const undoBtns = page.locator('button').filter({ hasText: /revert|initial|hardcoded|reset|undo/i });

    const count = await undoBtns.count();
    for (let i = 0; i < count; i++) {
      await applyBtn.click();
      
      const authorSize = await target.evaluate(el => window.getComputedStyle(el).fontSize);
      expect(authorSize, 'Author style should have changed the font-size').not.toBe(customParentSize);

      const btn = undoBtns.nth(i);
      const btnText = await btn.innerText();
      await btn.click();
      
      const resultSize = await target.evaluate(el => window.getComputedStyle(el).fontSize);
      expect(resultSize, `Button "${btnText}" failed to restore inherited font-size.`).toBe(customParentSize);
    }
  });

  /**
   * TEST 3: Hardcoded resets are forbidden.
   */
  test('undoing custom styles should not use hardcoded background colors', async ({ page }) => {
    const target = page.locator('#target, .test-target-element').first();
    const applyBtn = page.locator('button').filter({ hasText: /Apply Custom|Set Styles/i }).first();
    const undoBtns = page.locator('button').filter({ hasText: /revert|initial|hardcoded|reset|undo/i });

    const count = await undoBtns.count();
    for (let i = 0; i < count; i++) {
      await applyBtn.click();
      await undoBtns.nth(i).click();
      
      const bgColor = await target.evaluate(el => window.getComputedStyle(el).backgroundColor);
      const btnText = await undoBtns.nth(i).innerText();
      
      // Hardcoding 'white' (rgb(255, 255, 255)) as a reset is an accessibility failure.
      // UA default is usually transparent (rgba(0, 0, 0, 0)).
      expect(bgColor, `Button "${btnText}" used a hardcoded background color (white) instead of reverting.`).not.toBe('rgb(255, 255, 255)');
    }
  });
});
