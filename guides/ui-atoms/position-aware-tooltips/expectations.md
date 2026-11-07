# Expectations for Position Aware Tooltips

- Uses the Popover API with `popovertarget` and the `popover` attribute.
- Sets `role="tooltip"` on the popover, and programmatically associates it with the trigger button by setting `aria-describedby` matching the tooltip's ID.
- Conditionally polyfills the Popover API.
- Uses `position-area` to define the default placement of the tooltip.
- Defines fallback positions using `position-try-fallbacks`.
- Sets `container-type: anchored` on the positioned element (the tooltip) to enable anchored container queries.
- Uses `@container anchored(fallback: <value>)` to update styles when the tooltip flips to a fallback position.
- Does not style the container element itself directly inside the `@container` block.
- Uses pseudo-elements for decorative arrows.
- Updates the visual styling and layout when the tooltip flips to a fallback position purely via CSS without JS.
