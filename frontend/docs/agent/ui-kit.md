# UI kit (`components/ui`, import from `@/components/ui`)

Living showcase: `/ui-kit` (and `/`). Every new or changed component must appear there.

| Component | Notes |
|---|---|
| Button | `variant` primary/secondary/ghost/danger, `size` sm/md/lg, `loading`, `iconLeft/Right` |
| IconButton | icon-only, `label` required (aria), 4.4rem hit target |
| Input, Textarea | forwardRef (react-hook-form `register`), `label`, `hint`, `error` |
| Select | custom listbox; keyboard + typeahead; `options`, `value`, `onChange` |
| Dropdown | action menu; `trigger` render-prop + `items` |
| Checkbox, Switch | whole row is hit target |
| Modal | native `<dialog>`, focuses first editable field |
| ConfirmDialog | required for destructive actions |
| Toast | `useToast().show(msg, tone)`; provider already in `Providers` |
| Tooltip | CSS-only, never sole source of info |
| Table | `columns`, `rows`, `getRowKey`, `loading` (skeleton rows), empty state |
| Tabs, Pagination | accessible; pagination collapses with ellipsis |
| Carousel | Swiper wrapper with nav, pagination, keyboard, optional autoplay |
| TimePicker | Custom wheel picker in a Sheet (never `<input type="time">`); `minuteStep`, `presets` |
| Sheet | In-frame bottom/center overlay (no native dialog); `modal` blocks dismissal |
| SegmentedControl | Controlled tabs; selection lives with the caller |
| ProgressBar, ProgressRing | 0–100 `value`, `label` required |
| Stepper | Large +/- numeric control for sets and onboarding |
| Badge, Avatar, Card, Container, Skeleton, EmptyState, Icon, Picture | basics |

## Adding a component
1. Check this table; extend an existing component if possible.
2. Create `components/ui/Name/Name.tsx` + `Name.module.scss` (tokens, corners, mixins).
3. Props typed, no `any`; accessible name for icon-only controls; hit targets ≥ 4.4rem; focus styles.
4. Export from `components/ui/index.ts`; add an example to `UiKitShowcase`.
5. Run `bun run typecheck`, look at `/ui-kit`.

## Custom controls only
No native-looking controls: time/date pickers, selects, checkboxes, switches and steppers are kit components. Number fields hide the browser spin buttons. Sheets render through `OverlayRootContext` (portal into the phone screen) so they cover the visible screen even when the page behind is scrolled.
