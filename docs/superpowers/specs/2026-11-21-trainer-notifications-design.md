# Trainer-voice notifications, achievements and streaks: design

## Intent
Make the app feel like it has a coach: when you slip, your chosen trainer (Mike, John, Hanna, Caroline or Alex) nudges you in their own voice, written by Gemini. Achievements and streaks become visible in one consistent place instead of scattered.

## Goals
- Notifications (inbox, popup when the app is open) written in the selected trainer's tone of voice via Gemini.
- New notification kinds: **streak** (at risk, and milestones 3/7/14/30 days) and **achievement** (badge, level and personal record from the existing progress events).
- Streak and level are visible at a glance on Today; achievements are one tap from Progress.
- Works with no Gemini key or offline: the template text still shows.
- A **Share** button on the weekly report, on achievements (badge, level, personal record) and on streaks, posting to social networks through the device share sheet.

## Non-goals / anti-goals
- No direct integrations with social network APIs (no logins, tokens or per-network buttons): the OS share sheet reaches every installed app.
- No closed-app push (no service worker, Web Push, VAPID keys, subscription table or server scheduler). That is a separate project if wanted later.
- The trainer must never shame the body, invent facts, or give medical advice (the tov text already says so; the prompt repeats it).
- A failed or slow Gemini call must never block the UI or lose a notification.

## Approaches considered
1. **Template first, Gemini rewrites (chosen).** Existing `deriveNotifications` keeps creating deterministic notifications instantly. A client hook then asks `/api/nudge` once per notification id to rewrite the body in the trainer's voice and stores the result. Trade-off: the user may briefly see the template before the AI text. Wins on reliability and fits the current id-deduplicated design.
2. **Gemini creates everything, no templates.** More "alive", but slow first paint, nothing to show on failure, and it would rewrite the derivation logic.
3. **Server-side generation and storage.** Needed for closed-app push; too much for now and it adds accounts and a scheduler.

## Design
- **Server route** `POST /api/nudge` `{ trainerId, kind, facts }` → `{ text }`. It loads the trainer's `tov` from platform-backend, builds a prompt (voice, hard rules, facts only, max 2 short sentences, no emojis), calls Gemini with the existing 20 s timeout, and returns plain text. `facts` is a small typed record (workout title, days missed, streak length, badge name…), never free text from the user.
- **Streak notification:** derived in `deriveNotifications`: streak at risk when the streak is 2 or more days and there is a planned workout today not yet done after the reminder time; milestone when the streak hits 3/7/14/30. Ids are deterministic (`n-streak-risk-<date>`, `n-streak-<n>`).
- **Achievement notification:** one per unseen progress event (`badge`, `level`, `pr`), id from the event id.
- **Rewrite hook** (`useTrainerVoice`): after notifications change, for each unread notification without `aiText` and of a voiced kind, call `/api/nudge`, then dispatch `notification-voice {id, text}`. One request in flight at a time, no retry on failure (template stays), results stored in state so a reload never regenerates.
- **State:** `AppNotification` gains optional `aiText` and `trainerId`; reducer action `notification-voice`. Old saves load unchanged.
- **UI placement:**
  - Today header: streak chip (flame + days) and level chip beside the bell. Tapping the chip opens Progress.
  - Notification rows show the trainer's avatar for voiced kinds.
  - Progress: an "Achievements" card (recent and next badges) linking to the existing Awards screen.
  - Newest unread voiced notification also shows as a trainer card at the top of Today, dismissible, with a button to the related screen.
- **Popup:** the existing browser notification path uses `aiText` when it exists at the time it fires, otherwise the template.
- **Copy:** UI labels in `messages/parts/*.json`; Gemini text is English only for now, like coach content.

## Sharing (added at the user's request)
- **Today:** `lib/fit/share.ts` `shareText` uses `navigator.share` with a clipboard fallback; only badges use it (Awards, Celebration). Reports and streaks have none.
- **Share card (my call):** one function renders a branded image card (canvas, 1080x1350 PNG: big number or badge, one line of text, app name) for report, streak and achievement. `shareCard(title, text, card)` shares text plus the image file when the browser supports sharing files, text only when it supports sharing but not files, and copies the text otherwise. Never throws. An image is what people actually post; if cut, text-only still works.
- **Where:** a Share button on the weekly report screen, on the streak (Today chip detail on Progress), on the Awards badge sheet (already has text share, upgraded to the card), on the celebration overlay, and on the trainer-voice achievement and streak notifications.
- **Text** reuses existing copy where it exists (`fit.celebration.shareText`, report summary) and gains one string each for streak and report. Shared text is the user's own stats only, never a name, photo or profile data.

## Constraints
Frontend rules in `frontend/AGENTS.md` (bun, no `any`, kit components, tokens only, copy in message parts). TDD for derivation, reducer and the prompt builder. The Gemini call is mocked in tests; no network in CI.

## Left to the builder
Exact chip styling, the trainer card layout, prompt wording per kind, and the milestone thresholds if the engine already defines streak milestones.
