# Button

An action button; `primary` (`volt` fill) is the one main action per screen, everything else is `secondary` or `ghost`.

**Markup:** `<button class="ds-btn ds-btn--primary">`. Modifiers: `--primary`, `--secondary`, `--ghost`, `--danger`; size `--lg` (height `size-control`, 52px) for the main action at the bottom of a screen; `--block` for full width.

**Consumer provides:** a label (verb first, sentence case), an optional 20px icon before the label, `disabled` / `aria-disabled`.

- Do: “Start workout” as `primary --lg --block` at the bottom of the day screen.
- Do: `ghost` for “Why?” next to a coach recommendation.
- Don't: two `primary` buttons side by side; `volt` text instead of `on-volt` on the fill; a red fill — `danger` is outline only, and a destructive action always asks for confirmation.
- States: hover — `brightness(.94)`; disabled — `surface-sunken` + `ink-subtle`; focus — 2px `focus-ring` with a 2px offset.
