## Must pass
- Uses `Intl.DisplayNames` with the `type` option set to `'language'` to resolve language codes into localized names.
- Correctly displays the localized name of a language based on the user's current locale (e.g., "German" for 'de' when the UI locale is 'en').
- Correctly handles various language tags, including scripts and regions (e.g., 'zh-Hans', 'pt-BR').
- Updates the displayed language names dynamically when the application's locale changes.

## Must fail
- Hardcodes a lookup table or static JSON mapping (e.g., `{ "en": "English", "es": "Spanish" }`) to translate language codes.
- Relies on external third-party libraries for basic language name translations that are natively supported by `Intl.DisplayNames`.
- Uses manual string manipulation or regex to "guess" localized names from locale identifiers.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.