---
name: nested-card-element-alignment
description: Align internal elements like headers and footers across separate card components to maintain consistent row heights and visual rhythm.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Aligning internal elements across containers with Subgrid

CSS Subgrid allows a grid item to adopt the row or column tracks of its parent grid as its own. This is the standard solution for the "equal-height internal elements" problem, where components like cards in a gallery need their respective headers, content areas, and footers to align horizontally across the entire row, regardless of varying content lengths.

## How to implement

### Define the parent grid tracks
To align internal elements, the parent grid must provide the tracks that the child components will "snap" to. If a card has three internal sections (header, body, footer), the card itself must span three rows in the parent grid.

```css
.card-container {
  display: grid;
  /* Define a column layout for the cards */
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  /* 
     MANDATORY: The parent must have enough rows to accommodate the internal 
     elements of the children. Using auto ensures rows fit the largest content.
  */
  grid-auto-rows: auto;
  gap: 20px;
}
```

### Apply subgrid to the component
The component must be a grid item of the parent and also a grid container itself. By setting `grid-template-rows: subgrid`, the component stops calculating its own row heights and instead uses the tracks defined by the parent.

```css
.card {
  /* MANDATORY: The card must span the exact number of rows it intends to subgrid */
  grid-row: span 3;
  
  display: grid;
  /* 
     MANDATORY: This inherits the row definitions from the .card-container.
     The card's internal elements will now align to the parent's tracks.
  */
  grid-template-rows: subgrid;
  
  border: 1px solid #ccc;
  padding: 10px;
}
```

### Place internal elements
Each internal element must be explicitly or implicitly placed within the subgrid tracks. Because the card spans three rows, its children will naturally fill those three rows if they follow the document flow.

```html
<div class="card-container">
  <article class="card">
    <!-- This sits in the first inherited row -->
    <header><h3>Short Title</h3></header>
    <!-- This sits in the second inherited row -->
    <div class="content"><p>Description...</p></div>
    <!-- This sits in the third inherited row -->
    <footer>Action Button</footer>
  </article>
  
  <article class="card">
    <header><h3>Much Longer Title That Might Wrap to Multiple Lines</h3></header>
    <div class="content"><p>Description...</p></div>
    <footer>Action Button</footer>
  </article>
</div>
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

When subgrid is unsupported, child elements will revert to standard block flow or their own independent grid logic. This results in headers and footers that do not align across different cards if their content lengths differ.

### Feature detection and graceful degradation
Use `@supports` to detect subgrid. If unsupported, the most robust fallback is typically a standard grid or flexbox layout with `height: 100%`. While this ensures cards have equal total height, internal elements will not align perfectly across the row; this is an acceptable progressive enhancement.

```css
/* Fallback for browsers without subgrid */
.card {
  display: flex;
  flex-direction: column;
}

.card .content {
  /* Push the footer to the bottom */
  flex-grow: 1;
}

/* Enhancement for browsers supporting subgrid */
@supports (grid-template-rows: subgrid) {
  .card {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
  }
  
  .card .content {
    /* Reset the flex-grow used in the fallback */
    flex-grow: 0;
  }
}
```

### Avoid fixed heights
DO NOT attempt to polyfill subgrid by setting fixed pixel heights on headers or footers. This approach fails when users resize text or when content changes dynamically, leading to layout overflows or excessive empty space. Accept the lack of alignment as a graceful degradation for older browsers.