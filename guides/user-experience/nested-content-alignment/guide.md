---
name: nested-content-alignment
description: Align elements inside a nested component with the grid tracks of a parent page layout to maintain a unified visual structure.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Aligning nested components with parent grid tracks using Subgrid

Subgrid allows a grid item that is itself a grid container to inherit the track definitions (columns, rows, or both) of its parent. This is the recommended approach for maintaining visual alignment across deeply nested components, ensuring that internal elements—such as headers, labels, or buttons—line up perfectly with a global page grid without manual coordinate calculations.

## How to implement

### Define the parent grid
The parent container establishes the master grid tracks. These tracks are what nested components will eventually "adopt" to ensure structural unity.

```css
.parent-grid {
  display: grid;
  /* Define the main tracks that children should align to */
  grid-template-columns: 100px 1fr 100px;
  gap: 1rem;
}
```

### Enable subgrid on the nested component
The nested component must be a direct child of the parent grid. To inherit the tracks, set its `display` to `grid` and use the `subgrid` keyword for the `grid-template-columns` and/or `grid-template-rows` properties.

```css
.nested-component {
  /* MANDATORY: The component must span the tracks it intends to inherit from the parent */
  grid-column: 1 / 4; 

  display: grid;
  /* Inherit columns from the .parent-grid */
  grid-template-columns: subgrid;
  
  /* Rows can remain independent (auto) or also use subgrid */
  grid-template-rows: auto;
}
```

### Position internal elements
Elements inside the nested component now align directly to the parent's grid tracks. They use the track numbers relative to the subgrid's own start line.

```html
<div class="parent-grid">
  <div class="nested-component">
    <!-- This header aligns with the parent's first 100px column -->
    <header style="grid-column: 1;">Side</header>
    <!-- This div aligns with the parent's flexible middle column -->
    <div style="grid-column: 2;">Main Content</div>
  </div>
</div>
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

When subgrid is not supported, the nested component will treat `subgrid` as an invalid value and will not inherit any tracks, often causing the layout to collapse or ignore internal alignment.

1. **Manual Grid Replication**: For a robust fallback, manually define the same `grid-template-columns` and `gap` on the nested component that the parent uses. This "hardcodes" the alignment.
2. **Feature Queries**: Wrap the subgrid implementation in an `@supports` block to ensure that only browsers supporting the feature attempt to use it.
3. **Implicit Grid**: Allow internal elements to stack vertically or use a simple 1-column grid as the base experience for older browsers.

```css
/* Base implementation: Mirror the parent's grid manually */
.nested-component {
  display: grid;
  grid-template-columns: 100px 1fr 100px;
  gap: 1rem;
}

/* Progressive enhancement: Use subgrid where supported */
@supports (grid-template-columns: subgrid) {
  .nested-component {
    /* Overwrite the manual tracks with inherited tracks */
    grid-template-columns: subgrid;
  }
}