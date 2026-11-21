# Fitness app (Personal Coach)

Mobile-first coaching app that lives in the route group `app/(app)/`. Desktop renders it inside an iPhone-style frame; real phones (< 576px) get the bare app. The frame, theme, bottom nav, route guard and in-frame overlays are owned by `components/features/AppShell` + `PhoneFrame`.

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

## Onboarding quiz (Spotty)
`/onboarding` renders `components/features/OnboardingQuiz`: 9 steps (hello, name, gender, goal, body, level+place, days, choose your fighter, watch sync) plus a "plan ready" screen with "why this plan" and the first sessions. The `Onboarding` component is kept only for `/profile/edit`. Spotty (`components/features/Spotty`) is the app mascot, a bouncy volt bubble in a sweatband holding two dumbbells, drawn as inline SVG with moods (`idle | wave | think | cheer`) and a speech bubble; animations stop under `prefers-reduced-motion`.
- **Trainers:** `GET /api/mock/trainers` → `{ trainers: Trainer[] }` (`lib/api/onboarding.ts`, data in `lib/api/mock/trainers.ts`). The list is AI-generated for now; to move to a real AI or backend endpoint, keep `trainersResponseSchema` and change only the source. The chosen id is saved as `profile.trainerId` and shown in the Coach header.
- **Goal:** `parseGoal(text)` asks `POST /api/ai` (Claude) for `{goal, summary}` JSON and falls back to `matchGoalKeywords` (`lib/fit/goal.ts`) on a missing key, an error or a 6s timeout, so the demo works without `ANTHROPIC_API_KEY`. The raw words are saved as `profile.goalText`.
- Copy: `messages/parts/quiz.json` (English only; `uk.json` has no `fit.*` keys yet).

## Theme: Training UI design system
The app uses the dark theme of the Training UI design system (`training-ui/` at the repo root; tokens in `training-ui/tokens.css`). `styles/partials/_training.scss` maps it onto the kit's semantic tokens (`--color-*`) and Onest. `PhoneFrame` includes it on `.device`, so every screen inside the phone gets it and `/ui-kit` keeps the base kit look. Rules from `training-ui/README.md` that apply here:
- Text on filled colors uses `--color-onAccent` / `--color-onSuccess` / `--color-onDanger`, never `#fff`: white on volt is unreadable.
- At most one volt (primary) button per screen. Repeated list actions use `secondary`.
- The AI coach's voice uses `--color-coach` / `--color-coachSoft`.
- Copy has no exclamation marks, and there are no sparkles on AI.
