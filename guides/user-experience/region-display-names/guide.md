---
name: region-display-names
description: Display localized names for geographic regions or countries in forms and selectors.
web-feature-ids:
  - intl-display-names
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames
---

# Display localized geographic names with Intl.DisplayNames

`Intl.DisplayNames` provides a native mechanism to translate ISO country and region codes (e.g., "US", "JP") into full localized names (e.g., "United States", "Japon"). By using the browser's built-in localization data, you eliminate the need to ship massive translation dictionaries for geographic regions, reducing your application's bundle size and ensuring that names are consistent with the user's operating system and browser language settings.

## How to implement

### Initialize the region formatter
To localize geographic regions, you must create an instance of `Intl.DisplayNames` with the `type` set to `'region'`.

```javascript
// Initialize the formatter for a specific locale
const regionNames = new Intl.DisplayNames(['en'], {
  type: 'region', // MANDATORY: Must be 'region' to translate country/territory codes
  fallback: 'code' // Optional: Returns the input code (e.g., "US") if a translation is missing
});

// usage
console.log(regionNames.of('US')); // "United States"
```

### Populate localized selectors
When building a country picker or region selector, iterate over your list of ISO 3166-1 alpha-2 codes and use the `.of()` method to generate the display text for each option.

```javascript
const countryCodes = ['CN', 'BR', 'DE', 'FR'];
const userLocale = navigator.language; // Detect the user's browser language

const displayNames = new Intl.DisplayNames([userLocale], { type: 'region' });

const selectElement = document.getElementById('country-selector');

countryCodes.forEach(code => {
  const option = document.createElement('option');
  option.value = code;
  
  // MANDATORY: Use .of() to convert the code to a localized string
  // This lookup is case-sensitive and expects standard ISO codes
  option.textContent = displayNames.of(code);
  
  selectElement.appendChild(option);
});
```

### Handle dynamic locale changes
If your application allows users to change their language without a full page reload, ensure you re-instantiate the `Intl.DisplayNames` object with the new locale. The formatter is immutable once created.

```javascript
function updateCountryList(newLocale) {
  // Always create a new instance when the language preference changes
  const formatter = new Intl.DisplayNames([newLocale], { type: 'region' });
  
  document.querySelectorAll('#country-selector option').forEach(option => {
    // Re-format the original ISO code stored in the value attribute
    option.textContent = formatter.of(option.value);
  });
}
```

## Fallback strategies

{{ BASELINE_STATUS("intl-display-names") }}

### Feature detection and manual fallback
If `Intl.DisplayNames` is not supported, the most reliable fallback is to display the raw ISO codes or use a small, static mapping for the most common regions.

```javascript
/**
 * Safely localizes a region code with a manual fallback for older browsers
 */
function getLocalizedRegion(code, locale) {
  // Feature detection: Check if Intl.DisplayNames exists and supports regions
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code);
    } catch (e) {
      // Fallback if the constructor throws due to invalid locale or type
      return code;
    }
  }

  // Graceful degradation: Return the raw code so the UI remains functional
  // If specific regions are critical, a minimal hardcoded map can be used here
  const manualFallback = {
    'US': 'United States',
    'GB': 'United Kingdom'
  };
  
  return manualFallback[code] || code;
}
```

### Conditional polyfilling
If your application requires full localization support in older browsers, you can conditionally load a polyfill. Do not load polyfills unconditionally to avoid penalizing users on modern browsers.

```javascript
// Example of conditional loading for the Intl.DisplayNames polyfill
if (!('DisplayNames' in Intl)) {
  // Load the polyfill script and the specific locale data required
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@formatjs/intl-displaynames/polyfill.iife.js';
  document.head.appendChild(script);
}