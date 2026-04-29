## Must pass
- The component root or specific CSS properties use the `revert` keyword to bypass author-defined styles.
- Computed styles for properties targeted by `revert` match the browser's User Agent (UA) stylesheet defaults rather than the global framework's styles.
- Global CSS rules targeting high-level elements (like `div` or `span`) do not influence the rendering of the isolated component's properties when `revert` is applied.

## Must fail
- The implementation uses `all: initial`, which resets properties to the CSS specification's default values (e.g., causing a `div` to become `display: inline`) instead of the browser's native defaults.
- The implementation uses `all: unset`, which fails to isolate the component from inherited global styles.
- The implementation relies on manual, hard-coded property overrides (e.g., `margin: 0; padding: 0;`) to simulate a reset rather than using the native `revert` value.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.