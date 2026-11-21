# ProgressRing

A plan-completion ring: week, number of sessions, volume. Fill is `volt-mark` on a `surface-sunken` track.

**Markup:** `.ds-ring` > SVG with `circle.ds-ring__track` and `circle.ds-ring__fill` (`stroke-dasharray` = 2πr, `stroke-dashoffset` = 2πr × (1 − fraction)) + `.ds-ring__center`.

**Consumer provides:** a fraction 0–1, the value and label in the center, an `aria-label` with the percentage.

- Sizes: 132px (week hero), 96px (inside a card). Stroke ≈ 9% of the diameter.
- Fill animates 600 ms ease-out once on appear; no animation under `prefers-reduced-motion`.
