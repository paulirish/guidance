## Must pass
- The implementation uses `Promise.withResolvers()` to initialize a promise along with its resolve and reject functions.
- The `promise` returned by `Promise.withResolvers()` is returned or awaited by the asynchronous operation.
- The `resolve` or `reject` callback is invoked in response to an external signal, such as an event listener or a callback from an external API.
- The asynchronous operation remains in a pending state until the external trigger occurs.

## Must fail
- The implementation uses the `new Promise((resolve, reject) => { ... })` constructor to manually extract the resolve and reject functions to an outer scope.
- The implementation uses periodic polling with `setInterval` or `setTimeout` to check for the completion of the external signal.
- The implementation uses a manual state machine or flags to track completion without leveraging the promise lifecycle.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.