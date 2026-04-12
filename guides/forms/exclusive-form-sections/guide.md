---
name: exclusive-form-sections
description: Present complex forms by revealing only one group of related inputs at a time to reduce user cognitive load and maintain a clean interface.
web-feature-ids:
  - details-name
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/name
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details.name
---

# Present Complex Forms Using Mutually Exclusive Details

For complex forms with many inputs, displaying every field at once can overwhelm users. By grouping related inputs within `<details>` elements that share a `name` attribute, you can create a native accordion. This ensures that opening one section automatically closes others, focusing the user's attention on a single group of inputs at a time while maintaining a clean, compact interface.

## How to implement

### Define the mutually exclusive group
To link disclosure widgets into a group where only one can be open at a time, assign the same `name` attribute value to each `<details>` element.

```html
<form>
  <!-- MANDATORY: All details elements in the same group must share the exact same 'name' value -->
  <details name="shipping-steps" open>
    <!-- Use the 'open' attribute on the first item so the form starts in an actionable state -->
    <summary>Step 1: Contact Details</summary>
    <div class="step-content">
      <label for="email">Email Address</label>
      <input type="email" id="email" required>
    </div>
  </details>

  <details name="shipping-steps">
    <!-- When this summary is clicked, the 'Contact Details' section will automatically close -->
    <summary>Step 2: Shipping Address</summary>
    <div class="step-content">
      <label for="addr">Street Address</label>
      <input type="text" id="addr" required>
    </div>
  </details>

  <details name="shipping-steps">
    <summary>Step 3: Delivery Options</summary>
    <div class="step-content">
      <fieldset>
        <legend>Speed</legend>
        <label><input type="radio" name="speed" value="standard"> Standard</label>
        <label><input type="radio" name="speed" value="express"> Express</label>
      </fieldset>
    </div>
  </details>
</form>
```

### Enhance navigation with focus management
Because the browser automatically closes other sections, the page layout may shift. You can use the `toggle` event to ensure the newly opened section remains visible.

```javascript
const steps = document.querySelectorAll('details[name="shipping-steps"]');

steps.forEach((step) => {
  step.addEventListener('toggle', () => {
    // The toggle event fires when the state changes to open OR closed
    if (step.open) {
      // OPTIONAL: Scroll the opened section into view to prevent it from jumping off-screen
      // Use 'nearest' to avoid aggressive jumping while ensuring the content is visible
      step.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // OPTIONAL: Automatically focus the first input in the new section to aid keyboard users
      step.querySelector('input, textarea, select')?.focus();
    }
  });
});
```

## Fallback strategies

{{ BASELINE_STATUS("details-name") }}

In browsers that do not support the `name` attribute on `<details>`, the attribute is ignored. The sections will behave like standard independent disclosure widgets. This is a graceful degradation: the user can still access all form fields, but they may need to close sections manually to keep the interface tidy.

If your layout strictly requires mutual exclusivity, implement this JavaScript fallback:

```javascript
// Feature detection: Check if the 'name' property exists on the HTMLDetailsElement prototype
if (!('name' in HTMLDetailsElement.prototype)) {
  const groupedDetails = document.querySelectorAll('details[name]');

  groupedDetails.forEach((target) => {
    target.addEventListener('toggle', () => {
      // Only trigger the closing logic when a section is being opened
      if (!target.open) return;

      const groupName = target.getAttribute('name');
      const others = document.querySelectorAll(`details[name="${groupName}"][open]`);
      
      others.forEach((other) => {
        if (other !== target) {
          // MANDATORY: Manually close other elements in the group to mimic native behavior
          other.open = false;
        }
      });
    });
  });
}