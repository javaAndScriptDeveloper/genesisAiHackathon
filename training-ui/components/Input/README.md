# Input

A text field with a label and a hint; height `size-control`, `surface-sunken` background, `line-strong` border.

**Markup:** `label.ds-field` > `__label`, `input.ds-input`, `__hint`. Error — `.ds-field--error` + `aria-invalid="true"`; the hint becomes the error text in `danger`.

**Consumer provides:** the label, value, `inputmode` (`numeric`/`decimal` for numbers), an example placeholder, the hint or error text.

- An error says how to fix it (“Format h:mm:ss”), not “Invalid value”.
- 16px font so iOS doesn't zoom on focus.
