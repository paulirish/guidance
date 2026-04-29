## Must pass
- Reverting a custom style restores the property to the value defined in the User Agent or User stylesheet.
- User-defined accessibility overrides (e.g., high-contrast mode colors) are preserved after the custom styling is undone.
- The computed value of the property after undoing custom styles reflects the cascade level immediately preceding the author level.

## Must fail
- Using the `initial` keyword to undo custom styles, which ignores User Agent and User-defined accessibility settings.
- Hardcoding specific "default" values (e.g., `color: black`) when undoing styles, as this overrides accessibility-related system preferences.
- Using a manual reset that sets properties to a fixed state instead of allowing the cascade to determine the appropriate previous value.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.