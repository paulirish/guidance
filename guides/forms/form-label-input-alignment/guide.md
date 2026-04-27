---
name: form-label-input-alignment
description: Synchronize the alignment of labels and input fields across multiple rows when they are nested within separate structural wrappers.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Aligning Nested Form Elements with CSS Subgrid

Synchronizing the alignment of labels and input fields is a common challenge when elements are nested within structural wrappers like `<div>` or `<li>` for styling or semantic purposes. Without subgrid, each wrapper creates its own isolated layout context, making it impossible for a label in one row to align perfectly with a label in another unless fixed widths are used. CSS Subgrid allows these nested wrappers to inherit the column definitions of a parent grid, ensuring perfect alignment across multiple rows regardless of content size.

## How to implement

### Define the master grid on the container
The parent container must be a grid that defines the columns you want the nested elements to follow. Typically, this is a two-column layout where the first column fits the longest label and the second column takes up the remaining space.

```css
.form-container {
  display: grid;
  /* max-content ensures the first column is only as wide as the longest label across all rows */
  grid-template-columns: max-content 1fr;
  gap: 1rem;
}
```

### Apply subgrid to the row wrappers
Each row wrapper must span the entire width of the parent grid and explicitly opt into the parent's grid tracks using the `subgrid` keyword.

```css
.form-row {
  /* MANDATORY: The wrapper must span all columns of the parent to make those tracks available to children */
  grid-column: 1 / -1;
  
  display: grid;
  /* Use 'subgrid' to adopt the columns defined in .form-container */
  grid-template-columns: subgrid;
  
  /* Ensures labels and inputs are vertically centered if they have different heights */
  align-items: center;
}
```

### Positioning nested elements
Once the wrapper is using `subgrid`, its immediate children (the label and input) will automatically place themselves into the inherited grid tracks.

```html
<form class="form-container">
  <div class="form-row">
    <label for="name">Full Name</label>
    <input type="text" id="name" name="name">
  </div>
  <div class="form-row">
    <label for="email">Email Address</label>
    <input type="email" id="email" name="email">
  </div>
</form>
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

When subgrid is not supported, nested grid items will ignore the parent's tracks and default to their own layout logic. This usually results in labels only being as wide as their own content within that specific row, breaking the vertical alignment across the form.

### Progressive enhancement with `@supports`
The most reliable fallback is to provide a standard grid or flexbox layout for older browsers, then upgrade to subgrid when available. A common fallback is to give labels a consistent fixed width or use a simple stacked layout.

```css
/* Base styles for browsers without subgrid */
.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-row label {
  /* Provide a reasonable default width so fields somewhat align */
  flex: 0 0 150px;
}

/* Enhancement for browsers supporting subgrid */
@supports (grid-template-columns: subgrid) {
  .form-container {
    display: grid;
    grid-template-columns: max-content 1fr;
  }

  .form-row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    margin-bottom: 0; /* Gap is handled by the parent grid */
  }

  .form-row label {
    flex: none;
    width: auto;
  }
}
```

### Feature Detection
If you need to apply specific logic or classes based on support, use `CSS.supports()` in your logic:

```javascript
if (CSS.supports('grid-template-columns', 'subgrid')) {
  // Apply subgrid-specific logic if necessary
}