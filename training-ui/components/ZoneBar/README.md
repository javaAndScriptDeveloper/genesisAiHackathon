# ZoneBar

Time distribution across intensity zones Z1–Z5 for one workout or a week.

**Markup:** `.ds-zones` > `.ds-zones__track` (segments `.ds-zones__seg.z1…z5` with `flex: <minutes>`) + `.ds-zones__legend`.

**Consumer provides:** minutes per zone, total time, and an `aria-label` on the track with the distribution as text.

- The legend is required: zones are read by their label, not by color alone.
- For a plan (not done yet) show the target zones with the same component at `opacity: .5`.
- Don't: use `zone-*` colors for anything other than intensity zones.
