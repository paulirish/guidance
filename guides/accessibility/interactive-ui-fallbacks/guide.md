---
name: interactive-ui-fallbacks
description: Display interactive interface components or their static alternatives based on the availability of client-side scripting.
web-feature-ids:
  - scripting
sources:
  - https://developer.mozilla.org/docs/Web/CSS/Reference/At-rules/@media/scripting
---

# Display interactive interface components or their static alternatives based on the availability of client-side scripting

The `scripting` media query allows you to apply styles based on whether the browser supports and permits the execution of client-side scripts (JavaScript). This approach is superior to traditional methods like adding a `.no-js` class via script, as it eliminates the "flash of unstyled content" (FOUC) and works instantly without waiting for a script to execute and modify the DOM. By using this feature, you can ensure that users without scripting receive a functional, static experience while automatically promoting users with scripting to a more interactive interface.

## How to implement

### Using the scripting media feature
MANDATORY: Use the `@media (scripting: ...)` syntax to detect the scripting environment. The most common values are `enabled` and `none`.

```css
/* 
   By default, we assume a basic functional state. 
   Interactive elements that require JS to function should be hidden initially 
   to prevent a "broken" user experience where a button does nothing.
*/
.interactive-component {
  display: none;
}

@media (scripting: enabled) {
  /* 
     When scripting is enabled, show the enhanced component.
     This block executes as soon as the CSS is parsed if JS is available.
  */
  .interactive-component {
    display: block;
  }

  /* 
     Hide the static fallback (e.g., a standard link or form) 
     because the interactive version provides a better experience.
  */
  .static-fallback {
    display: none;
  }
}

@media (scripting: none) {
  /* 
     Explicitly style the fallback for environments where scripting is disabled.
     This is useful for adding "No-JS" warnings or specific static layouts.
  */
  .no-js-warning {
    display: block;
    padding: 1rem;
    background: #fff3cd;
    border: 1px solid #ffeeba;
  }
}
```

### Handling "initial-only" scripting
OPTIONAL: Some environments (like certain email clients or specialized browsers) only allow scripts to run during the initial page load but not afterward. You can specifically target or exclude these using `initial-only`.

```css
@media (scripting: initial-only) {
  /* 
     Styles for environments where scripts run once but don't support 
     ongoing interactivity (like event listeners). 
  */
  .initial-setup-only {
    opacity: 1;
  }
}
```

### Progressive enhancement workflow
MANDATORY: Structure your HTML so that the core functionality is available via standard HTML elements (links, forms) first. Use the `scripting` media query to swap these for interactive elements (tabs, carousels, maps).

```html
<!-- The static fallback: a simple link to a search page -->
<a href="/search" class="static-fallback">Search Locations</a>

<!-- The interactive component: a JS-powered autocomplete search bar -->
<div class="interactive-component">
  <input type="text" id="site-search" placeholder="Search locations...">
  <ul id="results-dropdown"></ul>
</div>

<script type="module">
  // Always use ES modules for modern scripting.
  // The script only needs to handle the logic; CSS handles the visibility.
  const input = document.getElementById('site-search');
  input.addEventListener('input', (e) => {
    /* Perform dynamic search logic here */
  });
</script>
```

## Fallback strategies

{{ BASELINE_STATUS("scripting") }}

### Feature detection and legacy fallbacks
For browsers that do not support the `scripting` media query, the media query block will simply be ignored. This means your "default" styles (the static fallback) will remain visible.

MANDATORY: If you must support older browsers that lack this media query, continue using the "No-JS" class pattern as a secondary enhancement.

```html
<script>
  /* 
     MANDATORY: This script must be in the <head> to minimize FOUC.
     It provides a fallback for browsers that don't support @media (scripting).
  */
  document.documentElement.classList.replace('no-js', 'js');
</script>

<style>
  /* 
     Legacy fallback logic:
     If the browser doesn't support @media (scripting), it falls back 
     to checking the class injected by the head script.
  */
  .no-js .interactive-component {
    display: none;
  }
  
  .js .interactive-component {
    display: block;
  }

  /* 
     Combine with the modern media query for the best of both worlds.
     Browsers supporting the media query will use it immediately.
  */
  @media (scripting: enabled) {
    .interactive-component {
      display: block;
    }
  }
</style>
```

### Using the <noscript> tag
For content that should *only* be visible when scripting is completely unavailable or disabled, the `<noscript>` tag remains a valid and simple tool, especially for providing alternative text or links to non-JS versions of a site.

```html
<noscript>
  <div class="alert">
    You are viewing a static version of this site. 
    For the full interactive experience, please enable JavaScript.
  </div>
</noscript>