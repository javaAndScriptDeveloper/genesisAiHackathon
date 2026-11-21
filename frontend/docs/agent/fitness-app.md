# Fitness app (Personal Coach)

Mobile-first coaching app that lives in the route group `app/(app)/`. Desktop renders it inside an iPhone-style frame; real phones (< 576px) get the bare app. The frame, theme, bottom nav, route guard and in-frame overlays are owned by `components/features/AppShell` + `PhoneFrame`.

## Layers
- `lib/fit/` is the domain, free of React: `types`, `exercises` (library + equipment/limitation filtering), `videos` (exercise → YouTube id map), `plan` (weekly plan generator), `adapt` (pure session adjustments), `stats`, `gamification`, `coach` (deterministic intent → actions), `notifications`, `health` (provider interface + Demo provider), `analytics` (typed `track`), `seed` (demo history), `speech`, `share`.
- `lib/fit/store/`: one reducer (`reducer.ts`), `FitProvider` (localStorage persistence under `fit.state.v1`, hydration-safe via `ready`), `observe.ts` (turns state transitions into analytics events), `hooks.ts` (`useProgress`, `useFitStats`, `useStartWorkout`).
- `lib/progress/` is the single source of every progress and motivation number: consistency (v2), streak (weeks), weekly goal, XP, level, badges, records, improvements, advice, weekly reports and "new" events (`progressSnapshot`, `detectEvents`, `reportReadyEvent`). `historyFromFit` (`lib/progress/fromFit.ts`) is its only input from `FitState`; `progressCtx(state)` (`lib/fit/store/progressStats.ts`) is the only context (weekly goal 2–5 + pauses). Screens read it through `useProgress()`; `useFitStats()` keeps its old field names for Today/Coach/Profile but takes streak/consistency/level/XP from the engine (`fitStatsFromSnapshot`). `lib/fit/stats` and `gamification` keep only non-progress helpers (week stats, volume, load progression, weekly challenge). `lib/api/mock/progressDb.ts` is a deterministic test fixture.
- Events: the reducer's `finish` diffs the snapshot before/after the session and records `badge` / `level` / `pr` events in the same step; `sync` records last week's `report` event. `Celebration` shows all unseen badge + level events in one window and marks them seen on close. `state.unlocked`, `state.celebrate` and `SessionLog.xp` are legacy (kept for old saves); per-session XP is written from `xpForSession`.
- `components/features/*`: screens and widgets. Screens read state with `useFit()` and dispatch typed actions. Nothing computes numbers on its own: Today, Progress and Coach all use `useFitStats()` / lib functions.

## Rules specific to this app
- All copy is English-source in `messages/parts/*.json`, merged into `messages/en.json` by `node scripts/build-messages.mjs` (edit parts or `en.base.json`, never `en.json`). Run the script after editing. `uk.json` falls back to English per key.
- Overlays use `components/ui/Sheet` (absolute inside the device), not native `<dialog>`, because a top-layer dialog would escape the phone frame. Destructive actions still require an explicit confirm sheet.
- Streak counts consecutive credited weeks: a week is credited when the weekly goal (2–5 quality workouts) is met. A paused week (1–4 weeks, `state.pauses`) is neutral: it neither grows nor breaks the streak; an uncredited week without a pause resets it. Rest days never matter. Extra (ad hoc) sessions earn no XP and no streak credit. Never add rewards for training more than planned or for inactivity.
- Safety first: symptom keywords (coach) and "I feel unwell" (workout) pause the session and show guidance; they never trigger an automatic intensity change.
- Live health data is always labelled Demo Mode until a real provider implements `HealthProvider`. Blood pressure is manual entry only and never derived from heart rate.
- Premium gates (`PremiumGate`) wrap only non-essential features (advanced insights, extra photos, plan rebuild, partner scheduling). Training and safety are never gated. Subscription is a demo: no billing.

## Mock vs real
Everything is frontend state + localStorage today. Needs a backend (Next.js route handlers or the platform-backend service) when productionised: accounts/sync, real push notifications, Apple Health / Garmin OAuth or a native bridge, payments, partner matching, optional LLM coach (`/api/ai` exists and can replace `coachReply`, keep the action types).

`/analytics` lives outside the phone shell. The dashboard reads event names, timestamps and workout-completion flags persisted by `track` under `fit.analytics.v1.*`. It starts collecting on installation and clears the event log on profile reset. The economics calculator uses monetization and paid acquisition inputs from the market report. The default launch pilot targets 90% organic acquisition and budgets $50 per month in overhead. The market benchmark preset uses the report’s acquisition mix and illustrative overhead. Billing, provider usage and cross-device cohorts require server-side sources.

## Videos
`lib/fit/videos.ts` maps exercise id → video id from the Leap Fitness channel (embedded with youtube-nocookie). Exercise details autoplay muted with the native control bar hidden. Unmapped exercises show a labeled related clip. Override at deploy time with `NEXT_PUBLIC_EXERCISE_VIDEO_MAP='{"goblet-squat":"<11-char id>"}'`.

## Page transitions
The app shell wraps the scrollable page in React `<ViewTransition>`. Direction comes from `transitionTypes` on links and router calls. Exercise detail links opt out of the page transition and leave scroll restoration to the shell. The library preserves filters and the horizontal category rail in memory so the shell restores the prior vertical position against the same list. Motion styles live in `styles/partials/_transitions.scss` and honor reduced motion.

## Units (kg / lb)
All data is stored metric (kg, cm). `state.units` (`metric` | `imperial`, default metric, chosen in onboarding and Settings) only changes display and input. Never write "kg" in a component: use `useUnits()` (`fmtLoad`, `fmtMass`, `mass`, `toKg`, `unit`) or `lib/fit/units.ts`. Animated numbers use `AnimatedNumber` (`@number-flow/react`).

## Avoiding flicker
- State change + navigation go through `useActionNavigate()` (one transition), never `dispatch(); router.push()`. Otherwise the current screen re-renders with the new state before the next page appears.
- `Sheet` keeps its latest `onClose` in a ref: inline handlers must not re-run its focus effect (the workout timer re-renders the page every second).
- Scroll restoration runs in a layout effect so it is applied before paint and before the view-transition snapshot.
- Page crossfade uses `mix-blend-mode: plus-lighter` on old/new snapshots so the content never dips toward the background colour.

## Onboarding quiz (Spotty)
`/onboarding` renders `components/features/OnboardingQuiz`: 9 steps (hello, name, gender, goal, body, level, days, choose your coach, watch sync) plus a "plan ready" screen with "why this plan" and the first sessions. The `Onboarding` component is kept for `/profile/edit`. Spotty (`components/features/Spotty`) is an inline SVG mascot with moods (`idle | wave | think | cheer`); animations stop under `prefers-reduced-motion`.
- **Coaches:** the same backend list as Settings (`useTrainers` from `lib/api/trainers`, `GET /api/trainers`). The pick goes into `complete-onboarding` as `trainerId`, so it survives the state reset and lands in `FitState.trainerId`.
- **Goal:** pick a preset, or type your own words. On Continue, `parseGoal` (`lib/api/onboarding.ts`) calls `POST /api/goal` (Gemini) and falls back to `matchGoalKeywords` (`lib/fit/goal.ts`) on a missing key, an error, a 6s timeout or "could not tell". The words are saved as `profile.goalText`.
- **Personal plan:** the "plan ready" screen calls `usePersonalPlan` (`lib/api/plan.ts`) → `POST /api/plan` → Gemini (`generateAiPlan`) with the full profile, the coach's `tov` and the exercise catalog already filtered by equipment and limitations. The model returns a one-week template (`aiPlanSchema` in `lib/fit/aiPlan.ts`): session titles, exercise ids, sets/reps/rest, plus `summary` and `why`. `planFromAi` lays it onto the training days for 4 weeks; loads, durations and dates are always ours, unknown or unusable ids are dropped, and a session with fewer than 2 valid exercises becomes the rule-based workout. No key, an error or a 25s timeout → `generatePlan`. The result goes to the reducer as `complete-onboarding.planned`. Later rebuilds (profile edit, `rebuildUpcoming`) still use the rule-based generator.
- Copy: `messages/parts/quiz.json` (English only).

## Theme: Training UI design system
The app uses the dark theme of the Training UI design system (`training-ui/` at the repo root; tokens in `training-ui/tokens.css`). `styles/partials/_training.scss` maps it onto the kit's semantic tokens (`--color-*`) and Onest. `PhoneFrame` includes it on `.device`, so every screen inside the phone gets it and `/ui-kit` keeps the base kit look. Rules from `training-ui/README.md` that apply here:
- Text on filled colors uses `--color-onAccent` / `--color-onSuccess` / `--color-onDanger`, never `#fff`: white on volt is unreadable.
- At most one volt (primary) button per screen. Repeated list actions use `secondary`.
- The AI coach's voice uses `--color-coach` / `--color-coachSoft`.
- Copy has no exclamation marks, and there are no sparkles on AI.
