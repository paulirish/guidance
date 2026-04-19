I will read the research document to understand the feature and common anti-patterns.

## Must pass
- The implementation uses `AbortSignal.timeout()` to generate the signal passed to the network request's configuration.
- The network request is automatically aborted when the specified millisecond threshold is reached.
- The error caught during a timeout is specifically a `TimeoutError` DOMException.

## Must fail
- The implementation manually instantiates an `AbortController` and uses a separate `setTimeout` call to trigger `controller.abort()`.
- The implementation requires manual cleanup (e.g., `clearTimeout`) to prevent the abort signal from firing after a successful network response.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.