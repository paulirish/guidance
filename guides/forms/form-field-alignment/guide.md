---
name: form-field-alignment
description: Align form labels and input fields across multiple rows when each pair is wrapped in its own container element.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Aligning Form Fields Across Containers with Subgrid

CSS Subgrid allows a grid item to inherit the track definitions (rows or columns) of its parent grid. This is the recommended approach for forms where label-input pairs are wrapped in container elements—such as `<div>` or `<li>`—for semantic grouping or styling. Using subgrid ensures that all labels across different containers align to the same column width, determined by the longest label in the entire form, without requiring you to flatten your HTML structure.

## How to implement

### Define the Parent Grid Tracks
The parent element (the form or fieldset) must be a grid container that defines the columns for the entire layout. This establishes the "master" tracks that nested containers will eventually follow.

```css
.form-parent {
  display: grid;
  /* 
     The first column sizes to the widest label (max-content).
     The second column takes up the remaining space.
  */
  grid-template-columns: max-content 1fr;
  gap: 1rem;
}
```

### Span Containers Across Columns
MANDATORY: Any nested container that intends to use subgrid must span the columns of the parent grid that it needs to inherit. If a container only occupies one column of the parent, there are no tracks for the children to "subgrid" into.

```css
.form-row {
  /* 
     MANDATORY: This container must span all columns of the parent grid 
     to provide the full track context to its children (label and input).
  */
  grid-column: 1 / -1;
}
```

### Inherit Parent Tracks with Subgrid
Apply `display: grid` to the row container and set `grid-template-columns` to `subgrid`. This tells the browser to use the column definitions from `.form-parent` instead of creating a new, independent grid.

```css
.form-row {
  display: grid;
  /* 
     Use the parent's grid tracks for this container's children.
     The label will automatically snap to the first column (max-content)
     and the input will snap to the second column (1fr).
  */
  grid-template-columns: subgrid;
  align-items: center;
}
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

When subgrid is not supported, the nested elements (label and input) will not be aware of the parent's track sizing. This usually results in labels only taking up as much space as their own text requires within each individual row, causing the input fields to be misaligned vertically.

To provide a graceful fallback, use a feature query to apply a fixed-width or flex-based layout for older browsers.

```css
/* Fallback for browsers that do not support subgrid */
.form-row {
  display: flex;
  gap: 1rem;
}

.form-row label {
  /* 
     Provide a consistent width so that fields align reasonably well.
     This value should be tuned to fit the expected length of your labels.
  */
  flex: 0 0 150px;
}

/* Enhancement: Only apply subgrid if supported */
@supports (grid-template-columns: subgrid) {
  .form-row {
    display: grid;
    grid-template-columns: subgrid;
  }

  .form-row label {
    /* Reset the fallback width to let subgrid take over */
    flex: none;
    width: auto;
  }
}