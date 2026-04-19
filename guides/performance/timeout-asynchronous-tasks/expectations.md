I will read the research file to ensure the expectations align with the feature's specific details.
## Must pass
- The implementation utilizes `AbortSignal.timeout()` to create the cancellation signal for the specified time budget.
- The asynchronous task or its constituent operations (such as `fetch` or stream processing) receive and respect the `AbortSignal`.
- The application correctly identifies and handles the `TimeoutError` DOMException when the signal triggers an abort.

## Must fail
- The implementation uses a manual `setTimeout()` call to trigger `AbortController.abort()` instead of the native timeout API.
- The code implements a timeout using `Promise.race()` with a timer promise without propagating a cancellation signal to the underlying asynchronous operations.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.