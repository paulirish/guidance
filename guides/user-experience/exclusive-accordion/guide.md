---
name: exclusive-accordion
description: Organize related content into sections where opening one automatically collapses the others to reduce visual noise and maintain context.
web-feature-ids:
  - details-name
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDetailsElement/name
  - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details.name
---

# Organize content into mutually exclusive disclosure sections

Using the `name` attribute on the `<details>` element allows you to group multiple disclosure widgets so that only one can be open at a time. This native accordion pattern reduces visual clutter and helps users maintain focus on a single piece of content without requiring custom JavaScript state management.

## How to implement

### Grouping elements with the name attribute
To create a mutually exclusive group, assign the same `name` value to each `<details>` element. When a user opens one element in the group, the browser automatically closes any other open element with the same name.

```html
<!-- MANDATORY: Use identical name attributes to link the disclosure widgets into a group -->
<details name="product-info">
  <summary>Specifications</summary>
  <ul>
    <li>Weight: 1.2kg</li>
    <li>Dimensions: 20x30x5cm</li>
  </ul>
</details>

<details name="product-info">
  <summary>Warranty</summary>
  <p>Standard 2-year manufacturer warranty applies.</p>
</details>

<details name="product-info">
  <summary>Shipping</summary>
  <p>Free standard shipping on orders over $50.</p>
</details>
```

### Setting the default open section
You can specify which section should be visible on page load by adding the `open` attribute to one of the elements. In a named group, the browser ensures that only the last element declared with the `open` attribute remains open if multiple are specified.

```html
<!-- The 'open' attribute determines the initial expanded state -->
<details name="faq" open>
  <summary>How do I reset my password?</summary>
  <p>Navigate to settings and click "Forgot Password".</p>
</details>

<details name="faq">
  <summary>How do I update my billing info?</summary>
  <p>Visit the billing tab in your profile dashboard.</p>
</details>
```

### Styling the accordion
Because these elements are semantically grouped, you should apply styles that reinforce their relationship, such as consistent borders or shared container styling.

```css
/* Ensure the summary indicates interactivity */
summary {
  cursor: pointer;
  padding: 1rem;
  background: #f4f4f4;
  border-bottom: 1px solid #ddd;
}

/* Add spacing or transitions to the content area */
details[name="product-info"] > :not(summary) {
  padding: 1rem;
}
```

## Fallback strategies

{{ BASELINE_STATUS("details-name") }}

The `name` attribute on `<details>` is a progressive enhancement. In browsers that do not support it, the elements will function as standard, independent disclosure widgets. Users will still be able to open and close each section, but opening one will not automatically collapse others, allowing multiple sections to be visible simultaneously.

### Feature detection and manual fallback
If the mutually exclusive behavior is critical for the layout (e.g., in tight sidebars), you can detect support and implement a lightweight JavaScript fallback.

```javascript
// Detect support by checking for the 'name' property on the HTMLDetailsElement prototype
const supportsDetailsName = 'name' in HTMLDetailsElement.prototype;

if (!supportsDetailsName) {
  // Select all details elements that have a name attribute
  const detailsGroups = document.querySelectorAll('details[name]');
  
  detailsGroups.forEach((details) => {
    details.addEventListener('toggle', (event) => {
      // Only trigger logic when an element is being opened
      if (details.open) {
        const groupName = details.getAttribute('name');
        // Find other open elements in the same name group and close them
        document.querySelectorAll(`details[name="${groupName}"][open]`).forEach((other) => {
          if (other !== details) {
            other.open = false;
          }
        });
      }
    });
  });
}