---
name: restore-element-layout
description: Restore an element's intended layout behavior when revealing it without manually tracking its specific display mode.
web-feature-ids:
  - revert-value
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Values/revert
---

# Restore an element's intended layout behavior using the `revert` keyword

Managing the visibility of elements often leads to brittle code where developers manually track whether an element should be `display: block`, `display: inline-flex`, or `display: table-cell` when revealing it. Hardcoding these values in JavaScript or CSS utility classes makes the codebase difficult to maintain when layout requirements change. The `revert` keyword solves this by rolling back the property to the value it would have had if the current styling level (e.g., inline styles or a specific CSS layer) had not been applied, effectively restoring the element's intended layout behavior without needing to know what that behavior was.

## The skinny

### Use `revert` to clear inline style overrides
When hiding elements via JavaScript using inline styles, use `revert` to show them again. This is superior to setting the value to an empty string or a specific keyword like `block` because it ensures that any CSS rules defined in your external stylesheets are respected.

```javascript
// Function to reveal an element while respecting its original layout mode
export function revealElement(element) {
  // MANDATORY: Use 'revert' to roll back the inline 'display: none'
  // This restores the value defined in the CSS stylesheet (e.g., flex, grid)
  element.style.display = 'revert';
}

// Function to hide an element
export function hideElement(element) {
  element.style.display = 'none';
}
```

### Apply `revert` in utility classes
If you use a global utility class to hide elements, you can use a "reveal" class that employs `revert` to restore the natural browser or author-defined layout. This is particularly useful for components that might be either `block` or `inline` depending on their context.

```css
/* A generic utility to hide elements */
.u-hidden {
  display: none !important;
}

/* 
  A utility to restore visibility. 
  'revert' rolls back the 'none' to the previous cascade level.
*/
.u-visible {
  display: revert !important; 
}
```

### Distinguish `revert` from `initial` and `unset`
It is critical to use `revert` rather than `initial` or `unset` for layout properties. 
- `initial` resets the property to the CSS specification's default (which for `display` is `inline`), often breaking block-level elements like `div` or `section`.
- `unset` behaves like `inherit` for inherited properties and `initial` for non-inherited ones (like `display`), leading to the same layout breakage.
- `revert` rolls back to the User Agent (browser) or User styles if no Author styles apply.

```css
.card {
  display: flex; /* The intended layout */
}

.card.is-active {
  /* 
    DO NOT use display: initial; (this would force 'inline')
    DO NOT use display: unset; (this would also force 'inline')
  */
  display: revert; /* Correctly keeps 'flex' or restores to UA 'block' if overridden */
}
```

## Fallback strategies

{{ BASELINE_STATUS("revert-value") }}

If the `revert` keyword is not supported, the browser will treat the property as invalid or fall back to the previously cascaded value.

### Feature detection and manual reset
For browsers that do not support `revert`, the most reliable fallback when using JavaScript is to remove the inline style property entirely by setting it to an empty string. This allows the stylesheet's values to take effect again.

```javascript
/**
 * Safe reveal utility with fallback for older browsers
 * @param {HTMLElement} el 
 */
export function safeReveal(el) {
  if (CSS.supports('display', 'revert')) {
    el.style.display = 'revert';
  } else {
    // Fallback: Removing the property from the style attribute 
    // triggers the same cascade behavior as revert for inline styles.
    el.style.display = '';
  }
}
```

### CSS Fallbacks
In pure CSS, you can provide a common default (like `block`) before the `revert` declaration. Browsers that don't understand `revert` will ignore that line and keep the previous value.

```css
.toggle-element {
  /* Fallback for very old browsers */
  display: block; 
  /* Modern browsers will override the above with the actual reverted value */
  display: revert; 
}