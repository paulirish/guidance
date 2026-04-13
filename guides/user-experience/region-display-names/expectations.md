## Must pass
- The implementation must utilize the `Intl.DisplayNames` API with the `type` option set to `'region'`.
- The application must correctly display localized names for geographic regions based on the current or requested locale (e.g., 'US' resolving to 'United States' in English and 'États-Unis' in French).
- The solution must dynamically handle various ISO region codes rather than being limited to a hardcoded subset.

## Must fail
- The implementation must not use a static mapping object, switch statement, or custom JSON dictionary to store and retrieve region names.
- The application should not bundle or fetch external translation files for standard country names that are natively supported by the `Intl` API.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.