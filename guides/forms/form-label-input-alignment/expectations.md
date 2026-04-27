## Must pass
- The parent container must establish a grid context with defined column tracks.
- Structural row wrappers must use `grid-template-columns: subgrid` to align their children with the parent grid.
- Labels and input fields must maintain consistent vertical alignment across different rows even when nested in separate containers.
- The layout must dynamically adjust the label column width to accommodate the longest label across all synchronized rows.

## Must fail
- Achieving alignment by applying fixed `width` or `min-width` properties to label elements across rows.
- Using `display: flex` on row wrappers, which fails to synchronize column widths between independent containers.
- Manually duplicating the grid track definitions in every row wrapper rather than using the subgrid inheritance mechanism.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.