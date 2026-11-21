# Styling

- SCSS Modules co-located with the component. One root class, camelCase nested selectors, nested media queries.
- Use rem only; `html { font-size: 62.5% }` so 1rem = 10px.
- Header of each module:
  ```scss
  @use "partials/corners";
  @use "partials/mixins";
  ```
  (resolved by `sassOptions.loadPaths` → `styles/`).
- **Tokens** live in `styles/partials/_tokens.scss` as CSS variables: `--color-*`, `--space-1..9`, `--radius-*`, `--shadow-*`, `--transition-*`, `--z-*`, `--container-*`, `--hit-target` (4.4rem). Never hardcode colors, shadows, or spacing that a token covers. Add a token when a value repeats.
- **Corners:** `@include corners.radius(var(--radius-control));` never bare `border-radius` (exception: perfect circles/pills `50%`/`--radius-pill`). Nested rounded child inside a rounded parent: `@include corners.nested($parentRadius, $gap)`, e.g. dropdown/select options.
  **Always check nesting:** whenever a rounded element sits inside another rounded one (items in panels/menus/modals, badges/icon plates inside cards or toasts, inner images in cards), its radius MUST be `parent radius - gap` (padding + border) via `corners.nested`, never a copied or arbitrary value. Every radius goes through `corners.radius`/`corners.nested` so `corner-shape: squircle` is always applied.
- **Breakpoints:** `@include mixins.respond(md)` (min-width) or `mixins.below(sm)`. Keys: sm 576, md 768, lg 992, xl 1200. Mobile-first.
- **Typography:** global in `_typography.scss`. h1 uses Unbounded 800; h2–h4 Inter; helper classes `.lead .small .caption .eyebrow`. Alternates: `font-family: var(--font-montserrat)` / `var(--font-poppins)`.
- **Look:** minimal (nextjs.org / Notion / Linear): near-black primary, one restrained indigo accent, hairline borders, generous whitespace, subtle shadows. No gradients or decoration without purpose.
- Focus: buttons/links use `mixins.focus-ring`; text inputs change border-color only (no outline/box-shadow).
- Respect `prefers-reduced-motion` (reset handles global animation; avoid long motion).
- Admin-style semantics: near-black for primary actions, green success, red destructive, amber warning; blue/indigo is accent only.
