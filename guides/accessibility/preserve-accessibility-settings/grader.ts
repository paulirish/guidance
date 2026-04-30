/// <reference types="node" />
import { test, expect, type Page, type Locator } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';

/**
 * Robustly identifies the target element and action buttons.
 * Avoids specific class/ID names where possible, focusing on roles and text.
 */
async function getTargetAndButtons(page: Page) {
  // We assume there is an element with id="target" or a similar main test element.
  // Both demo and negative-demo use id="target".
  const target = page.locator('#target');
  const buttons = await page.locator('button').all();
  
  let applyButton: Locator | undefined;
  let undoButtons: Locator[] = [];

  for (const btn of buttons) {
    const text = await btn.innerText();
    // Identify "Apply" button: contains "apply" but not "revert/reset/initial/undo/hardcoded"
    if (/apply/i.test(text) && !/revert|reset|initial|undo|hardcoded/i.test(text)) {
      applyButton = btn;
    } 
    // Identify "Undo/Reset" buttons: contains keywords that suggest undoing styles
    if (/revert|reset|initial|undo|hardcoded/i.test(text)) {
      undoButtons.push(btn);
    }
  }
  return { target, applyButton, undoButtons };
}

test.describe('Preserve Accessibility Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Load the target file
    await page.goto(`file://${targetFile}`);
    // Inject CSS to disable all transitions and animations for immediate computed style updates
    await page.addStyleTag({ 
      content: `
        * { 
          transition: none !important; 
          animation: none !important; 
        }
      ` 
    });
  });

  test('undoing custom styles should restore inherited color from the parent', async ({ page }) => {
    const { target, applyButton, undoButtons } = await getTargetAndButtons(page);
    if (!applyButton || undoButtons.length === 0) {
      throw new Error('Required buttons (Apply/Undo) not found in the page.');
    }

    // Set a unique color on the parent to test inheritance
    await page.evaluate(() => {
      document.body.style.color = 'rgb(255, 0, 0)';
    });

    // 1. Apply custom author styles
    await applyButton.click();
    
    // 2. Undo/Revert styles
    // We test the first undo button found (covers 'revert' in demo, 'initial' in negative-demo)
    await undoButtons[0].click();

    // 3. Verify computed color. 
    // If 'revert' is used, it should inherit 'rgb(255, 0, 0)' from body.
    // If 'initial' is used, it will likely be 'rgb(0, 0, 0)' (black).
    // If hardcoded, it will be whatever was hardcoded.
    const color = await target.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 0, 0)');
  });

  test('undoing custom styles should restore inherited font-size from the parent', async ({ page }) => {
    const { target, applyButton, undoButtons } = await getTargetAndButtons(page);
    if (!applyButton || undoButtons.length === 0) {
      throw new Error('Required buttons (Apply/Undo) not found in the page.');
    }

    // Set a unique font-size on the parent to test inheritance
    await page.evaluate(() => {
      document.body.style.fontSize = '45px';
    });

    await applyButton.click();
    await undoButtons[0].click();

    // If 'revert' is used, it inherits from parent.
    // If 'initial' is used, it becomes '16px' (default medium).
    const fontSize = await target.evaluate(el => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('45px');
  });

  test('undoing custom styles should not use hardcoded background colors', async ({ page }) => {
    const { target, applyButton, undoButtons } = await getTargetAndButtons(page);
    if (!applyButton || undoButtons.length === 0) {
      throw new Error('Required buttons (Apply/Undo) not found in the page.');
    }

    // Capture the state classes to apply them to a test element
    await applyButton.click();
    const applyClass = await target.evaluate(el => el.className);
    await undoButtons[0].click();
    const undoClass = await target.evaluate(el => el.className);

    // Test UA default preservation using a <mark> element.
    // UA default for <mark> is usually yellow. 'initial' is transparent.
    const result = await page.evaluate(({ applyClass, undoClass }) => {
      const mark = document.createElement('mark');
      document.body.appendChild(mark);
      
      // Determine actual UA default in this browser
      const tempMark = document.createElement('mark');
      document.body.appendChild(tempMark);
      const uaDefaultBg = getComputedStyle(tempMark).backgroundColor;
      document.body.removeChild(tempMark);

      // Apply the same transition from author to undo
      mark.className = applyClass;
      mark.style.backgroundColor = 'rgb(0, 0, 255)'; // force change
      mark.className = undoClass;

      const finalBg = getComputedStyle(mark).backgroundColor;
      document.body.removeChild(mark);
      
      return { finalBg, uaDefaultBg };
    }, { applyClass, undoClass });

    // If UA default is not transparent (which it should be for <mark>), we check it's restored.
    if (result.uaDefaultBg !== 'rgba(0, 0, 0, 0)' && result.uaDefaultBg !== 'transparent') {
        expect(result.finalBg).toBe(result.uaDefaultBg);
    } else {
        // Fallback: Ensure it's not a hardcoded 'white' or 'black' from common bad resets
        expect(result.finalBg).not.toBe('rgb(255, 255, 255)');
        expect(result.finalBg).not.toBe('rgb(0, 0, 0)');
    }
  });
});
