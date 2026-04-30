## Must pass
- The implementation uses the `@media (scripting: none)` or `@media (scripting: enabled)` media queries to manage component visibility.
- Static fallback content is visible to the user when JavaScript is disabled in the browser.
- Interactive components are progressively enhanced or revealed only when the browser reports scripting is enabled.

## Must fail
- The implementation relies on a manual JavaScript execution to add a `.js` or `.no-js` class to the `<html>` or `<body>` tag for conditional styling.
- The implementation uses `<noscript>` tags for styling or layout logic that is natively possible with the `scripting` media query.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.