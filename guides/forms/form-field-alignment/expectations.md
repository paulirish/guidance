## Must pass
- The parent container must establish a grid layout defining at least two column tracks.
- Container elements wrapping label-input pairs must use `grid-template-columns: subgrid` to align their children with the parent grid tracks.
- Labels and input fields must be placed into distinct grid columns to ensure vertical alignment across different rows.
- The alignment of form elements must be driven by the shared grid tracks rather than manual width adjustments on individual items.

## Must fail
- Labels are aligned using fixed or absolute widths (e.g., `width: 200px`) to force consistency across rows.
- Wrapper containers for each row define their own independent `grid-template-columns` instead of inheriting the parent's tracks.
- Flexbox is used for row alignment, which fails to synchronize column widths across separate container elements without hardcoded values.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.