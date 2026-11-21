# TabBar

Bottom navigation with five sections: Today, Plan, Coach, Insights, Profile.

**Markup:** `nav.ds-tabbar` > `button.ds-tab` (24px icon + label); active — `aria-current="page"`, icon in `volt-mark`, label in `ink`.

**Consumer provides:** the sections, the active one, an unread badge on “Coach” (a `coach` dot).

- Floats above content with `shadow-md`, `space-4` from the edges plus the bottom safe area.
- Hidden during an active workout — control is through the workout buttons only.
