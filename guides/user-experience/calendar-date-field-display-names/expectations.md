## Must pass
- The implementation must use `Intl.DisplayNames` to retrieve localized names for calendar systems and date/time fields.
- The `Intl.DisplayNames` constructor must be called with `type: 'calendar'` to resolve calendar system names (e.g., "gregory", "islamic", "hebrew").
- The `Intl.DisplayNames` constructor must be called with `type: 'dateTimeField'` to resolve field names (e.g., "era", "year", "month", "day", "weekday").
- The `Intl.DisplayNames` constructor must be called with `type: 'region'` to resolve region names.
- The `Intl.DisplayNames` constructor must be called with `type: 'language'` to resolve language names.
- The output names must be dynamic based on the locale provided to the `Intl.DisplayNames` instance.

## Must fail
- The implementation must not use hardcoded objects, switch statements, or external JSON translation files to map internal identifiers (like "gregory" or "month") to their localized display strings.
- The implementation must not attempt to extract localized field names by parsing or regex-matching the output of `Intl.DateTimeFormat.prototype.formatToParts`.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.