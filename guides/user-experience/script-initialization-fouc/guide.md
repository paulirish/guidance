---
name: script-initialization-fouc
description: Prevent visual flickering or layout shifts for elements that rely on script-driven animations or initialization during page load.
web-feature-ids:
  - scripting
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@media/scripting
---

# Prevent layout shifts and flickering for script-initialized components

Script-driven components—like interactive carousels, complex data visualizations, or custom animations—often cause visual flickering or layout shifts (Cumulative Layout Shift) if they appear in a "broken" or unstyled state before their initializing JavaScript executes. The `scripting` media query allows you to apply specific styles based on whether the browser supports and allows JavaScript, ensuring that script-dependent elements are hidden or properly "placeheld" only when a script is actually expected to take over.

## How to implement

### Reserving space for script-only elements
To prevent layout shifts, use the `scripting` media query to hide script-dependent elements while reserving their required dimensions. This ensures that when the script eventually initializes the component, the surrounding content does not jump.

```css
/* 
   Only apply "loading" states if we know JavaScript is enabled. 
   This avoids hiding content from users who have disabled scripts.
*/
@media (scripting: enabled) {
  .interactive-map:not(.is-initialized) {
    /* Hide the raw data/fallback while reserving the 400px height */
    visibility: hidden;
    height: 400px;
    background: #f0f0f0; /* Optional: show a neutral placeholder color */
  }
}

/* 
   If scripting is disabled, the .interactive-map remains visible 
   in its static, CSS-only fallback state.
*/
```

### Initializing and revealing content
Once your script has successfully initialized the component, remove the "uninitialized" state to reveal the interactive element.

```javascript
// component-init.js
export function initMap(element) {
  // Perform complex initialization logic here
  // ...
  
  // Reveal the element only after it is ready for interaction
  element.classList.add('is-initialized');
}
```

### Handling "Initial Only" scripting
Some environments (like certain proxy browsers) may allow scripts to run during page load but not after. The `initial-only` value helps you avoid providing complex interactive UI to browsers that can't support it after the first render.

```css
@media (scripting: initial-only) {
  /* 
     Provide a "print-like" or static version for environments 
     where scripts run once but don't support ongoing interactivity.
  */
  .dynamic-timer {
    display: none;
  }
}
```

## Fallback strategies

{{ BASELINE_STATUS("scripting") }}

When the `scripting` media query is not supported, the browser ignores the `@media` block entirely. In these browsers, script-dependent elements will be visible in their uninitialized state immediately upon page load, potentially leading to the flickering or layout shifts you are trying to avoid.

To provide a robust fallback for older browsers, use the "JS-class" pattern. This involves a tiny, blocking inline script at the top of your `<head>` to signal script support before the rest of the page renders:

```html
<!-- Add this at the very top of your <head> -->
<script>
  // Immediately add a class to the document to signal JS support
  document.documentElement.classList.add('js-enabled');
</script>

<style>
  /* Fallback for browsers that don't support @media (scripting) */
  .js-enabled .interactive-map:not(.is-initialized) {
    visibility: hidden;
    height: 400px;
  }
  
  /* 
     Modern approach: If the browser supports @media (scripting),
     it will use the logic defined in the "How to implement" section.
  */
</style>
```

This dual approach ensures that modern browsers benefit from the standardized media query, while older browsers still receive a flicker-free experience through a simple class-based toggle. Avoid using `display: none` for placeholders unless the element has no impact on the document flow, as `visibility: hidden` is generally better for preventing layout shifts by maintaining the element's box model.