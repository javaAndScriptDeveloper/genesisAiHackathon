# WeekStrip

The week strip at the top of the Today screen: weekday, date, status mark; today has a `volt` fill.

**Markup:** `.ds-week` (7-column grid) > `.ds-day` (`--today` for the current day, `aria-current="date"`) > `__name`, `__num`, `i.ds-day__mark.ds-mark--done|missed|planned|rest`.

**Consumer provides:** 7 days with date and status, a day-select handler.

- Marks differ by shape, not only color: done — solid dot, missed — ring, rest day — empty.
- Tapping a day opens its card; a horizontal swipe moves to the adjacent week.
