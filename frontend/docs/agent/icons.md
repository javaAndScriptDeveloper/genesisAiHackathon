# Icons

- **Hugeicons** only (free set): `@hugeicons/react` renders, `@hugeicons/core-free-icons` supplies definitions.
- Always import individual icons (tree-shaking) and render through our wrapper:
  ```tsx
  import { Search01Icon } from "@hugeicons/core-free-icons";
  import { Icon } from "@/components/ui";
  <Icon icon={Search01Icon} size={20} />
  ```
- Icon-only controls: use `IconButton` with a `label`. Decorative icons are `aria-hidden`; give `label` to `Icon` only if it stands alone.
- Find a name: icons end in `Icon` (e.g. `Add01Icon`, `Delete02Icon`, `Edit02Icon`, `Settings02Icon`, `Search01Icon`, `Cancel01Icon`, `Tick02Icon`, `ArrowDown01Icon`, `ArrowRight01Icon`, `Alert02Icon`, `InformationCircleIcon`, `CheckmarkCircle02Icon`, `Loading03Icon`, `MoreHorizontalIcon`). Verify existence: `ls node_modules/@hugeicons/core-free-icons/dist/esm | grep -i <word>`; browse at hugeicons.com/icons.
- Use distinct semantic icons for distinct meanings; repeated actions (arrows, copy) stay consistent. Not every paragraph needs an icon.
- No emoji, no Unicode glyphs as icons.
- **Sport pictograms are the one exception** (the user asked for a sport set): `components/ui/SportIcon` wraps a few Tabler Icons (`@tabler/icons-react`, MIT): barbell, run, yoga, flame, stopwatch… Use it for training types and effort metrics (kcal, time). Everything else stays Hugeicons. Muscle diagrams use `react-body-highlighter` (MIT) through `components/features/MuscleMap`.
