## Must pass
- Utilize the `URLPattern` API to define and match hostname structures for different tenants or environments.
- Extract named capture groups (e.g., `:tenant`, `:env`) from the hostname using the `exec()` method of a `URLPattern` instance.
- Correcty route or configure the application state based on the dynamic identifiers matched within the hostname pattern.

## Must fail
- Rely on manual `RegExp` objects to parse `window.location.hostname` or `location.href` for tenant or environment identification.
- Use fragile string manipulation like `split('.')`, `slice()`, or `substring()` on the hostname to extract identifiers.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.