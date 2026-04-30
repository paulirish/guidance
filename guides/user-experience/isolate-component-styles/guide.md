---
name: isolate-component-styles
description: Isolate a component's styling from global or third-party CSS frameworks to ensure it renders using native browser defaults.
web-feature-ids:
  - revert-value
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/Values/revert
---

# Isolate Component Styling with `revert`

The `revert` keyword allows you to restore an element's CSS properties to the values defined in the browser's User Agent (UA) stylesheet. This is the primary mechanism for "unstyling" an element that has been affected by aggressive global CSS frameworks or third-party resets, ensuring it renders using the native browser defaults.

## The skinny

### Resetting an entire element or container
To completely isolate a component from global author styles, use the `all` shorthand property. This resets every CSS property on the element to the value it would have had if no author-level CSS (including your own and your framework's) were applied.

```css
.native-component-container {
  /* MANDATORY: This rolls back the cascade to the User Agent level */
  /* This will restore browser-specific padding, margins, and display values */
  all: revert;
}

.native-button {
  /* Use revert for specific elements to keep their native OS/browser appearance */
  /* This is useful when a framework has globally changed button borders or backgrounds */
  all: revert;
  cursor: pointer; /* Re-apply specific author styles after the revert */
}
```

### Understanding `revert` vs. `initial`
It is critical to distinguish between `revert` and `initial`.
*   **`revert`**: Restores the browser's default (e.g., `display: block` for a `<div>`).
*   **`initial`**: Restores the CSS specification's default (e.g., `display: inline` for a `<div>`), which often breaks expected layout behavior.

```css
.reset-box {
  /* DO NOT use initial if you want browser defaults */
  /* display: initial; would make this div 'inline' */
  display: revert; 
  
  /* Use revert to ensure lists keep their native bullets/indentation */
  list-style: revert;
  margin: revert;
}
```

### Targeted isolation in Shadow DOM
While `revert` works in the light DOM, it is particularly powerful when used inside a Shadow Root to ensure that any "inherited" styles from the parent page that bypass the shadow boundary are neutralized.

```javascript
// Example of applying a reset within a Web Component's Shadow DOM
export class NativeComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          /* Ensure the custom element host doesn't inherit global text-align or line-height */
          all: revert;
        }
      </style>
      <slot></slot>
    `;
  }
}
```

## Fallback strategies

{{ BASELINE_STATUS("revert-value") }}

### Feature Detection
If a browser does not support `revert`, the property declaration will be ignored, and the global styles will remain in effect. You can use `@supports` to provide a manual reset or a different layout strategy for older browsers.

```css
.component {
  /* Base styles for browsers without revert support */
  border: 1px solid gray;
}

@supports (all: revert) {
  .component {
    all: revert;
    /* Styles for modern browsers go here */
  }
}
```

### Graceful Degradation with `unset`
In browsers where `revert` is not supported, `unset` is often the closest alternative. However, `unset` will act as `inherit` for inherited properties and `initial` for non-inherited properties. This may not perfectly restore native browser styling (e.g., it won't restore a `<div>` to `display: block`), but it can help clear framework-specific values like background colors or borders.

```css
.legacy-fallback {
  /* If revert fails, unset will at least clear non-inherited framework styles */
  all: unset;
  /* Manually restore critical UA defaults that 'unset' might break */
  display: block; 
}