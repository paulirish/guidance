I will read the research file for `AbortSignal.timeout()` to understand the modern implementation patterns and common legacy alternatives.
## Must pass
- The implementation uses `AbortSignal.timeout()` to define the maximum time limit for the operation.
- The implementation uses `AbortSignal.any()` to combine the timeout signal with a user-initiated abort signal.
- The targeted asynchronous operation (e.g., a fetch request or stream) is successfully aborted when the specified time limit is reached.
- The targeted asynchronous operation is successfully aborted when the user-initiated signal is triggered before the timeout expires.

## Must fail
- The implementation uses a manual `setTimeout` call to programmatically invoke `abort()` on an `AbortController`.
- The implementation uses separate logic or multiple controllers to handle timeout and user-abort instead of leveraging `AbortSignal.any()`.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.