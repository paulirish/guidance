## Must pass
- Nested elements must use `grid-template-columns: subgrid` or `grid-template-rows: subgrid` to inherit track definitions from their parent grid container.
- Nested grid items must align precisely with the grid lines defined in the ancestor grid, maintaining consistency across multiple levels of nesting.
- Changes to the parent grid's track sizes (e.g., column widths) must be automatically reflected in the layout of nested subgrid elements without manual recalculation.

## Must fail
- Implementations that use `display: contents` on nested containers to achieve alignment by flattening the DOM tree instead of inheriting tracks.
- Implementations that rely on manual `calc()` expressions or percentage-based widths on nested elements to simulate alignment with a global grid.
- Use of hardcoded negative margins or absolute positioning to force nested elements to span across parent grid lines.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.