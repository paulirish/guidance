## Must pass
- The implementation must utilize `Promise.withResolvers()` to generate promises and their corresponding settlement functions.
- The implementation must maintain a collection (e.g., an array, object, or Map) to track multiple active asynchronous tasks.
- Tasks in the collection must be settled by calling the `resolve` or `reject` functions from an external context, such as a callback or an event listener.
- The solution must demonstrate that multiple tasks can be handled concurrently and settled independently.

## Must fail
- The implementation manually extracts the `resolve` and `reject` functions from a `new Promise()` constructor into a higher scope.
- The implementation relies on a custom-built "Deferred" class or object that wraps `new Promise()` instead of using the native `Promise.withResolvers()` method.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.