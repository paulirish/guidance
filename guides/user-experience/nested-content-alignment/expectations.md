## Must pass
- The nested component defines its grid columns or rows using the `subgrid` keyword.
- The nested component is a child of a grid container and is itself configured as a grid container.
- Child elements of the nested component are positioned according to the parent's grid tracks.

## Must fail
- The nested component defines an independent grid with explicit track sizes that replicate the parent's layout.
- The nested component uses `display: block` or `display: flex`, which prevents alignment with the parent's specific grid tracks.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.