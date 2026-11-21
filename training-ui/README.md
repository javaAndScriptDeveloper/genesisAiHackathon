A design system for an interface with an AI coach: plans, workout analysis, data from watches. The UI has to read mid-run, with a sweaty finger and in direct sun — so large targets, large numbers, little color, and every color means something.

## Principles

- **The number is the hero.** Each screen has one main metric in `display-xl` or `metric`. Everything else is `body` and `ink-muted`.
- **The coach speaks, it doesn't decorate.** AI is visible only where it makes a decision: the coach's voice is always `coach` / `coach-soft` and comes with a “Why?” explanation. No sparkles, gradients or “magic”.
- **Color = meaning.** `volt` is only for brand and the primary action. Statuses (`success`, `warning`, `danger`) and zones (`zone-1`…`zone-5`) are never decorative.
- **One action per screen.** At most one `volt`-filled button in view.

## Voice and copy

- Address the user as “you”, short, like a coach at the track: “Easy today. Hold Z2.”
- Sentence case; no exclamation marks, no emoji.
- Buttons start with a verb: “Start workout”, “Move to tomorrow”, “Connect watch”.
- An AI recommendation = decision + reason + action: “Cut the intervals to 5×800 m. Resting HR has been 8 bpm higher for three days. Accept / Change”.
- Numbers carry units with a non-breaking space: `42.2 km`, `5:12 /km`, `162 bpm`. Use the locale's decimal separator.
- Never sound medical: “looks like fatigue”, not “you're overtrained”.

## Color

- The primary theme is `dark` (first in the tokens); `light` is for daytime and web. Both are set with the `data-theme` attribute on `<html>`.
- Layers: `bg` → `surface` (cards) → `surface-raised` (modals, menus). Recessed areas (tracks, inputs) use `surface-sunken`.
- Text: `ink` for primary, `ink-muted` for secondary, `ink-subtle` only for placeholders and inactive states.
- Brand: `volt` fill with `on-volt` text (never white). `volt` as text is `volt-ink`. As meaningful graphics (progress, ring, active tab) use `volt-mark`: in the light theme `volt` on white is unreadable.
- AI coach: `coach` (text, avatar, border) on `coach-soft`.
- Statuses always pair color with a word or icon (color blindness): `success` + “Done”, `warning` + “Partial”, `danger` + “Missed”.
- Intensity zones `zone-1`…`zone-5` are only for heart-rate/power zones, always labelled Z1–Z5. They differ in both hue and lightness.
- Control borders use `line-strong` (≥3:1); decorative dividers use `line`.

## Typography

- `display` (Unbounded) — hero numbers and screen titles: `display-xl`, `display-l`, `metric`, `h1`.
- `sans` (Onest) — the whole UI: `h2`, `body-l`, `body`, `label`, `caption`, `overline`.
- `mono` (JetBrains Mono) — tabular numbers: splits, heart rate, timers: `data`, `data-s`.
- All three come from Google Fonts and support Cyrillic. Load: `https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap`.
- For numbers set in `sans`, enable `font-variant-numeric: tabular-nums` so timers don't jitter.

## Space, shape, depth

- 4px grid. Mobile screen margins `space-4`, cards `space-6` apart, sections `space-8` apart.
- Radii: cards `radius-lg`, buttons and tiles `radius-md`, inputs and badges `radius-sm`, chips `radius-full`.
- Depth in the dark theme comes from a lighter surface, not a shadow; `shadow-md` only for floating elements (tab bar, toast, record button), `shadow-lg` for modals above `scrim`.
- Touch targets ≥ `size-touch` (44px); primary buttons and inputs `size-control` (52px).

## States and focus

- Hover/pressed: the fill darkens/lightens via `filter: brightness(0.94)` / `opacity`, no new colors.
- Disabled: `surface-sunken` background, `ink-subtle` text, no shadow.
- Keyboard focus: solid 2px `focus-ring` with a 2px offset (`outline: 2px solid var(--focus-ring); outline-offset: 2px`). ≥3:1 on every surface in both themes.
- AI loading: three dots in `coach`, not a spinner.

## Motion

- 150 ms for control states; 250 ms `cubic-bezier(.2,.8,.2,1)` for cards and sheets appearing; progress fill 600 ms ease-out, once.
- Respect `prefers-reduced-motion`: drop fills and movement, keep only opacity changes.

## Icons

- Lucide (stroke 1.75, `round` caps), sizes `size-icon-sm` / `size-icon` / `size-icon-lg`, color `currentColor`.
- Sports are icons, not emoji. Third-party logos (watches, health services) only as official files from the service; this system has none, so integrations are shown by name in text.
- The system has no logo: where a brand mark would go, set text in `display-l` at weight 700.

## Components

`components/bundle.css` holds the classes, prefixed `ds-`; every component has a live preview and a README with its rules. There are no JS components in a bundle yet: markup is HTML + these classes, and the consumer builds React wrappers.
