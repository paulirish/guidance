I will read the research file for `abortsignal-timeout` to ensure the assertions are technically accurate and follow the expected patterns for this feature.
## Must pass
- The implementation must utilize `AbortSignal.timeout()` to generate a signal for the event listener's lifecycle.
- The event listener must be registered using the `signal` property in the `addEventListener` options object.
- The event listener must be automatically deactivated and stop responding to events after the specified timeout duration has elapsed.

## Must fail
- The implementation must not rely on manual cleanup logic using `setTimeout` to call `removeEventListener`.
- The implementation must not manually instantiate an `AbortController` paired with a `setTimeout` to trigger the abort signal.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.