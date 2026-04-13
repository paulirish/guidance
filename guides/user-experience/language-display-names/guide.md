---
name: language-display-names
description: Display localized names for languages in user interfaces.
web-feature-ids:
  - intl-display-names
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames
---

# Localize language names in user interfaces

The `Intl.DisplayNames` API provides a standard, high-performance way to translate language codes (e.g., "en", "pt-BR") into localized, human-readable strings (e.g., "English", "Portuguese (Brazil)") using the browser's built-in locale data. This approach is recommended because it eliminates the need for large, manually maintained translation dictionaries in your application bundle, reducing load times and ensuring consistency with the user's operating system settings.

## How to implement

### Initialize the DisplayNames object
To localize names, you must first create an instance of `Intl.DisplayNames`. This object should be initialized with the locale you want the names to be displayed in (the "target" locale).

```javascript
// Define the locale for the UI (e.g., 'en' for English)
const uiLocale = 'en';

// MANDATORY: You must provide the 'type' option. For this use case, use 'language'.
// The first argument is a locale or an array of locales.
const languageNames = new Intl.DisplayNames([uiLocale], {
  type: 'language',
  // Optional: 'dialect' (default) shows names like "British English"
  // 'standard' would show names like "English (United Kingdom)"
  languageDisplay: 'dialect',
  // Optional: 'long' (default), 'short', or 'narrow'
  style: 'long'
});
```

### Format language codes
Once initialized, use the `.of()` method to retrieve the localized name for a specific BCP 47 language tag.

```javascript
// Get the localized name for French
// Returns "French" (when uiLocale is 'en')
const localizedName = languageNames.of('fr');

// Get the localized name for Traditional Chinese
// Returns "Traditional Chinese"
const zhName = languageNames.of('zh-Hant');

// MANDATORY: The input to .of() must be a valid BCP 47 language tag.
// If a code is valid but the API doesn't have a name for it, it returns the code itself
// unless the 'fallback' option was set to 'none' during initialization.
```

### Choose a display style
The `style` option controls the verbosity of the output. Choose the style that best fits your UI constraints (e.g., a sidebar versus a compact dropdown).

```javascript
// 'long' (default): Returns "English (United States)"
const longFormatter = new Intl.DisplayNames(['en'], { type: 'language', style: 'long' });

// 'short': Might return "US English" (exact string depends on browser data)
const shortFormatter = new Intl.DisplayNames(['en'], { type: 'language', style: 'short' });

// 'narrow': Returns "English" (most compact, may be ambiguous in some locales)
const narrowFormatter = new Intl.DisplayNames(['en'], { type: 'language', style: 'narrow' });
```

## Fallback strategies

{{ BASELINE_STATUS("intl-display-names") }}

In environments where `Intl.DisplayNames` is not supported, the application should degrade gracefully by displaying the raw language code or using a small, hardcoded mapping for the most common languages.

### Feature detection and graceful degradation
Wrap your localization logic in a check to ensure the API is available. If missing, return the code as-is so the UI remains functional.

```javascript
function getLanguageName(code, displayLocale = 'en') {
  // Check if the API is available in the current environment
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    try {
      const formatter = new Intl.DisplayNames([displayLocale], { 
        type: 'language', 
        fallback: 'code' // Returns the input code if no translation is found
      });
      return formatter.of(code);
    } catch (e) {
      // Fallback if the specific code is invalid or processing fails
      return code;
    }
  }

  // BASE EXPERIENCE: Return the raw code if the API is missing
  // Optional: You can provide a minimal hardcoded map for primary languages
  const manualFailover = { 'en': 'English', 'fr': 'Français' };
  return manualFailover[code] || code;
}
```

### Conditional polyfilling
If you must support older browsers (like Internet Explorer or older versions of Safari), you can conditionally load a polyfill. 

```javascript
// Detect missing support
if (!window.Intl || !Intl.DisplayNames) {
  // Use a dynamic import to load a polyfill only when needed
  // This ensures modern browsers do not download unnecessary code
  await import('path-to-intl-displaynames-polyfill');
  await import('path-to-intl-displaynames-locale-data-en');
}