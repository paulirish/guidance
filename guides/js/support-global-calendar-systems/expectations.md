* The implementation feature-detects Temporal and assigns the loaded polyfill to `globalThis.Temporal`.
* The implementation conditionally loads a Temporal polyfill only if native support is absent.
* The implementation verifies target calendar support using `Intl.supportedValuesOf('calendar')`.
* The implementation uses `withCalendar()` to associate non-ISO calendar systems.
* The implementation uses `monthCode` instead of numeric month for lunisolar calendars.
* The implementation uses `monthsInYear` as the upper bound when iterating through months.
* The implementation uses `toLocaleString()` specifying the calendar in locale or options.
* The implementation uses `Temporal.PlainDate.compare()` to compare dates.
* The implementation uses `daysInMonth` when checking month invariants or doing day iterations.
* The implementation uses `Temporal` instead of the legacy `Date` object for non-Gregorian calculations.
* The implementation accounts for era names in systems relying on eras.