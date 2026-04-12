## Must pass
- Multiple `<details>` elements are used to group related form inputs.
- All `<details>` elements in the form group share the same `name` attribute value.
- Opening any `<details>` element in the group automatically closes the currently open one, ensuring only one set of inputs is visible at a time.
- The UI relies on the native `name` attribute on the `<details>` tag to enforce mutual exclusivity.

## Must fail
- The implementation uses JavaScript to watch for toggle events and programmatically close other sections.
- Multiple sections of the form are allowed to remain open simultaneously despite being part of the same logical group.
- The `name` attribute is missing or applied to an incorrect element (like a parent `<div>` or child `<summary>`).

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.