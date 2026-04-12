## Must pass
- Related `<details>` elements are grouped using identical `name` attribute values.
- Opening a `<details>` element automatically closes any other `<details>` element sharing the same `name` attribute in the same document.
- Only one `<details>` element in a named group possesses the `open` attribute at any given time after an interaction.

## Must fail
- The implementation relies on JavaScript event listeners to manually toggle the `open` attribute for mutual exclusivity.
- Multiple `<details>` elements with the same `name` attribute can be in the `open` state simultaneously.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.