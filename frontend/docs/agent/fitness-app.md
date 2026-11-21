# Fitness app (Personal Coach)

Mobile-first coaching app that lives in the route group `app/(app)/`. Desktop renders it inside an iPhone-style frame; real phones (< 576px) get the bare app. The frame, red theme, bottom nav, route guard and in-frame overlays are owned by `components/features/AppShell` + `PhoneFrame`.

## Layers
- `lib/fit/` is the domain, free of React: `types`, `exercises` (library + equipment/limitation filtering), `videos` (exercise → YouTube id map), `plan` (weekly plan generator), `adapt` (pure session adjustments), `stats`, `gamification`, `coach` (deterministic intent → actions), `notifications`, `health` (provider interface + Demo provider), `analytics` (typed `track`), `seed` (demo history), `speech`, `share`.
- `lib/fit/store/`: one reducer (`reducer.ts`), `FitProvider` (localStorage persistence under `fit.state.v1`, hydration-safe via `ready`), `observe.ts` (turns state transitions into analytics events), `hooks.ts` (`useFitStats`, `useStartWorkout`).
- `components/features/*`: screens and widgets. Screens read state with `useFit()` and dispatch typed actions. Nothing computes numbers on its own: Today, Progress and Coach all use `useFitStats()` / lib functions.

## Rules specific to this app
- All copy is English-source in `messages/parts/*.json`, merged into `messages/en.json` by `node scripts/build-messages.mjs` (edit parts or `en.base.json`, never `en.json`). Run the script after editing. `uk.json` falls back to English per key.
- Overlays use `components/ui/Sheet` (absolute inside the device), not native `<dialog>`, because a top-layer dialog would escape the phone frame. Destructive actions still require an explicit confirm sheet.
- Streak counts consecutive planned sessions. Rest days never break it, a recovery or illness skip is neutral, extra (ad hoc) sessions earn 25% XP and no streak credit. Never add rewards for training more than planned.
- Safety first: symptom keywords (coach) and "I feel unwell" (workout) pause the session and show guidance; they never trigger an automatic intensity change.
- Live health data is always labelled Demo Mode until a real provider implements `HealthProvider`. Blood pressure is manual entry only and never derived from heart rate.
- Premium gates (`PremiumGate`) wrap only non-essential features (advanced insights, extra photos, plan rebuild, partner scheduling). Training and safety are never gated. Subscription is a demo: no billing.

## Mock vs real
Everything is frontend state + localStorage today. Needs a backend (Next.js route handlers or the platform-backend service) when productionised: accounts/sync, real push notifications, Apple Health / Garmin OAuth or a native bridge, payments, partner matching, optional LLM coach (`/api/ai` exists and can replace `coachReply`, keep the action types).

## Videos
`lib/fit/videos.ts` maps exercise id → video id from the Leap Fitness channel (embedded with youtube-nocookie, loaded on tap, never downloaded). Unmapped exercises show a channel-search link. Override at deploy time with `NEXT_PUBLIC_EXERCISE_VIDEO_MAP='{"goblet-squat":"<11-char id>"}'`.

## Page transitions
`app/(app)/template.tsx` wraps each page in React `<ViewTransition>`. Direction comes from `transitionTypes` (`nav-forward` / `nav-back`) on `Link` and `router.push`: bottom-nav tabs pick it from tab order, drill-down links use forward, header back uses back; everything else gets a soft fade. Styles live in `styles/partials/_transitions.scss` (only page content is animated, reduced motion disables it).

## Units (kg / lb)
All data is stored metric (kg, cm). `state.units` (`metric` | `imperial`, default metric, chosen in onboarding and Settings) only changes display and input. Never write "kg" in a component: use `useUnits()` (`fmtLoad`, `fmtMass`, `mass`, `toKg`, `unit`) or `lib/fit/units.ts`. Animated numbers use `AnimatedNumber` (`@number-flow/react`).

## Avoiding flicker
- State change + navigation go through `useActionNavigate()` (one transition), never `dispatch(); router.push()`. Otherwise the current screen re-renders with the new state before the next page appears.
- `Sheet` keeps its latest `onClose` in a ref: inline handlers must not re-run its focus effect (the workout timer re-renders the page every second).
- Scroll restoration runs in a layout effect so it is applied before paint and before the view-transition snapshot.
- Page crossfade uses `mix-blend-mode: plus-lighter` on old/new snapshots so the content never dips toward the background colour.
