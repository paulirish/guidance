## Must pass
- Verify that modifying nested properties in the cloned object has no effect on the original object's state.
- Verify that the clone maintains the correct types for non-POJO (Plain Old JavaScript Object) values like `Date`, `Map`, or `Set`.
- Verify that the cloning process correctly handles circular references within the input data structure.

## Must fail
- Fail if a shallow copy mechanism is employed, causing shared references for nested objects.
- Fail if `JSON.parse(JSON.stringify())` is used, leading to type degradation or data loss for non-JSON compatible values.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.