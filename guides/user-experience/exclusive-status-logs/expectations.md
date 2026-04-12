## Must pass
- Multiple `<details>` elements are present, each containing a distinct status or log stream.
- All `<details>` elements in the group share an identical, non-empty `name` attribute to enable mutual exclusivity.
- Opening one `<details>` element in the named group automatically closes any other open `<details>` element with the same `name` attribute.

## Must fail
- The mutual exclusivity of the status streams is achieved natively by the browser without the use of JavaScript event listeners to toggle the `open` attribute.
- The implementation uses the semantic `<details>` element instead of a legacy `div`-based accordion pattern or custom state management.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.