## Must pass
- Grid container defines a multi-track layout (rows or columns) intended for card sections.
- Card components are grid items and use `display: grid`.
- Card components use `grid-template-rows: subgrid` or `grid-template-columns: subgrid` to inherit the parent's track definitions.
- Internal sections (e.g., header, body, footer) within different cards align perfectly across the horizontal or vertical axis regardless of varying content length.
- The height or width of a track in one card dynamically adjusts the corresponding track in all other cards via the parent grid.

## Must fail
- Alignment is achieved using fixed `height`, `min-height`, or magic numbers on internal card elements.
- Card components define independent `grid-template-rows` or `grid-template-columns` instead of delegating track sizing to the parent.
- Layout relies on Flexbox or nested grids without the `subgrid` keyword, preventing true track synchronization across sibling components.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.