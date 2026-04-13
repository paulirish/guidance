---
name: calendar-date-field-display-names
description: Display localized names for calendar systems and date/time fields.
web-feature-ids:
  - intl-display-names
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames
---

# Localize Calendar Systems and Date/Time Field Labels

`Intl.DisplayNames` provides a native, high-performance way to retrieve localized strings for specific data categories like calendar systems and date/time fields. By leveraging the browser's built-in internationalization data, you can provide accurate UI labels without bundling large translation dictionaries or manually maintaining mapping files for every supported language.

## How to implement

### Initialize the DisplayNames instance
To retrieve localized labels, instantiate `Intl.DisplayNames` with a locale and a configuration object. The `type` property is required to define which category of names you are accessing.

```javascript
// Use a specific BCP 47 language tag or undefined for the user's default
const locale = 'fr-FR'; 

const calendarFormatter = new Intl.DisplayNames([locale], { 
  type: 'calendar', // MANDATORY: Specifies we want calendar system names
  style: 'long'     // Options: 'long' (default), 'short', 'narrow'
});

const fieldFormatter = new Intl.DisplayNames([locale], { 
  type: 'dateTimeField', // MANDATORY: Specifies we want date/time part labels
  style: 'short'         // 'short' is often preferred for dense UI layouts
});
```

### Map identifiers to localized strings
Once initialized, use the `of()` method to convert a standard identifier into a localized string.

```javascript
// Localizing Calendar Systems
// Common IDs: 'gregory', 'chinese', 'islamic', 'hebrew', 'japanese'
const calendarName = calendarFormatter.of('gregory'); 
// Result: "calendrier grégorien" (for fr-FR)

// Localizing Date/Time Fields
// Valid keys: 'era', 'year', 'quarter', 'month', 'weekOfYear', 'weekday', 
// 'day', 'dayPeriod', 'hour', 'minute', 'second', 'timeZoneName'
const monthLabel = fieldFormatter.of('month');
// Result: "mois" (for fr-FR)

const hourLabel = fieldFormatter.of('hour');
// Result: "h" (for fr-FR with style: 'short')

// Localizing Region and Language Names
const regionFormatter = new Intl.DisplayNames([locale], { type: 'region' });
const regionName = regionFormatter.of('US');
// Result: "États-Unis" (for fr-FR)

const languageFormatter = new Intl.DisplayNames([locale], { type: 'language' });
const languageName = languageFormatter.of('en');
// Result: "anglais" (for fr-FR)
```

### Handle unexpected identifiers
The `fallback` option in the constructor determines behavior when a translation is missing.

```javascript
const safeFormatter = new Intl.DisplayNames(['en'], {
  type: 'calendar',
  fallback: 'code' // <!-- Returns the input ID if no translation is found -->
});

// If 'unknown-cal' isn't found, it returns 'unknown-cal' instead of throwing
console.log(safeFormatter.of('unknown-cal'));
```

## Fallback strategies

{{ BASELINE_STATUS("intl-display-names") }}

While `Intl.DisplayNames` is widely supported in modern browsers, applications targeting older environments must detect support and provide a manual fallback to prevent UI breakage.

### Feature detection and manual mapping
Check for `DisplayNames` in the global `Intl` object. If missing, use a simplified mapping object for your primary supported languages.

```javascript
export function getFieldLabel(fieldKey, locale = 'en') {
  // Always check for the API on the Intl object
  if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
    try {
      const formatter = new Intl.DisplayNames([locale], { type: 'dateTimeField' });
      return formatter.of(fieldKey);
    } catch (e) {
      // Fall through if initialization or lookup fails
    }
  }

  // DO NOT leave the UI empty; provide a static fallback for critical fields
  const fallbacks = {
    en: { year: 'Year', month: 'Month', day: 'Day' },
    fr: { year: 'Année', month: 'Mois', day: 'Jour' }
  };

  const lang = fallbacks[locale] ? locale : 'en';
  return fallbacks[lang][fieldKey] || fieldKey; // Return the key itself as a last resort
}
```

### Graceful degradation
If the API is unavailable, the application should degrade gracefully by:
1.  **Using Hardcoded Defaults**: Provide English or base-language strings for the most common fields (Year, Month, Day).
2.  **Displaying Raw Keys**: In developer-facing tools or settings, showing the raw identifier (e.g., "gregory") is a functional, if unpolished, fallback.
3.  **Conditional Polyfills**: If full support is required, conditionally load a polyfill (like `@formatjs/intl-displaynames`) using dynamic imports only for browsers where `Intl.DisplayNames` is undefined.

```javascript
// Example of conditional polyfill loading
export async function initializeLocalization() {
  if (typeof Intl === 'undefined' || !('DisplayNames' in Intl)) {
    await import('@formatjs/intl-displaynames/polyfill');
    await import('@formatjs/intl-displaynames/locale-data/en');
  }
}
```