## Must pass
- CSS uses the `@media (scripting: enabled)` media query to hide or placeholder elements that require JavaScript initialization, preventing visual flickering during page load.
- Elements that rely on script-driven animations maintain a stable layout by reserving necessary space using styles applied via the `scripting` media query.
- The implementation provides a visible and functional state for users in environments where `scripting: none` is active.

## Must fail
- The implementation relies on manually adding or removing a `.js` or `.no-js` class on the `<html>` or `<body>` element via inline scripts to manage initial visibility.
- Script-dependent elements are visible in their uninitialized state before the script executes, causing a visible Flash of Unstyled Content (FOUC) or layout jump.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.