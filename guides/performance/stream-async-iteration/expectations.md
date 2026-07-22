## Must pass
- The implementation must utilize `Promise.withResolvers()` to manage the resolution of promises within an async generator or iterable.
- Data from the event stream must be yielded by the async iterable in the exact order it was emitted.
- The async iterable must correctly handle stream termination by closing the generator and cleaning up event listeners.
- The solution must avoid race conditions by ensuring that each `withResolvers` instance is handled before the next event is processed.

## Must fail
- The implementation manually defines `resolve` and `reject` variables outside of a `new Promise` constructor to capture them later (the legacy deferred pattern).
- The implementation uses a standard `new Promise` constructor where logic is tightly coupled within the executor, making it difficult to bridge the event-based API.
- The implementation fails to queue events, leading to missed data if multiple events occur before the async iterable's next call is resolved.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.