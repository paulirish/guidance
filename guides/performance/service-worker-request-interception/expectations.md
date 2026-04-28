## Must pass
- The service worker registers a `fetch` event listener that uses the `URLPattern` API to identify specific requests.
- A `URLPattern` instance is created to define the matching criteria for target URL structures.
- The `URLPattern.test()` or `URLPattern.exec()` method is used within the `fetch` handler to evaluate `event.request.url`.
- Intercepted requests matching the pattern are handled using `event.respondWith()` to provide a specific response (e.g., from cache or generated dynamically).
- The implementation leverages `URLPattern` syntax, such as named groups or wildcards, to match dynamic segments of the URL.

## Must fail
- The implementation uses `RegExp` objects or manual string parsing (e.g., `startsWith`, `split`, or `indexOf`) to match and route structured URLs instead of the `URLPattern` API.
- The logic relies on brittle manual extraction of URL parameters from the request URL string.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.