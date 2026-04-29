---
name: preserve-accessibility-settings
description: Preserve user-defined accessibility settings when undoing custom styling for a property.
web-feature-ids:
  - revert-value
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Values/revert
---

# Preserve user-defined accessibility settings when undoing custom styling

Using the `revert` keyword allows you to roll back a CSS property to the value it would have had if no changes had been made in the current "Author" origin. Unlike `initial` (which resets to the CSS specification default) or `unset` (which resets to inherited or initial values), `revert` specifically honors the cascade. This ensures that any custom accessibility settings defined by the user (the "User" origin) or the browser (the "User Agent" origin) are preserved when you remove your custom styles.

## How to implement

### Use revert instead of initial or unset for resets
When you need to "undo" a style, `revert` is the most accessible choice. While `initial` might reset a property to a hard-coded value (like `color: black` or `font-family: serif`), `revert` looks back at the user's browser settings. If a user has specified a large font size or high-contrast colors in their browser preferences, `revert` will restore those specific values.

```css
.custom-widget {
  /* Custom author styles */
  background-color: #333;
  color: #fff;
}

.custom-widget.is-disabled {
  /* 
     MANDATORY: Use revert to restore the user's preferred 
     contrast colors if they have a custom user stylesheet. 
  */
  color: revert;
  background-color: revert;
}
```

### Restore accessibility in complex components
For components that heavily override default browser behavior (like custom focus rings or form elements), `revert` allows you to selectively return control to the browser and the user's settings.

```css
.custom-button:focus {
  /* Remove custom focus ring and restore the browser's default */
  /* DO NOT use 'outline: none' without a fallback; use revert instead. */
  outline: revert;
}
```

### Apply revert-layer for cascade layers
If you are using `@layer`, `revert-layer` rolls back the value to the previous layer in the author origin. If no previous layer exists, it behaves like `revert`, rolling back to the user or user-agent origin.

```css
@layer base {
  button {
    font-size: 1.2rem;
  }
}

@layer theme {
  button {
    /* 
       Rolls back to the 'base' layer value (1.2rem) 
       instead of the browser default. 
    */
    font-size: revert-layer;
  }
}
```

## Fallback strategies

{{ BASELINE_STATUS("revert-value") }}

### Graceful degradation for older browsers
In browsers that do not support `revert`, the property will be ignored. To provide a safe fallback, use `@supports` or provide a fallback value like `unset`. Note that `unset` will not respect the "User" origin (user-defined accessibility settings) but will prevent the element from remaining in an broken state.

```css
.element {
  /* Fallback for very old browsers */
  color: unset; 
  
  /* 
     MANDATORY: Check for support to ensure revert is only 
     applied where it will correctly restore the cascade. 
  */
  @supports (color: revert) {
    color: revert;
  }
}
```

### Feature detection in JavaScript
If you are applying styles via JavaScript, check if the browser supports the keyword before applying it to ensure the UI does not fail silently.

```javascript
/**
 * Checks if the CSS 'revert' keyword is supported for a specific property.
 * @param {string} property - The CSS property to check.
 */
function supportsRevert(property) {
  // Use CSS.supports to verify the keyword is valid for the property
  return window.CSS && CSS.supports(property, 'revert');
}

const element = document.querySelector('.my-element');
if (supportsRevert('color')) {
  element.style.color = 'revert';
} else {
  // Fallback to unset or a specific safe default
  element.style.color = 'unset';
}