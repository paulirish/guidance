---
name: card-section-alignment
description: Align internal sections like headers, body text, and footers across multiple card components to maintain a consistent horizontal rhythm.
web-feature-ids:
  - subgrid
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns.subgrid
  - https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows.subgrid
---

# Align card sections across components using Subgrid

When displaying content in a grid of cards, varying text lengths often cause internal sections—like headers, descriptions, and footers—to misalign horizontally. Subgrid solves this by allowing a child element to inherit the grid tracks of its parent, ensuring that headers align with headers and footers with footers across different cards, regardless of content volume.

## How to implement

### 1. Define the parent grid tracks
The container must be a CSS Grid. You must define the row tracks that the internal card sections will occupy. For a standard card with a header, body, and footer, you define three rows.

```css
.card-container {
  display: grid;
  /* Define the columns for the card layout */
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  /* MANDATORY: Define row tracks for the card's internal sections */
  /* This creates a pattern: header (auto), body (1fr), and footer (auto) */
  grid-template-rows: auto 1fr auto;
  gap: 20px;
}
```

### 2. Configure the card to use subgrid
For a card's internal elements to participate in the parent's grid, the card itself must span the exact number of rows intended for its sections and adopt the parent's grid definition.

```css
.card {
  /* MANDATORY: The card must span the number of rows it intends to subgrid */
  /* In this case, 3 rows: header, body, and footer */
  grid-row: span 3;

  /* MANDATORY: Elements using subgrid must be grid containers themselves */
  display: grid;

  /* MANDATORY: Use the 'subgrid' value to inherit the parent's row tracks */
  grid-template-rows: subgrid;
}
```

### 3. Layout internal elements
Once `grid-template-rows: subgrid` is applied, the direct children of the card are placed into the inherited rows of the parent grid. They will share the same track sizes as the children of adjacent cards.

```html
<div class="card-container">
  <article class="card">
    <!-- Occupies the 'auto' row track of the parent -->
    <header><h3>Consistent Header</h3></header>
    <!-- Occupies the '1fr' row track of the parent -->
    <div class="content"><p>Main body text...</p></div>
    <!-- Occupies the final 'auto' row track of the parent -->
    <footer><button>Action</button></footer>
  </article>
</div>
```

## Fallback strategies

{{ BASELINE_STATUS("subgrid") }}

If `subgrid` is not supported, the `grid-template-rows: subgrid` declaration is ignored. By default, the card's children will behave as standard grid items within the card's own local grid, or as block elements, causing them to lose horizontal alignment with other cards.

### Feature detection and Flexbox fallback
Use `@supports` to provide a functional Flexbox layout for unsupported browsers. This ensures the card remains usable and the footer stays at the bottom, even if the horizontal rhythm across cards is not maintained.

```css
/* Base styles: Flexbox fallback for horizontal layout within the card */
.card {
  display: flex;
  flex-direction: column;
}

.card .content {
  /* Push the footer to the bottom if the card is taller than its content */
  flex: 1;
}

/* Enhancement: Apply subgrid logic only when supported */
@supports (grid-template-rows: subgrid) {
  .card-container {
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .card {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
  }

  /* Reset flex properties that might interfere with grid placement */
  .card .content {
    flex: none;
  }
}