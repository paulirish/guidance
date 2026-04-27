---
name: nested-content-layout-alignment
description: Align deeply nested elements with a global page grid to support complex layouts like full-bleed sections or consistent content columns.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Align Deeply Nested Elements with CSS Subgrid

Aligning nested components to a global page grid traditionally requires "flattening" the DOM or using complex CSS variables to synchronize track widths. CSS Subgrid solves this by allowing nested grid containers to inherit the track definitions of their parent, ensuring perfect alignment across different containers while maintaining semantic HTML structure. This approach is recommended because it avoids the fragility of manual calculations and allows nested elements to participate directly in the layout of a distant ancestor.

## How to implement

### Define the primary grid structure
Establish a global grid on a top-level container. This grid defines the columns and rows that nested elements will eventually reference for alignment.

```css
.page-grid {
  display: grid;
  /* Define a central content area with flexible margins */
  grid-template-columns: 
    [full-start] minmax(1rem, 1fr) 
    [content-start] repeat(8, minmax(0, 120px)) [content-end] 
    minmax(1rem, 1fr) [full-end];
  gap: 24px;
}
```

### Inherit grid tracks with subgrid
For a nested element to align with the global grid, its immediate parent must be a grid item that spans the relevant tracks and uses the `subgrid` keyword in its track definition.

```css
.card-wrapper {
  /* MANDATORY: The container must span the parent tracks it wants to inherit */
  grid-column: content-start / content-end;
  
  display: grid;
  /* Inherit column definitions from .page-grid */
  grid-template-columns: subgrid;
  /* Rows remain independent unless subgrid is also applied to grid-template-rows */
}
```

### Align nested children to the global tracks
Once `subgrid` is enabled, the children of the subgrid container are placed using the track indices or names of the inherited parent grid.

```css
.card-content {
  /* This element aligns to the first 4 columns of the 8-column content area */
  grid-column: 1 / 5;
}

.card-full-bleed-media {
  /* MANDATORY: To span the entire width of the parent, use 1 / -1.
     This works because the subgrid inherits the parent's track indices. */
  grid-column: 1 / -1;
  width: 100%;
}
```

### Handle gaps and nesting
By default, subgrids inherit the `gap` of the parent grid. You can override this on the subgrid container if the nested layout requires different spacing while maintaining track alignment.

```css
.tight-nested-grid {
  display: grid;
  grid-template-columns: subgrid;
  /* Overriding the gap will shift child alignment relative to parent tracks */
  gap: 8px; 
}
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

When `subgrid` is not supported, nested grid containers default to an independent grid context. This causes nested elements to align only with their immediate parent rather than the global page grid, often resulting in "broken" vertical alignment across different sections.

### Feature detection with @supports
Use `@supports` to provide a functional, independent grid layout for browsers that lack subgrid support.

```css
.card-wrapper {
  display: grid;
  /* Fallback: Define an independent grid that approximates the global structure */
  grid-template-columns: repeat(8, 1fr);
}

@supports (grid-template-columns: subgrid) {
  .card-wrapper {
    /* Use the precise global tracks when subgrid is available */
    grid-template-columns: subgrid;
  }
}
```

### Alternative: display: contents
If the intermediate container (the one that would be the subgrid) does not require its own styling (like backgrounds, borders, or padding), you can use `display: contents`. This effectively removes the container from the box model, making its children direct children of the global grid.

- **DO** use `display: contents` for simple wrappers to achieve perfect alignment in all grid-supporting browsers.
- **DO NOT** use `display: contents` if the wrapper needs to be styled, as those styles will not be rendered.

### Graceful degradation
If precise alignment is not critical for the mobile or legacy experience, allow nested grids to use `grid-template-columns: 100%` or `auto`. This ensures the content remains accessible and readable, even if the "column-perfect" aesthetic is lost.