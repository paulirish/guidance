## Must pass
- The audit snapshot must remain completely isolated from any destructive modifications applied to the original data.
- The cloning process must correctly handle nested objects and arrays without maintaining any shared references.
- Complex built-in types such as Date, Map, or Set must be preserved in the snapshot exactly as they appeared in the input.

## Must fail
- The implementation must not use `JSON.parse(JSON.stringify())`, which loses data types like Dates and fails on circular references.
- The implementation must not use shallow copying techniques (e.g., `Object.assign` or spread syntax) that leave nested objects vulnerable to mutation.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.