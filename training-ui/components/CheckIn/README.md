# CheckIn

A short pre-workout readiness check that the coach answers by adjusting the plan (CoachMessage).

**Markup:** `section.ds-card.ds-checkin` > overline, `__q`, `__scale` (5 `__pt` buttons with `aria-pressed`, number + word), `__opts` (reason Chips, multi-select), Button `secondary --block`.

**Consumer provides:** the question, the scale (5 steps with labels), the set of reasons, a submit handler.

- Shows on Today before the start when watch data is ambiguous or the user has turned on a daily check-in. Skipping is always possible (“Later” as `ghost`).
- The button is `secondary`, not `primary`: the screen's main action stays “Start workout”.
- The coach's reply refers to the check-in: “You rated 2 and slept badly — …”.
