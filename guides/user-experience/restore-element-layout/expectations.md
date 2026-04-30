## Must pass
- The element is revealed by setting its `display` property to the `revert` keyword.
- The element's computed `display` value after revelation matches its intended layout (e.g., `block` for a `div`, `inline` for a `span`).
- The implementation restores the correct layout behavior without requiring the developer to know or store the element's specific display mode.

## Must fail
- The implementation reveals the element by explicitly setting `display` to a hardcoded value like `block` or `inline`.
- The implementation manually tracks and restores the previous `display` value using variables, data attributes, or state.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.