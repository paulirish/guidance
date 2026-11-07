* The implementation uses the `accent-color` CSS property to apply a custom color to form controls.
* The value for `accent-color` has a contrast of at least `3:1` with the background color.
* The implementation targets at least one of the following elements with `accent-color`: checkbox, radio, range, or progress.
* The implementation uses `color-scheme: light dark` (in CSS or meta tag) to enable appropriate default styling for forms in dark mode.
* The implementation updates the `accent-color` value for dark mode using a `prefers-color-scheme` media query.
* The implementation provides a fallback for browsers that do not support `accent-color` using the `@supports not` rule.
* The fallback implementation styles checkboxes and radio buttons to match the brand color.
* Visually hidden inputs in the fallback use the canonical accessible utility pattern (`clip-path: inset(50%)`, `width: 1px`, `height: 1px`).
* Custom fallback controls explicitly style the `:focus-visible` state to preserve focus indication for keyboard users.
* The fallback implementation for range sliders uses vendor prefixes to style the thumb and track, and simulates progress.
* The fallback implementation for progress bars uses vendor prefixes to style the progress value.
* Every `<input>` control has an explicit `id` attribute, and its associated `<label>` explicitly sets the `for` attribute matching the input id.
