# Chip

A toggle filter for picking a sport, training days or a goal in onboarding.

**Markup:** `<button class="ds-chip" aria-pressed="true|false">`. Selected — `volt-soft` background, `volt-mark` border, `volt-ink` text; unselected — `line-strong` border.

**Consumer provides:** a label (1–2 words), the `aria-pressed` state, and a container with `role="group"` and `aria-label`.

- Height is 36px, but the touch target must be ≥ `size-touch` — keep `space-2` between chips.
- Don't: use chips as navigation between screens (that's the tab bar).
