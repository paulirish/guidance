## Must pass
- The service worker must use `URLPattern` to declaratively specify paths that bypass the `fetch` event handler.
- Requests matching the defined `URLPattern` must be fetched by the browser without waking up or executing the service worker thread.
- The implementation must register these routing rules using the Service Worker Static Routing API (e.g., via `event.registerRouter`).
- Bypassed resources must load successfully from the network or browser cache as if no service worker were installed for those paths.

## Must fail
- The implementation must not perform path-based bypassing by checking `event.request.url` inside a `fetch` event listener.
- The solution must not rely on imperative `if` or `switch` logic within the service worker script to skip processing for specific URLs.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.