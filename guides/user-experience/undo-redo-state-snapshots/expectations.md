## Must pass
- The application state history consists of deep copies, ensuring that modifying a property in the current state does not mutate the same property in past snapshots.
- Snapshots preserve complex built-in types such as `Date`, `Map`, `Set`, and `ArrayBuffer` without manual serialization.
- The implementation handles circular references within the state object without throwing errors during the snapshot process.

## Must fail
- The implementation uses `JSON.parse(JSON.stringify())` for deep cloning, resulting in the loss of non-serializable types like `Date`, `Map`, or `Set`.
- The implementation uses shallow cloning methods (such as the spread operator or `Object.assign()`) for nested state structures, leading to mutations in the history when the current state changes.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.