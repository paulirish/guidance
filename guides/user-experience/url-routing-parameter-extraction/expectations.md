## Must pass
- The implementation must utilize the `URLPattern` constructor to define route templates.
- The implementation must extract named dynamic parameters using the `groups` property of the object returned by `URLPattern.prototype.exec()`.
- The implementation must successfully match and route requests based on both URL pathname and search parameters when defined in the pattern.
- The router must correctly identify and handle base URLs when matching relative navigation requests.

## Must fail
- The implementation must not use manual `RegExp` objects to parse URLs or extract route parameters.
- The implementation must not use `String.prototype.split()` or `String.prototype.substring()` as the primary mechanism for identifying dynamic segments in the URL path.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.