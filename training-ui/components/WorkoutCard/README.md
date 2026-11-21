# WorkoutCard

A card for the day's planned workout: sport, name, volume, zone structure and the main action.

**Markup:** `article.ds-card.ds-workout` > `__head` (overline + `__title` + optional Badge), `__meta` (numbers in `mono`), a ZoneBar track of the plan at `opacity: .55`, Button `primary --lg --block`.

**Consumer provides:** day and sport, name, duration, distance/load, target zone, plan segments, state.

- “Done” state: replace the button with a `--success` Badge and a MetricTile with the actuals; the plan track becomes solid (opacity 1) with the actual zones.
- “Changed by coach” state — `--coach` Badge; tapping it opens a CoachMessage with the explanation.
- Don't: more than three numbers in `__meta`.
