# ExerciseCard

An exercise for a strength or home workout: video demo, sets with progress, one short technique tip.

**Markup:** `article.ds-exercise` > `__media` (16:9 poster/video, `__play` button, `__dur` duration), `__body` (overline with position, `__name`, `__sets` with `.ds-set--done|--current`, `__tip`).

**Consumer provides:** a demo video or poster (own content; with no poster — a neutral `surface-sunken` placeholder), the name, sets × reps or time, rest, one technique tip, the state of each set.

- A done set — `success-soft` + a check mark (not color alone); the current one — `volt`.
- Tapping a set marks it and starts the rest timer.
- Don't: stock photos of people instead of a movement demo; more than one tip.
