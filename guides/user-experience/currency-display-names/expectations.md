## Must pass
- Uses the `Intl.DisplayNames` constructor with the `type` option set to `'currency'`.
- Correctly resolves full localized currency names (e.g., "US Dollar" for "USD") based on the active or provided locale.
- Demonstrates dynamic localization by producing different results for the same currency code when the locale is changed (e.g., "euro" for "EUR" in English vs "euro" in French, or "US-Dollar" in German).

## Must fail
- Uses a hardcoded lookup object or local JSON file to map currency codes to their human-readable names.
- Employs `Intl.NumberFormat` combined with string or regex manipulation to extract a currency name from a formatted currency string.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.