# RecordButton

A floating record button, always available on the main screens above the tab bar.

**Markup:** `button.ds-record` with `i.ds-record__dot`; `--compact` — a round 52px button with no label (`aria-label` required).

**Consumer provides:** the label (“Start recording” or the planned session: “Start intervals”), a handler, positioning: `position: fixed`, right, `space-4` above the tab bar + safe area.

- Extended on Today, compact while scrolling down and on other tabs.
- Hidden during an active workout and on screens with their own bottom `primary` button (that one counts as the main action).
- Don't: a second `volt` fill on the same screen.
