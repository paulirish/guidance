---
name: exclusive-status-logs
description: Display multiple streams of status information or logs where only one stream is visible at a time to prevent layout shifts and over-expansion.
web-feature-ids:
  - details-name
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/name
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details.name
---

# Exclusive Status Log Streams with Grouped Details

Displaying multiple high-density information streams, such as build logs or system status feeds, often leads to excessive vertical scrolling and layout instability when containers expand. Using mutually exclusive `<details>` elements allows you to group related streams so that opening one automatically closes others. This ensures a predictable vertical footprint and prevents layout over-expansion without requiring JavaScript-heavy accordion logic.

## How to implement

### Grouping related streams
Use the `name` attribute to link multiple `<details>` elements into a single functional group. The browser enforces exclusivity within this group, ensuring that only one detail is expanded at a time.

```html
<!-- The name attribute creates a group where only one element can be open -->
<details name="log-group">
  <summary>Build Logs</summary>
  <pre>Step 1: Compiling... OK</pre>
</details>

<details name="log-group">
  <summary>Test Results</summary>
  <pre>All tests passed: 142/142</pre>
</details>

<details name="log-group">
  <summary>Deployment Status</summary>
  <pre>Uploading artifacts...</pre>
</details>
```

### Managing initial state
To define which stream is visible by default, apply the `open` attribute to exactly one element in the group. If multiple elements are marked `open`, the browser will typically honor the last one in the source order to maintain the exclusivity constraint.

```html
<!-- MANDATORY: Only one element should start with the 'open' attribute 
     to provide a clear, non-conflicting entry point for the user. -->
<details name="log-group" open>
  <summary>System Overview</summary>
  <p>Status: Healthy</p>
</details>
```

### Styling for layout stability
While the browser handles the closing of other elements, you should use CSS to ensure that the content swap is smooth and does not cause jarring jumps in the surrounding UI.

```css
/* Apply a fixed height or max-height to the content area of the logs 
   to prevent different stream lengths from shifting the footer or 
   adjacent elements significantly. */
details[name="log-group"] pre {
  max-height: 300px;
  overflow-y: auto;
  background: #f4f4f4;
  padding: 1rem;
  margin-top: 0;
}

/* Optional: Style the summary to indicate it is an interactive 
   header in a mutually exclusive set. */
details[name="log-group"] summary {
  cursor: pointer;
  padding: 0.5rem;
  border-bottom: 1px solid #ddd;
}
```

## Fallback strategies

{{ BASELINE_STATUS("details-name") }}

In browsers that do not support the `name` attribute on the `<details>` element, the component will gracefully degrade into standard disclosure widgets. Users will still be able to open and close all logs, but multiple logs may remain open simultaneously. The core functionality of accessing the data remains intact, though the layout-saving exclusivity will be lost.

To detect support and manually enforce exclusivity for older browsers, use feature detection on the prototype:

```javascript
// Check for the 'name' property in HTMLDetailsElement
const supportsExclusiveDetails = 'name' in HTMLDetailsElement.prototype;

if (!supportsExclusiveDetails) {
  const detailsElements = document.querySelectorAll('details[name="log-group"]');
  
  detailsElements.forEach((el) => {
    el.addEventListener('toggle', () => {
      // If an element is opened, manually close all other elements in the group
      if (el.open) {
        detailsElements.forEach((other) => {
          if (other !== el && other.open) {
            other.open = false;
          }
        });
      }
    });
  });
}