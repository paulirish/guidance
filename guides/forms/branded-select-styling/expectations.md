* The `<select>` element has `appearance: base-select` applied.
* The `::picker(select)` pseudo-element has `appearance: base-select` applied.
* The `::picker(select)` pseudo-element defines custom styles for the options dropdown container.
* The implementation uses `select::picker-icon` to customize the drop-down arrow icon.
* The implementation uses `option::checkmark` to customize the checkmark indicator for the selected option.
* The markup includes a `<button>` element inside the `<select>` to replace the default trigger.
* The trigger button includes a `<selectedcontent>` element to display the active option.
* The trigger button does not contain the legacy `<selectedoption>` element.
* The colors have a contrast of at least `3:1` with the background color.
* The implementation does not use JavaScript as the primary mechanism for toggling the dropdown.
* The `<select>` element has a `name` attribute.
* The `<select>` element has an associated `<label>`.
