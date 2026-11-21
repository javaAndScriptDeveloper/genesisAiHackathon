# Badge

A workout status in one or two words; the color is always doubled by a word and a 12px icon.

**Markup:** `<span class="ds-badge ds-badge--success">`. Tones: `--success` (done), `--warning` (partial), `--danger` (missed), no modifier (planned), `--coach` (plan changed by the AI).

**Consumer provides:** the text and, for statuses, the icon: check / half-circle / x.

- Don't: a badge as a button; a badge as a colored dot with no word.
