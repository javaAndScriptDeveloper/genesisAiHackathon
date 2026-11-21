# WorkoutSteps

The workout structure from warm-up to cool-down, with the session's purpose on top.

**Markup:** `p.ds-steps__purpose` + `ol.ds-steps` > `li.ds-step` (`--main` for the main set: a filled `volt-mark` node) > `__rail` (`__node`, `__line`), a text block (`__phase` overline, `__title`, `__detail`), `__zone` (a zone-color square + Z1–Z5 label).

**Consumer provides:** the purpose in one sentence, and steps: phase, volume (time/distance/reps), target (pace, HR, RPE), zone.

- The purpose is required: people need to know *why* this session.
- For strength steps, put sets × reps in `__zone` instead of a zone.
- Don't: a colored stripe on the left of every step; the zone reads from the labelled chip.
