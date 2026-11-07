import {
  test,
  expect,
  expectNever,
  getTargetFiles,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSPositionTryRule,
} from 'cssomnom';
import type { Page } from '@playwright/test';

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
const targetFiles: string[] = getTargetFiles(import.meta.url);

interface MenuDiscovery {
  isMenubar: boolean;
  topTriggerIds: string[];
  submenuTriggerId: string;
  submenuLeafId: string;
  checkboxTriggerId: string;
  checkboxMenuId: string;
  radioTriggerId: string;
  radioMenuId: string;
  commandTriggerId: string;
  commandMenuId: string;
}

async function discoverMenus(page: Page): Promise<MenuDiscovery> {
  const info = await page.evaluate(() => {
    const allTriggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
    const topTriggers = allTriggers.filter((btn) => !btn.closest('[popover]'));
    const subTriggers = allTriggers.filter((btn) => Boolean(btn.closest('[popover]')));

    allTriggers.forEach((btn, idx) => {
      if (!btn.id) btn.id = `grader-trigger-${idx}`;
    });

    const menubar = document.querySelector('[role="menubar"]');
    const isMenubar = Boolean(menubar);
    const barTopTriggers = isMenubar
      ? topTriggers.filter((btn) => menubar!.contains(btn))
      : topTriggers;

    const topTriggerIds = (barTopTriggers.length > 0 ? barTopTriggers : topTriggers).map((b) => b.id);

    const subWithLeaf =
      subTriggers.find((subBtn) => {
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '');
        if (!subMenu) return false;
        const group = subMenu.querySelector('[focusgroup~="menu"]');
        if (!group) return false;
        const ownItems = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (item) => item.closest('[focusgroup]') === group
        );
        return ownItems.length > 0 && !ownItems[0].hasAttribute('commandfor');
      }) ||
      subTriggers.find((subBtn) => {
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '');
        if (!subMenu) return false;
        const group = subMenu.querySelector('[focusgroup~="menu"]');
        if (!group) return false;
        return Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).some(
          (item) => item.closest('[focusgroup]') === group && !item.hasAttribute('commandfor')
        );
      }) ||
      subTriggers[0];

    let submenuLeafId = '';
    if (subWithLeaf) {
      const subMenu = document.getElementById(subWithLeaf.getAttribute('commandfor') || '');
      const group = subMenu?.querySelector('[focusgroup~="menu"]');
      const leaf = group
        ? Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).find(
            (item) => item.closest('[focusgroup]') === group && !item.hasAttribute('commandfor')
          )
        : null;
      if (leaf) {
        if (!leaf.id) leaf.id = 'grader-sub-leaf';
        submenuLeafId = leaf.id;
      }
    }

    let checkboxTriggerId = '';
    let checkboxMenuId = '';
    let radioTriggerId = '';
    let radioMenuId = '';
    let commandTriggerId = '';
    let commandMenuId = '';

    for (const btn of allTriggers) {
      const menuId = btn.getAttribute('commandfor') || '';
      const menu = document.getElementById(menuId);
      const group = menu?.querySelector('[focusgroup~="menu"]');
      if (!menu || !group) continue;

      const ownCheckbox = Array.from(group.querySelectorAll('[role="menuitemcheckbox"]')).find(
        (el) => el.closest('[focusgroup]') === group
      );
      if (ownCheckbox && !checkboxTriggerId) {
        checkboxTriggerId = btn.id;
        checkboxMenuId = menu.id;
      }

      const ownRadio = Array.from(group.querySelectorAll('[role="menuitemradio"]')).find(
        (el) => el.closest('[focusgroup]') === group
      );
      if (ownRadio && !radioTriggerId) {
        radioTriggerId = btn.id;
        radioMenuId = menu.id;
      }

      const ownCmd = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([commandfor])')).find(
        (el) =>
          el.closest('[focusgroup]') === group &&
          el.getAttribute('role') !== 'menuitemcheckbox' &&
          el.getAttribute('role') !== 'menuitemradio'
      );
      if (ownCmd && !commandTriggerId && !btn.closest('[popover]')) {
        commandTriggerId = btn.id;
        commandMenuId = menu.id;
      }
    }

    if (!commandTriggerId && topTriggers[0]) {
      commandTriggerId = topTriggers[0].id;
      commandMenuId = topTriggers[0].getAttribute('commandfor') || '';
    }

    return {
      isMenubar,
      topTriggerIds,
      submenuTriggerId: subWithLeaf?.id || '',
      submenuLeafId,
      checkboxTriggerId,
      checkboxMenuId,
      radioTriggerId,
      radioMenuId,
      commandTriggerId,
      commandMenuId,
    };
  });
  expect(info.topTriggerIds.length).toBeGreaterThan(0);
  expect(Boolean(info.submenuTriggerId)).toBe(true);
  return info;
}

async function openParentChainForTrigger(page: Page, triggerId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const ancestorMenus: HTMLElement[] = [];
    let current = btn.closest<HTMLElement>('[popover]');
    while (current) {
      ancestorMenus.unshift(current);
      current = current.parentElement?.closest<HTMLElement>('[popover]') || null;
    }
    for (const m of ancestorMenus) {
      if (!m.matches(':popover-open')) {
        const t = document.querySelector<HTMLElement>(`button[commandfor="${m.id}"]`);
        try {
          (m as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover(
            t ? { source: t } : undefined
          );
        } catch {
          m.showPopover();
        }
      }
      await Promise.all(
        m
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {}))
      );
    }
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }, triggerId);
}

test.describe('menu Target Grader', () => {
  // --- STATIC ASSERTIONS ---

  test('Menus are anchored to their triggers via CSS Anchor Positioning (using the invoker or showPopover({ source: trigger }) without per-menu CSS anchor rules), positioning top-level menus below their trigger and submenus beside their trigger on wide viewports, and falling back to directly below the submenu trigger, indented, when neither side fits so a submenu never covers its own trigger', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const hasTopLevelPositionArea = styleRules.some((r) =>
      r.style.getPropertyValue('position-area').includes('block-end')
    );
    const hasSubmenuPositionArea = styleRules.some(
      (r) =>
        r.style.getPropertyValue('position-area').includes('inline-end') &&
        /--[a-zA-Z0-9_-]+/.test(r.style.getPropertyValue('position-try-fallbacks'))
    );
    const hasPositionTryRule = getRules(targetFiles, CSSPositionTryRule).some((r) =>
      r.name.startsWith('--')
    );

    expect(hasTopLevelPositionArea && hasSubmenuPositionArea && hasPositionTryRule).toBe(true);
  });

  test('Menu items align their content across rows with a fixed-size leading icon or check slot and trailing content at the inline end, without subgrid', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    const hasBaseLeadingSlot = styleRules.some(
      (r) =>
        r.selectorText.includes('::before') &&
        !r.selectorText.includes('aria-checked') &&
        Boolean(r.style.getPropertyValue('inline-size') || r.style.getPropertyValue('width'))
    );
    const hasTrailingEndAlignment = styleRules.some(
      (r) =>
        (r.style.getPropertyValue('margin-inline-start').trim() === 'auto' ||
          r.style.getPropertyValue('margin-left').trim() === 'auto')
    );
    const usesSubgrid = styleRules.some(
      (r) =>
        r.style.getPropertyValue('grid-template-columns').includes('subgrid') ||
        r.style.getPropertyValue('grid-template-rows').includes('subgrid')
    );

    expect(hasBaseLeadingSlot && hasTrailingEndAlignment && !usesSubgrid).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Each menu list has focusgroup="menu nomemory" on an element inside its popover (not on the popover element), exposes role="menu" labeled by its trigger via aria-labelledby, and exposes role="menuitem" on its command buttons', async ({
      page,
      TARGET_URL,
    }) => {
      const structureValid = await page.evaluate(() => {
        const popovers = Array.from(document.querySelectorAll<HTMLElement>('[popover]'));
        if (popovers.length < 2) return false;
        return popovers.every((pop) => {
          if (pop.hasAttribute('focusgroup')) return false;
          const fg = pop.querySelector<HTMLElement>(':scope > [focusgroup]');
          if (!fg) return false;
          const tokens = (fg.getAttribute('focusgroup') || '').trim().split(/\s+/);
          if (!tokens.includes('menu') || !tokens.includes('nomemory')) return false;
          const labelId = fg.getAttribute('aria-labelledby');
          if (!labelId) return false;
          const trigger = document.getElementById(labelId);
          return Boolean(trigger && trigger.getAttribute('commandfor') === pop.id);
        });
      });
      expect(structureValid).toBe(true);

      await page.addInitScript(() => {
        try {
          delete (HTMLElement.prototype as unknown as Record<string, unknown>).focusGroup;
        } catch {
          // ignore
        }
      });
      await page.goto(TARGET_URL);

      const fallbackRolesValid = await page.evaluate(() => {
        const groups = Array.from(document.querySelectorAll<HTMLElement>('[focusgroup~="menu"]'));
        if (groups.length === 0) return false;
        let totalCommandItems = 0;
        const groupsValid = groups.every((g) => {
          if (g.getAttribute('role') !== 'menu') return false;
          const items = Array.from(g.querySelectorAll<HTMLElement>('button'))
            .filter((b) => b.closest('[focusgroup]') === g)
            .filter((b) => {
              const r = b.getAttribute('role');
              return r !== 'menuitemcheckbox' && r !== 'menuitemradio';
            });
          totalCommandItems += items.length;
          return items.every((b) => b.getAttribute('role') === 'menuitem');
        });
        return groupsValid && totalCommandItems > 0;
      });
      expect(fallbackRolesValid).toBe(true);
    });

    test('Separators between item groups are <hr> elements, and checkable items are <button type="button"> elements with an explicit role="menuitemcheckbox" or role="menuitemradio" (radios wrapped in a named role="group") and aria-checked; Space on a checkbox item toggles it and keeps the menu open, Enter toggles it and closes the menu, and radio items close on either key', async ({
      page,
    }) => {
      const markupValid = await page.evaluate(() => {
        const fakeSeparators = Array.from(
          document.querySelectorAll(
            '[focusgroup~="menu"] [role="separator"]:not(hr), [focusgroup~="menu"] .separator:not(hr), [focusgroup~="menu"] .divider:not(hr)'
          )
        );
        const checkboxes = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[focusgroup~="menu"] [role="menuitemcheckbox"]')
        );
        const radios = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[focusgroup~="menu"] [role="menuitemradio"]')
        );
        if (fakeSeparators.length > 0 || checkboxes.length === 0 || radios.length === 0) return false;

        const checkboxesValid = checkboxes.every(
          (cb) =>
            cb.tagName === 'BUTTON' &&
            cb.type === 'button' &&
            (cb.getAttribute('aria-checked') === 'true' || cb.getAttribute('aria-checked') === 'false')
        );
        const radiosValid = radios.every((r) => {
          const group = r.closest('[role="group"]');
          return (
            r.tagName === 'BUTTON' &&
            r.type === 'button' &&
            (r.getAttribute('aria-checked') === 'true' || r.getAttribute('aria-checked') === 'false') &&
            Boolean(group && (group.getAttribute('aria-label') || group.getAttribute('aria-labelledby')))
          );
        });
        return checkboxesValid && radiosValid;
      });
      expect(markupValid).toBe(true);

      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.checkboxTriggerId);

      const initialChecked = await page.evaluate(
        async ({ trigId, menuId }) => {
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          if (!menu.matches(':popover-open')) {
            try {
              (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: trig,
              });
            } catch {
              menu.showPopover();
            }
          }
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const cb = menu.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!;
          if (!cb.id) cb.id = 'grader-cb-item';
          cb.focus();
          return cb.getAttribute('aria-checked');
        },
        { trigId: info.checkboxTriggerId, menuId: info.checkboxMenuId }
      );

      await page.keyboard.press(' ');

      await expect
        .poll(() =>
          page.evaluate(
            ({ menuId, init }) => {
              const menu = document.getElementById(menuId)!;
              const cb = document.getElementById('grader-cb-item')!;
              return cb.getAttribute('aria-checked') !== init && menu.matches(':popover-open');
            },
            { menuId: info.checkboxMenuId, init: initialChecked }
          )
        )
        .toBe(true);

      await openParentChainForTrigger(page, info.radioTriggerId);
      await page.evaluate(
        async ({ trigId, menuId }) => {
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          if (!menu.matches(':popover-open')) {
            try {
              (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: trig,
              });
            } catch {
              menu.showPopover();
            }
          }
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const uncheckedRadio =
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="false"]') ||
            menu.querySelector<HTMLButtonElement>('[role="menuitemradio"]')!;
          uncheckedRadio.id = 'grader-radio-target';
          uncheckedRadio.focus();
        },
        { trigId: info.radioTriggerId, menuId: info.radioMenuId }
      );

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate(() => {
            const target = document.getElementById('grader-radio-target')!;
            const group = target.closest('[role="group"]')!;
            const checkedInGroup = group.querySelectorAll('[role="menuitemradio"][aria-checked="true"]');
            const openMenus = document.querySelectorAll('[popover]:popover-open');
            return (
              target.getAttribute('aria-checked') === 'true' &&
              checkedInGroup.length === 1 &&
              openMenus.length === 0
            );
          })
        )
        .toBe(true);
    });

    test('The top-level triggers are either inside a container with role="menubar" that is styled as one continuous bar and acts as a single Tab stop, or are separate Tab stops with no role="menubar", no arrow-key movement between them, and no preview or hover switching; the role, keyboard model, and styling never disagree', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const valid = await page.evaluate(
        ({ isMenubar, topTriggerIds }) => {
          if (topTriggerIds.length === 0) return false;
          const triggers = topTriggerIds.map((id) => document.getElementById(id)!);
          if (isMenubar) {
            const bar = document.querySelector<HTMLElement>('[role="menubar"]');
            if (!bar || bar.hasAttribute('popover')) return false;
            const style = window.getComputedStyle(bar);
            const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
            const tabStops = triggers.filter((t) => t.tabIndex === 0);
            return gap === 0 && tabStops.length === 1;
          } else {
            return triggers.every((t) => !t.closest('[role="menubar"]') && t.tabIndex === 0);
          }
        },
        { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
      );
      expect(valid).toBe(true);
    });

    test('Each trigger is a <button type="button"> with aria-haspopup="menu", commandfor, and command="toggle-popover", and has no popovertarget or popovertargetaction attribute', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
        if (triggers.length < 2) return false;
        return triggers.every(
          (btn) =>
            btn.tagName === 'BUTTON' &&
            btn.type === 'button' &&
            btn.getAttribute('aria-haspopup') === 'menu' &&
            btn.getAttribute('command') === 'toggle-popover' &&
            !btn.hasAttribute('popovertarget') &&
            !btn.hasAttribute('popovertargetaction') &&
            !btn.hasAttribute('aria-details')
        );
      });
      expect(valid).toBe(true);
    });

    test('Each popover is the immediate next sibling of its trigger (and each submenu is a popover="auto" placed after its trigger inside the parent menu\'s focusgroup), so no aria-details relation is exposed on the trigger and closed submenus are not rendered inline', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('button[commandfor]'));
        if (triggers.length < 2) return false;
        const subTriggers = triggers.filter((t) => Boolean(t.closest('[popover]')));
        if (subTriggers.length === 0) return false;

        return triggers.every((btn) => {
          const menuId = btn.getAttribute('commandfor');
          const menu = btn.nextElementSibling as HTMLElement | null;
          if (!menu || menu.id !== menuId || menu.getAttribute('popover') !== 'auto') return false;
          if (btn.hasAttribute('aria-details')) return false;
          if (btn.closest('[popover]')) {
            if (!btn.closest('[focusgroup]')) return false;
            if (window.getComputedStyle(menu).display !== 'none') return false;
          }
          return true;
        });
      });
      expect(valid).toBe(true);
    });

    test('Focusing a submenu trigger (or a top-level trigger in a menubar) previews its menu and sets aria-expanded="true" without moving focus into the menu, and blurring a trigger that is only previewing closes that menu and sets aria-expanded="false"', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.locator(`#${info.submenuTriggerId}`).hover();
      await page.evaluate((subTriggerId) => {
        document.getElementById(subTriggerId)?.focus();
      }, info.submenuTriggerId);

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
            if (!subTrigger) return false;
            const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '');
            if (!subMenu) return false;
            return (
              subMenu.matches(':popover-open') &&
              subTrigger.getAttribute('aria-expanded') === 'true' &&
              document.activeElement === subTrigger
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.evaluate((subTriggerId) => {
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
        if (!subTrigger) return;
        const parentGroup = subTrigger.closest('[focusgroup~="menu"]');
        const siblingItem = parentGroup
          ? Array.from(parentGroup.querySelectorAll<HTMLElement>('button, a[href]')).find(
              (el) => el.closest('[focusgroup]') === parentGroup && el !== subTrigger
            )
          : null;
        if (siblingItem) {
          siblingItem.focus();
        } else {
          subTrigger.blur();
        }
      }, info.submenuTriggerId);

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement | null;
            if (!subTrigger) return false;
            const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '');
            if (!subMenu) return false;
            return !subMenu.matches(':popover-open') && subTrigger.getAttribute('aria-expanded') === 'false';
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('When the window regains focus and focus returns to a trigger, its menu remains closed and does not preview or reopen', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstTopId = info.topTriggerIds[0];

      const stayedClosed = await page.evaluate(async (triggerId) => {
        const trigger = document.getElementById(triggerId) as HTMLButtonElement | null;
        if (!trigger) return false;
        const menu = document.getElementById(trigger.getAttribute('commandfor') || '');
        if (!menu) return false;

        trigger.focus();
        if (menu.matches(':popover-open')) {
          menu.hidePopover();
        }
        window.dispatchEvent(new Event('blur'));
        trigger.blur();
        window.dispatchEvent(new Event('focus'));
        trigger.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        return !menu.matches(':popover-open') && trigger.getAttribute('aria-expanded') === 'false';
      }, firstTopId);

      expect(stayedClosed).toBe(true);
    });

    test('Pressing Enter or Space on a previewed top-level or submenu trigger closes that preview and sets aria-expanded="false" without moving focus from the trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subTriggerId) => {
        const subTrigger = document.getElementById(subTriggerId) as HTMLButtonElement;
        const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '')!;
        if (!subMenu.matches(':popover-open')) {
          try {
            (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: subTrigger,
            });
          } catch {
            subMenu.showPopover();
          }
        }
        subTrigger.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, info.submenuTriggerId);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((subTriggerId) => {
            const subTrigger = document.getElementById(subTriggerId)!;
            const subMenu = document.getElementById(subTrigger.getAttribute('commandfor') || '')!;
            return (
              !subMenu.matches(':popover-open') &&
              subTrigger.getAttribute('aria-expanded') === 'false' &&
              document.activeElement === subTrigger
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing Enter or Space on a closed trigger opens its menu, sets aria-expanded="true", and moves focus to the first enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        btn.focus();
        if (menu.matches(':popover-open')) menu.hidePopover();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, triggerId);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            const group = menu.querySelector('[focusgroup~="menu"]')!;
            const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
              (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
            );
            return (
              menu.matches(':popover-open') &&
              btn.getAttribute('aria-expanded') === 'true' &&
              items.length > 0 &&
              document.activeElement === items[0]
            );
          }, triggerId)
        )
        .toBe(true);
    });

    test('Pressing ArrowDown on a previewed top-level trigger converts it to open and moves focus to the first enabled item in the same turn', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        if (!menu.matches(':popover-open')) {
          try {
            (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: btn,
            });
          } catch {
            menu.showPopover();
          }
        }
        btn.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, triggerId);

      await page.keyboard.press('ArrowDown');

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            const group = menu.querySelector('[focusgroup~="menu"]')!;
            const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
              (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
            );
            return menu.matches(':popover-open') && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);
    });

    test('Inside an open menu, ArrowUp and ArrowDown move focus between enabled items, and Home and End move focus to the first and last enabled item; on a top-level trigger, Home and End enter its menu at the first or last enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        btn.focus();
        if (menu.matches(':popover-open')) menu.hidePopover();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, triggerId);

      await page.keyboard.press('ArrowDown');
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
            const group = menu.querySelector('[focusgroup~="menu"]')!;
            const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
              (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
            );
            return menu.matches(':popover-open') && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);

      await page.keyboard.press('ArrowDown');
      const atSecond = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[1];
      }, triggerId);

      await page.keyboard.press('End');
      const atLast = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[items.length - 1];
      }, triggerId);

      await page.keyboard.press('Home');
      const atFirst = await page.evaluate((id) => {
        const menu = document.getElementById(document.getElementById(id)!.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
        );
        return document.activeElement === items[0];
      }, triggerId);

      expect(atSecond && atLast && atFirst).toBe(true);
    });

    test('Pressing ArrowRight on a submenu trigger opens the submenu and moves focus to its first enabled item, while pressing ArrowLeft in a submenu closes only that submenu and restores focus to its parent trigger', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (subMenu.matches(':popover-open')) subMenu.hidePopover();
        subBtn.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            const group = subMenu.querySelector('[focusgroup~="menu"]')!;
            const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
              (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
            );
            return subMenu.matches(':popover-open') && document.activeElement === items[0];
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.keyboard.press('ArrowLeft');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            const parentMenu = subBtn.closest<HTMLElement>('[popover]')!;
            return (
              !subMenu.matches(':popover-open') &&
              parentMenu.matches(':popover-open') &&
              document.activeElement === subBtn
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing ArrowRight on a submenu item without a child submenu closes the open hierarchy and previews the next top-level menu with focus on its trigger in a menubar, or keeps focus inside the submenu without switching top-level menus for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(
        async ({ subId, leafId }) => {
          const subBtn = document.getElementById(subId)!;
          const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
          if (!subMenu.matches(':popover-open')) {
            try {
              (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: subBtn,
              });
            } catch {
              subMenu.showPopover();
            }
          }
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const leaf = document.getElementById(leafId)!;
          leaf.focus();
        },
        { subId: info.submenuTriggerId, leafId: info.submenuLeafId }
      );

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds, subId }) => {
              const subBtn = document.getElementById(subId)!;
              const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
              if (isMenubar && topTriggerIds.length > 1) {
                return (
                  !subMenu.matches(':popover-open') &&
                  topTriggerIds.some((id) => document.activeElement === document.getElementById(id))
                );
              } else {
                return subMenu.matches(':popover-open') && subMenu.contains(document.activeElement);
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds, subId: info.submenuTriggerId }
          )
        )
        .toBe(true);
    });

    test('From a focused top-level trigger, ArrowRight and ArrowLeft move focus to the next and previous top-level trigger (wrapping at either end) and preview its menu with focus staying on the trigger in a menubar, or leave focus on the current trigger for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstId = info.topTriggerIds[0];

      await page.evaluate((id) => {
        document.getElementById(id)!.focus();
      }, firstId);

      await page.keyboard.press('ArrowRight');

      const result = await page.evaluate(
        ({ isMenubar, topTriggerIds }) => {
          const firstTrigger = document.getElementById(topTriggerIds[0])!;
          if (isMenubar && topTriggerIds.length > 1) {
            const secondTrigger = document.getElementById(topTriggerIds[1])!;
            const secondMenu = document.getElementById(secondTrigger.getAttribute('commandfor') || '')!;
            return document.activeElement === secondTrigger && secondMenu.matches(':popover-open');
          } else {
            return document.activeElement === firstTrigger;
          }
        },
        { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
      );

      expect(result).toBe(true);
    });

    test('From inside an open top-level menu, ArrowRight and ArrowLeft close the current menu and preview the next or previous top-level menu (wrapping at either end) with focus on its trigger and no item focused in a menubar, or do not switch top-level menus for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstId = info.topTriggerIds[0];

      await page.evaluate(async (id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        if (!menu.matches(':popover-open')) {
          try {
            (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: btn,
            });
          } catch {
            menu.showPopover();
          }
        }
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const nonSubItem = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).find(
          (el) => el.closest('[focusgroup]') === group && !el.hasAttribute('commandfor')
        );
        if (nonSubItem) nonSubItem.focus();
      }, firstId);

      await page.keyboard.press('ArrowRight');

      await expect
        .poll(() =>
          page.evaluate(
            ({ isMenubar, topTriggerIds }) => {
              const firstTrigger = document.getElementById(topTriggerIds[0])!;
              const firstMenu = document.getElementById(firstTrigger.getAttribute('commandfor') || '')!;
              if (isMenubar && topTriggerIds.length > 1) {
                const secondTrigger = document.getElementById(topTriggerIds[1])!;
                const secondMenu = document.getElementById(secondTrigger.getAttribute('commandfor') || '')!;
                return (
                  !firstMenu.matches(':popover-open') &&
                  secondMenu.matches(':popover-open') &&
                  document.activeElement === secondTrigger
                );
              } else {
                return firstMenu.matches(':popover-open');
              }
            },
            { isMenubar: info.isMenubar, topTriggerIds: info.topTriggerIds }
          )
        )
        .toBe(true);
    });

    test('Pressing Escape closes only the current menu level, sets its trigger\'s aria-expanded to "false", and restores focus to the trigger that opened it, including for nested submenus', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (subMenu.matches(':popover-open')) subMenu.hidePopover();
        subBtn.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            return subMenu.matches(':popover-open') && subMenu.contains(document.activeElement);
          }, info.submenuTriggerId)
        )
        .toBe(true);

      await page.keyboard.press('Escape');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            const parentMenu = subBtn.closest<HTMLElement>('[popover]')!;
            return (
              !subMenu.matches(':popover-open') &&
              subBtn.getAttribute('aria-expanded') === 'false' &&
              parentMenu.matches(':popover-open') &&
              document.activeElement === subBtn
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Pressing Tab from a trigger or inside an open menu closes all open menus and leaves the menu system instead of stepping through every command', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        subBtn.focus();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, info.submenuTriggerId);

      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            return subMenu.matches(':popover-open') && subMenu.contains(document.activeElement);
          }, info.submenuTriggerId)
        )
        .toBe(true);

      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const stillInside = await page.evaluate(async () => {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          return Boolean(document.activeElement?.closest('[popover]'));
        });
        if (!stillInside) break;
      }

      await expect
        .poll(() =>
          page.evaluate(() => {
            const openPopovers = document.querySelectorAll('[popover]:popover-open');
            const activeInPopover = document.activeElement?.closest('[popover]');
            return openPopovers.length === 0 && !activeInPopover;
          })
        )
        .toBe(true);
    });

    test('Clicking a closed trigger opens its menu with focus left on the trigger (no item focused), clicking an open or previewed trigger closes its menu and leaves focus on the trigger, and clicking outside closes every open menu level', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            return (
              menu.matches(':popover-open') &&
              document.activeElement === btn &&
              !menu.contains(document.activeElement)
            );
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            return !menu.matches(':popover-open') && btn.getAttribute('aria-expanded') === 'false';
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            return menu.matches(':popover-open');
          }, triggerId)
        )
        .toBe(true);

      await page.locator('body').click({ position: { x: 5, y: 5 } });

      await expect
        .poll(() =>
          page.evaluate(() => {
            return document.querySelectorAll('[popover]:popover-open').length === 0;
          })
        )
        .toBe(true);
    });

    test('Opening a menu by pointer keeps focus on its trigger with no item focused or matching :focus-visible; opening by keyboard focuses the first enabled item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            const anyFocusVisibleInMenu = menu.querySelector(':focus-visible') !== null;
            return (
              menu.matches(':popover-open') &&
              document.activeElement === btn &&
              !menu.contains(document.activeElement) &&
              !anyFocusVisibleInMenu
            );
          }, triggerId)
        )
        .toBe(true);

      await page.locator(`#${triggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            return !menu.matches(':popover-open') && btn.getAttribute('aria-expanded') === 'false';
          }, triggerId)
        )
        .toBe(true);

      await page.evaluate((id) => document.getElementById(id)!.focus(), triggerId);
      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((id) => {
            const btn = document.getElementById(id)!;
            const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
            const group = menu.querySelector('[focusgroup~="menu"]')!;
            const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
              (el) => el.closest('[focusgroup]') === group && !(el as HTMLButtonElement).disabled
            );
            return menu.matches(':popover-open') && items.length > 0 && document.activeElement === items[0];
          }, triggerId)
        )
        .toBe(true);
    });

    test('Moving the pointer over a menu item focuses that item without a visible focus ring, so at most one item is styled as active at a time', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const triggerId = info.topTriggerIds[0];

      await page.locator(`#${triggerId}`).click();

      const itemSelector = await page.evaluate((id) => {
        const btn = document.getElementById(id)!;
        const menu = document.getElementById(btn.getAttribute('commandfor') || '')!;
        const group = menu.querySelector('[focusgroup~="menu"]')!;
        const items = Array.from(group.querySelectorAll<HTMLElement>('button, a[href]')).filter(
          (el) => el.closest('[focusgroup]') === group
        );
        const target = items[0];
        if (!target.id) target.id = 'grader-hover-item';
        return `#${target.id}`;
      }, triggerId);

      await page.locator(itemSelector).hover();

      await expect
        .poll(() =>
          page.evaluate((sel) => {
            const item = document.querySelector<HTMLElement>(sel)!;
            return document.activeElement === item && !item.matches(':focus-visible');
          }, itemSelector)
        )
        .toBe(true);
    });

    test('With no menu open, hovering a top-level trigger does nothing; while a top-level menu is open, moving the pointer over a different top-level trigger closes the open menu and previews the hovered one with focus on that trigger in a menubar, or leaves the open menu unchanged for separate menu buttons', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      const firstId = info.topTriggerIds[0];

      await page.locator(`#${firstId}`).hover();
      const closedOnIdleHover = await page.evaluate(() => {
        return document.querySelectorAll('[popover]:popover-open').length === 0;
      });

      let openHoverValid = true;
      if (info.isMenubar && info.topTriggerIds.length > 1) {
        const secondId = info.topTriggerIds[1];
        await page.locator(`#${firstId}`).click();
        await page.locator(`#${secondId}`).hover();
        openHoverValid = await page.evaluate(
          ({ fId, sId }) => {
            const firstMenu = document.getElementById(document.getElementById(fId)!.getAttribute('commandfor') || '')!;
            const secondTrigger = document.getElementById(sId)!;
            const secondMenu = document.getElementById(secondTrigger.getAttribute('commandfor') || '')!;
            return (
              !firstMenu.matches(':popover-open') &&
              secondMenu.matches(':popover-open') &&
              document.activeElement === secondTrigger
            );
          },
          { fId: firstId, sId: secondId }
        );
      }

      expect(closedOnIdleHover && openHoverValid).toBe(true);
    });

    test('Moving the pointer over a submenu trigger previews its submenu after a short delay, and moving to a sibling item closes that submenu', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      const triggerCenter = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const r = subBtn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, info.submenuTriggerId);

      await page.mouse.move(triggerCenter.x, triggerCenter.y);

      // The submenu must not open synchronously on pointer entry; it opens only after a short delay.
      await expectNever(
        page,
        (subId) => {
          const subBtn = document.getElementById(subId);
          const subMenu = subBtn ? document.getElementById(subBtn.getAttribute('commandfor') || '') : null;
          return Boolean(subMenu && subMenu.matches(':popover-open'));
        },
        { forMs: 40, arg: info.submenuTriggerId }
      );

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            return subMenu.matches(':popover-open') && subBtn.getAttribute('aria-expanded') === 'true';
          }, info.submenuTriggerId)
        )
        .toBe(true);

      const siblingId = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const parentGroup = subBtn.closest('[focusgroup~="menu"]')!;
        const sib = Array.from(parentGroup.querySelectorAll<HTMLElement>('button, a[href]')).find(
          (el) => el.closest('[focusgroup]') === parentGroup && el !== subBtn
        );
        if (sib && !sib.id) sib.id = 'grader-sib-item';
        return sib ? sib.id : '';
      }, info.submenuTriggerId);

      expect(Boolean(siblingId)).toBe(true);
      await page.locator(`#${siblingId}`).hover();
      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            return !subMenu.matches(':popover-open');
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('A diagonal move from the middle of a submenu trigger to any item in its submenu keeps the submenu open (a pointer-following safe triangle), while moving to a sibling item outside that path closes it', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.locator(`#${info.submenuTriggerId}`).hover();

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            return subMenu.matches(':popover-open');
          }, info.submenuTriggerId)
        )
        .toBe(true);

      const coords = await page.evaluate(
        ({ subId, leafId }) => {
          const subBtn = document.getElementById(subId)!;
          const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
          if (!subMenu.matches(':popover-open')) return null;
          const leaf = document.getElementById(leafId) || subMenu.querySelector<HTMLElement>('button, a[href]');
          if (!leaf) return null;
          const tRect = subBtn.getBoundingClientRect();
          const lRect = leaf.getBoundingClientRect();
          return {
            startX: tRect.left + tRect.width / 2,
            startY: tRect.top + tRect.height / 2,
            endX: lRect.left + lRect.width / 2,
            endY: lRect.top + lRect.height / 2,
          };
        },
        { subId: info.submenuTriggerId, leafId: info.submenuLeafId }
      );
      expect(coords).not.toBeNull();

      await page.mouse.move(coords!.startX, coords!.startY);
      await page.mouse.move(coords!.endX, coords!.endY, { steps: 5 });

      await expectNever(
        page,
        (subId) => {
          const subBtn = document.getElementById(subId);
          const subMenu = subBtn ? document.getElementById(subBtn.getAttribute('commandfor') || '') : null;
          return !subMenu || !subMenu.matches(':popover-open');
        },
        { forMs: 400, arg: info.submenuTriggerId }
      );
    });

    test('Activating a command item closes all open menu levels, restores focus to the root menu trigger, and never leaves focus inside hidden content', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.commandTriggerId);

      await page.evaluate(
        async ({ trigId, menuId }) => {
          const trig = document.getElementById(trigId)!;
          const menu = document.getElementById(menuId)!;
          if (!menu.matches(':popover-open')) {
            try {
              (menu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
                source: trig,
              });
            } catch {
              menu.showPopover();
            }
          }
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const group = menu.querySelector('[focusgroup~="menu"]')!;
          const cmd = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([commandfor])')).find(
            (b) =>
              b.closest('[focusgroup]') === group &&
              b.getAttribute('role') !== 'menuitemcheckbox' &&
              b.getAttribute('role') !== 'menuitemradio'
          )!;
          cmd.focus();
        },
        { trigId: info.commandTriggerId, menuId: info.commandMenuId }
      );

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((trigId) => {
            const trig = document.getElementById(trigId)!;
            const openMenus = document.querySelectorAll('[popover]:popover-open');
            const activeInPopover = document.activeElement?.closest('[popover]');
            return openMenus.length === 0 && document.activeElement === trig && !activeInPopover;
          }, info.commandTriggerId)
        )
        .toBe(true);
    });

    test('A submenu trigger only opens its submenu and never also runs a command; a default action is the first submenu item or a separate command item', async ({
      page,
    }) => {
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      await page.evaluate(async (subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        subBtn.focus();
        if (!subMenu.matches(':popover-open')) {
          try {
            (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: subBtn,
            });
          } catch {
            subMenu.showPopover();
          }
        }
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (subMenu.matches(':popover-open')) subMenu.hidePopover();
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, info.submenuTriggerId);

      await page.keyboard.press('Enter');

      await expect
        .poll(() =>
          page.evaluate((subId) => {
            const subBtn = document.getElementById(subId)!;
            const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
            const parentMenu = subBtn.closest<HTMLElement>('[popover]')!;
            const group = subMenu.querySelector('[focusgroup~="menu"]');
            const ownActionItems = group
              ? Array.from(group.querySelectorAll<HTMLElement>('button:not([commandfor]), a[href]')).filter(
                  (el) => el.closest('[focusgroup]') === group
                )
              : [];
            return (
              parentMenu.matches(':popover-open') &&
              subMenu.matches(':popover-open') &&
              ownActionItems.length > 0
            );
          }, info.submenuTriggerId)
        )
        .toBe(true);
    });

    test('Checked items render a visible check mark in the leading slot (::before content is not empty); unchecked items don\'t', async ({
      page,
    }) => {
      const valid = await page.evaluate(() => {
        const checked = document.querySelector<HTMLElement>(
          '[focusgroup~="menu"] button[aria-checked="true"]'
        );
        const unchecked = document.querySelector<HTMLElement>(
          '[focusgroup~="menu"] button[aria-checked="false"]'
        );
        if (!checked || !unchecked) return false;
        const checkedContent = window
          .getComputedStyle(checked, '::before')
          .content.replace(/['"]/g, '')
          .trim();
        const uncheckedContent = window
          .getComputedStyle(unchecked, '::before')
          .content.replace(/['"]/g, '')
          .trim();
        return (
          checkedContent.length > 0 &&
          checkedContent !== 'none' &&
          (uncheckedContent === '' || uncheckedContent === 'none')
        );
      });

      expect(valid).toBe(true);
    });

    test('At a 375 px viewport, an open submenu sits directly below its trigger item and its box does not intersect the trigger\'s box', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      const info = await discoverMenus(page);
      await openParentChainForTrigger(page, info.submenuTriggerId);

      const geometry = await page.evaluate((subId) => {
        const subBtn = document.getElementById(subId)!;
        const subMenu = document.getElementById(subBtn.getAttribute('commandfor') || '')!;
        if (!subMenu.matches(':popover-open')) {
          try {
            (subMenu as HTMLElement & { showPopover: (opts?: { source?: HTMLElement }) => void }).showPopover({
              source: subBtn,
            });
          } catch {
            subMenu.showPopover();
          }
        }
        const tRect = subBtn.getBoundingClientRect();
        const mRect = subMenu.getBoundingClientRect();
        const horizontallyOverlaps = mRect.left < tRect.right && mRect.right > tRect.left;
        const verticallyOverlaps = mRect.top < tRect.bottom - 1 && mRect.bottom > tRect.top + 1;
        const intersectsTrigger = horizontallyOverlaps && verticallyOverlaps;
        const sitsBelowTrigger = mRect.top >= tRect.bottom - 1;
        return { intersectsTrigger, sitsBelowTrigger };
      }, info.submenuTriggerId);

      expect(geometry.sitsBelowTrigger && !geometry.intersectsTrigger).toBe(true);
    });

    test('After a pointer activation of a command, focus returns to the root trigger without :focus-visible', async ({
      page,
    }) => {
      const info = await discoverMenus(page);

      await page.locator(`#${info.commandTriggerId}`).scrollIntoViewIfNeeded();
      await page.locator(`#${info.commandTriggerId}`).click();
      await expect
        .poll(() =>
          page.evaluate((menuId) => {
            const menu = document.getElementById(menuId);
            return Boolean(menu && menu.matches(':popover-open'));
          }, info.commandMenuId)
        )
        .toBe(true);

      const cmdSelector = await page.evaluate(
        ({ menuId }) => {
          const menu = document.getElementById(menuId)!;
          const group = menu.querySelector('[focusgroup~="menu"]')!;
          const cmd = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([commandfor])')).find(
            (b) =>
              b.closest('[focusgroup]') === group &&
              b.getAttribute('role') !== 'menuitemcheckbox' &&
              b.getAttribute('role') !== 'menuitemradio'
          )!;
          if (!cmd.id) cmd.id = 'grader-cmd-btn';
          return `#${cmd.id}`;
        },
        { menuId: info.commandMenuId }
      );

      await page.locator(cmdSelector).click();

      await expect
        .poll(() =>
          page.evaluate((trigId) => {
            const trig = document.getElementById(trigId)!;
            const openMenus = document.querySelectorAll('[popover]:popover-open');
            return (
              openMenus.length === 0 &&
              document.activeElement === trig &&
              !trig.matches(':focus-visible')
            );
          }, info.commandTriggerId)
        )
        .toBe(true);
    });
  });
});
