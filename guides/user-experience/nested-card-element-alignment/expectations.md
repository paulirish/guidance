## Must pass
- The parent container must be a grid container that defines the row tracks intended for the internal elements of the cards.
- Card components must use `grid-template-rows: subgrid` to align their internal structure with the parent grid's tracks.
- Internal elements like headers, bodies, and footers must be placed into consistent row tracks across all card instances.
- The height of corresponding internal elements must be identical across all cards in a row, determined by the tallest content in that specific track.
- Visual alignment of internal sections must be maintained even when content length varies significantly between cards.

## Must fail
- The implementation uses independent grid or flex layouts for each card without `subgrid`, resulting in misaligned internal elements when content varies.
- Alignment is achieved using "magic numbers," fixed `height`, or `min-height` values on internal card elements.
- The solution relies on JavaScript (e.g., ResizeObserver or manual height syncing) to maintain alignment across separate components.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.