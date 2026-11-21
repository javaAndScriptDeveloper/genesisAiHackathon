# MetricTile

One metric: a label, a large value in `metric`, a unit, and a comparison with the previous period.

**Markup:** `.ds-metric` > `__label`, `__value` (with `__unit` inside), `__delta` (`--up` = better, `--down` = worse).

**Consumer provides:** the name, an already formatted value (locale, tabular-nums), the unit, and the delta with its direction *by meaning*, not by sign: a rising resting heart rate is `--down` (worse).

- The delta always has text (“faster”, “over 3 days”), not just an arrow and a color.
- Tile grid: 2 columns on mobile with a `space-3` gap.
