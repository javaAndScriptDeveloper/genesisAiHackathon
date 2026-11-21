# LiveMetrics

The in-workout screen: one large number, three supporting ones, the current interval and two controls.

**Markup:** `.ds-live` > interval (`__interval` with a zone chip `.ds-step__zone` (color square + label), `__track` + `__fill`), `__hero` (`__hero-value` 64px, `__hero-label`, `__target`), `__grid` (3 metrics `__v`/`__l`), `__controls` (2 Buttons `secondary --lg`).

**Consumer provides:** the current plan step, the main metric (pace for running, power for cycling, reps for strength), its target and deviation status, three supporting metrics, pause and next-step handlers.

- Target status as text: “on target” (`success`), “faster than target” / “slower” (`warning`). A voice cue repeats it.
- Finishing only by press-and-hold (“Hold to finish”) to avoid accidental taps.
- Tab bar and RecordButton are hidden; the screen stays on.
- Forced dark mode, even when the app is in light.
