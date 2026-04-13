---
name: currency-display-names
description: Display localized, human-readable names for currencies.
web-feature-ids:
  - intl-display-names
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames
---

# Localizing currency names with Intl.DisplayNames

The `Intl.DisplayNames` API provides a native, high-performance way to convert ISO 4217 currency codes (like "USD", "EUR", "JPY") into localized, human-readable strings. By using this built-in browser capability, you can avoid shipping large translation dictionaries to the client, ensuring your application remains lightweight while providing accurate currency names that respect the user's preferred language and regional settings.

## How to implement

### Initialize the formatter
To display currency names, you must create an instance of `Intl.DisplayNames` with the `type` property set to `'currency'`. This instance should be reused for multiple lookups to optimize performance.

```javascript
// Initialize the formatter for a specific locale (e.g., British English)
const currencyNames = new Intl.DisplayNames(['en-GB'], {
  type: 'currency', // MANDATORY: This tells the API to resolve currency codes specifically
  style: 'long'     // Choose 'long' for full names (e.g., "US Dollar") or 'short' for abbreviations
});
```

### Retrieve localized names
Use the `.of()` method to pass a three-letter ISO 4217 currency code. The API will return the localized name based on the locale provided during initialization.

```javascript
// Get the localized name for the Japanese Yen
const jpyName = currencyNames.of('JPY'); // Returns "Japanese Yen" in 'en-GB'

// Get the localized name for the Euro
const eurName = currencyNames.of('EUR'); // Returns "Euro"
```

### Handle different display styles
The `style` option determines the verbosity of the output. 

*   `long`: (Default) Returns the full name, such as "US Dollar".
*   `short`: Returns a shorter version, often identical to the ISO code (e.g., "USD").
*   `narrow`: Returns the most compact representation available, which may be a symbol (e.g., "$").

```javascript
const narrowFormatter = new Intl.DisplayNames(['en-US'], {
  type: 'currency',
  style: 'narrow' // Use 'narrow' when space is limited and a symbol is preferred over a name
});

console.log(narrowFormatter.of('USD')); // "$"
```

## Fallback strategies

{{ BASELINE_STATUS("intl-display-names") }}

### Feature detection and graceful degradation
If `Intl.DisplayNames` is not available, the application should gracefully fall back to displaying the raw ISO currency code. This ensures that users on older browsers can still identify the currency, even if the label is not fully localized.

```javascript
function getLocalizedCurrency(code, locale = 'en-US') {
  // Check for the existence of Intl.DisplayNames in the global scope
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    try {
      const formatter = new Intl.DisplayNames(locale, { type: 'currency' });
      return formatter.of(code);
    } catch (error) {
      // Fallback to the code if the specific code or locale causes an error
      return code;
    }
  }
  
  // Return the original code as the base experience for unsupported browsers
  return code;
}
```

### Conditional polyfilling
If your application requires consistent localization across all browsers, you can conditionally load a polyfill. Only load the polyfill if the feature is missing to avoid unnecessary network payload for modern browsers.

```javascript
if (!Intl.DisplayNames) {
  // Dynamically load a polyfill if the native API is missing
  // This approach prevents modern users from downloading redundant code
  import('path-to-intl-displaynames-polyfill').then(() => {
    console.log('Polyfill loaded');
  });
}