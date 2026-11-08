* The interface includes a semantic, visible submit button.
* Pressing Enter without Shift on a textarea when not composing triggers form submission.
* Pressing Enter on a textarea when composition is active (`isComposing` is true) does not trigger form submission.
* Pressing Enter on a textarea when the browser signals an IME-consumed keystroke (`keyCode 229`) does not trigger form submission.
* Pressing Shift+Enter on a textarea does not trigger form submission.
* Pressing Shift+Enter on a textarea inserts a newline into the text content.
