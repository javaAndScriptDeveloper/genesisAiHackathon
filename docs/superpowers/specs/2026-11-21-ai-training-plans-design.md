# AI-built training plans, daily check and trainer chat

Date: 2026-11-21 · Status: approved

## Intent

Hackathon demo of the core promise: **the AI trainer builds your training, from your onboarding answers and your
device statistics, and rebuilds it when you tell it what you want.**

Three moments must work live, in this order:

1. **Plan from data.** After onboarding the AI creates the user's training plan from the onboarding profile and the
   last days of device statistics. No rule-based plan is shown as "the AI plan".
2. **Daily check.** Each day the AI looks at today's statistics (sleep, resting heart rate, HRV, readiness). If they
   are poor, it lightens or swaps today's session and says why in the trainer's voice. If they are fine, it says so.
3. **Talk and recreate.** The user talks to their trainer (Mike, Hanna, ...; each speaks in their own tone of voice).
   When they don't like the plan, they say why; the AI recreates the whole plan with those wishes added.

Data is stored in platform-backend (Postgres, the schema from 2026-11-21) so the demo can show real rows: the user,
their device, each day's statistics and every plan version.

## Goals

- AI-created weekly plan at onboarding; AI-recreated plan from chat; AI daily adjustment of today's session.
- All AI output in the selected trainer's tone of voice (`trainers.tov`).
- Users, devices, daily snapshots and every plan version persisted in the backend tables.
- A demo control to force a "bad night" so the daily check visibly changes today's session on stage.
- Never a blank or broken screen during the demo, even if Gemini is slow, down, or returns garbage.

## Non-goals

- Real Apple Health / Garmin integration (statistics are generated demo data, labelled Demo as today).
- Accounts, login, or syncing one user across browsers/devices. The browser keeps the backend user id.
- Persisting the chat transcript in the backend (it stays in the browser as today).
- Production-grade cost control, rate limiting, or prompt evaluation.

## Anti-goals (failure even if it "works")

- The AI invents exercises that have no video, steps or tips in our library.
- The AI overrides safety: symptom messages ("chest pain", "dizzy") reach the AI, or a bad-statistics day makes a
  session *harder*.
- The user waits on a spinner with no way out, or loses their current plan because a rebuild failed.
- The plan silently ignores onboarding constraints (equipment the user lacks, reported limitations, days per week).

## Constraints

- Frontend state lives in localStorage (`FitState`, `lib/fit/store`); screens read plans from `state.planned`
  (`PlannedWorkout[]`). The workout player, Today, Training, History all depend on that shape and stay unchanged.
- Exercise library is `lib/fit/exercises.ts` (75 exercises, each with equipment and `stresses` limitations;
  `isUsable(exercise, profile)` filters them). It exists only in the frontend.
- Gemini is already wired in the frontend server (`lib/ai/gemini.ts`, `GEMINI_API_KEY` passed in production and CI).
  Default model `gemini-2.5-flash`.
- Backend: Fastify + Knex/Objection, migrations on boot, tests with Testcontainers. Only the frontend is public; the
  browser reaches the backend through the `/api/*` fallback rewrite, Next route handlers reach it via `BACKEND_URL`.
- `users.email` is NOT NULL UNIQUE but onboarding asks no email; `users` stores `dob`, not age.
- Existing safety rule (`docs/agent/fitness-app.md`): symptom keywords pause the session and never change intensity.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| 1 | AI edits the existing rule-based plan with structured changes | Safe and fast, but the AI never *creates* the plan | Rejected by the user: the AI must create the plan |
| 2 | **AI creates the whole plan**, constrained to our exercise library, validated, with the rule-based generator as fallback | Slower per call (seconds) and needs strict validation | **Chosen** |
| 3 | Plan only weekly vs only daily vs both | Daily-only leaves the week empty; weekly-only never reacts to statistics | **Both**: weekly plan + daily check |

Where data lives: browser-only (fastest) vs saved to backend tables. **User chose backend.**

## Design

### Architecture

```
Browser (FitState, localStorage)
  │  POST /api/users ...          ──(fallback rewrite)──►  platform-backend  ──►  Postgres
  │  POST /api/plan, /api/plan/daily, /api/coach  ──►  Next route handlers
  │                                                     │  read stats / trainer, save plans
  │                                                     ├──►  platform-backend (BACKEND_URL)
  │                                                     └──►  Gemini (lib/ai)
```

- **platform-backend is storage and the device emulator.** It knows users, devices, snapshots and plan versions,
  and it generates demo statistics (the "device sync").
- **Next route handlers own the AI.** They have the exercise library, `isUsable`, `estimateMinutes`, the fallback
  generator and the Gemini client, so nothing about exercises is duplicated in the backend. (Builder's call
  confirmed: moving AI into the backend would mean porting the library.)
- **The browser stays the source of truth for the profile and the active plan**, as today. It stores
  `backendUserId` and `backendDeviceId` in `FitState`. Every plan the AI produces is saved as a new
  `user_trainings` row; the browser replaces `state.planned` with it.

### Backend (platform-backend)

One migration: `users.onboarding jsonb NULL` (the full onboarding profile: goal, goalText, equipment, location,
daysPerWeek, durationMin, limitations, limitationNote, wearable). Everything else uses the existing tables.

Endpoints (JSON, validated; ids are numeric DB ids except the trainer, which is the slug):

| Method & path | Does |
|---|---|
| `POST /api/users` | Create user from onboarding: name, gender, dob, weight, height, level (= experience), trainer slug → `trainer_id`, `onboarding`. Email is generated: `demo-<random>@demo.local`. Returns `{ id }`. |
| `PATCH /api/users/:id` | Profile edits and trainer change from Settings (same fields, all optional). |
| `POST /api/users/:id/devices` | `{ title }` (e.g. "Apple Watch", "Garmin", or "Demo device" when the user picked none). Returns `{ id }`. `creds` stays null. |
| `POST /api/users/:id/devices/:deviceId/sync` | Emulates the device pushing data: `{ date, scenario?: "normal" \| "bad-night" }`. Inserts a snapshot for that date (append-only; latest row per date wins). With no scenario, values are deterministic per user + date. Also backfills the previous 6 days if missing, so a new user has a week of history. Returns the snapshot. |
| `GET /api/users/:id/snapshots?days=7` | Latest snapshot per day for the last N days, oldest first. |
| `POST /api/users/:id/trainings` | `{ trainerSlug, planData }` → new row, returns `{ id }`. |
| `GET /api/users/:id/trainings/latest` | Latest plan version (for showing in the demo / recovering). |

Snapshot `data` shape (stored in `user_device_data_snapshots.data`):

```json
{ "date": "2026-11-21", "sleepHours": 7.4, "sleepScore": 82, "restingHr": 58, "hrvMs": 64,
  "steps": 8450, "activeKcal": 420, "readiness": 78, "source": "demo", "scenario": "normal" }
```

Generator: per-user baselines seeded from the user id (resting HR 52–68, HRV 45–85 ms, sleep 6.5–8 h, steps
5k–11k), small day-to-day noise. `bad-night`: sleep 4–5 h, resting HR +8–12 over baseline, HRV −30–40 %,
readiness 25–40. `readiness` is computed from sleep, resting HR vs baseline and HRV vs baseline (0–100).

`plan_data` shape (stored in `user_trainings.plan_data`):

```json
{ "kind": "weekly" | "daily-adjust" | "fallback",
  "createdBy": "ai" | "fallback",
  "inputs": { "profile": {...}, "stats": [ ...last 7 snapshots... ], "wishes": ["no lunges", "more cardio"] },
  "summary": "Trainer's explanation of the plan, in their voice",
  "planned": [ ...PlannedWorkout[] as the frontend uses it... ] }
```

`passed` stays false (it marks a finished plan; not used in this demo).

### AI calls (Next route handlers, `frontend/app/api/...`)

All three: zod-validated input, Gemini with `responseMimeType: "application/json"` and a response schema, 20 s
timeout, output validated in `lib/fit` pure functions, and a fallback that always produces a usable result. The
trainer's `tov` (fetched from the backend by slug) goes into the system prompt. Profile and stats are sent as JSON.

**1. Weekly plan — `POST /api/plan`** `{ userId, profile, trainerSlug, wishes: string[], today }`

- Route fetches the last 7 snapshots from the backend.
- Prompt includes: profile; stats with a short derived summary (avg sleep, resting HR trend, readiness trend);
  wishes; the **list of usable exercises** (id, name, muscle, kind, level, timed) already filtered with
  `isUsable(profile)`; rules (days per week = `profile.daysPerWeek`, session length ≈ `profile.durationMin`,
  recovery days between hard days, respect limitations, low readiness → lighter week start).
- Response schema: one week template: `{ summary, sessions: [{ weekday 0–6, title, focus, exercises:
  [{ exerciseId (enum of usable ids), sets 1–6, reps 3–30 | seconds 15–120, restSec 15–180 }] }] }`.
- Conversion (`lib/fit/aiPlan.ts`, pure): drop unknown/unusable exercises, clamp numbers, enforce the number of
  sessions = daysPerWeek (extra sessions dropped, missing filled from `generatePlan`), weights from
  `startingWeight`, durations from `estimateMinutes` (trim the last blocks if over `durationMin + 10`). The week is
  laid out for 4 weeks from `today` (same horizon as today's generator) with a small progression per week
  (+1 rep or +2.5 % load). Output is `PlannedWorkout[]`.
- If Gemini fails, times out, or fewer than half of the sessions survive validation: fall back to
  `generatePlan(profile, today, 4)` with `createdBy: "fallback"` and a neutral note in the trainer's voice from a
  fixed template.
- Saves the result to `POST /api/users/:id/trainings`; returns `{ planned, summary, createdBy, trainingId }`.

**2. Daily check — `POST /api/plan/daily`** `{ userId, profile, trainerSlug, session: PlannedWorkout | null, today }`

- Route fetches today's snapshot (the browser triggers the device sync just before).
- **The decision is deterministic** (explainable and demo-safe): `readiness >= 60` → no change; `40–59` → lighter;
  `< 40` → recovery. Only the *content* is AI.
- No change: AI writes a one-line note ("Slept well, we go as planned"). Lighter: AI returns the same session with
  lower sets/reps/load or easier variants, never more volume than the original. Recovery: AI builds a short
  mobility/low-intensity session (≤ 30 min) from the usable mobility/cardio exercises.
- Validation as above plus "never harder than the original" (total sets and minutes ≤ original). Fallback: existing
  `applyAdapt(..., { kind: "tired" })` for lighter, `buildAdHocWorkout("mobility")` for recovery.
- Saves the full updated week as a new training version (`kind: "daily-adjust"`). Returns
  `{ status: "unchanged" | "lighter" | "recovery", session, note, stats }`.
- No planned session today: only the note, nothing saved.

**3. Chat — `POST /api/coach`** `{ profile, trainerSlug, plan summary (next 7 days, titles + exercises), stats
summary, messages (last ~12), wishes }`

- Before calling: `isSafetyConcern(text)` → existing safety reply, nothing sent to AI (unchanged behaviour).
- AI replies in the trainer's voice and returns
  `{ reply, rebuild: null | { wishes: string[], profileChanges: {...} | null, summary } }`.
  `rebuild` is set when the user wants something about the plan changed. `wishes` restates *all* current
  preferences (so a later rebuild keeps earlier ones unless the user withdrew them).
- **The chat may change the user's settings** (user decision). `profileChanges` is a partial, zod-validated profile
  with only these fields: `equipment`, `location`, `limitations`, `limitationNote`, `daysPerWeek` (1–6),
  `durationMin` (10–90), `goal`. "I can only train at home", "my knee hurts", "4 days instead of 3", "20-minute
  sessions" become real profile changes, so the exercise list and session count follow them. A change lasts until
  the user changes it back; "this week" is treated the same way (stated in the reply).
- The chat shows the reply; when `rebuild` is set, a button "Recreate my plan" with the summary of changes (settings
  changes listed explicitly, e.g. "Location: gym → home"). Tapping it: update the profile locally (without the rule
  rebuild), `PATCH /api/users/:id`, then `/api/plan` with the new profile and wishes; progress shows in the chat
  ("Hanna is rebuilding your plan…"), then a short message with what changed (sessions/exercises added and removed)
  and the trainer's summary.
- **Recreate is the chat's only plan action.** The AI creates plans; it doesn't patch them. The old quick-fix buttons
  (too hard, shorten, recovery day, remove equipment) are not offered by the AI chat; in-workout adjustments stay on
  the workout screen as today, and bad days are covered by the daily check. (Builder's call, from the user's "the AI
  doesn't edit the plan, it creates it".)
- Fallback when AI is unavailable: the existing regex `coachReply` with its action buttons, so the chat still works.

**Replacing the plan (all three flows).** A new plan replaces only *future planned* sessions (date ≥ today, status
`planned`, not `adHoc`), exactly like today's `rebuildUpcoming`: past, completed, partial, skipped and extra sessions
stay, because History and logs link to them. Onboarding's demo-history switch keeps working; its fake past sessions
are independent of the backend statistics. The backend version stores only the new future sessions in
`planData.planned`. After every weekly rebuild the client re-runs the daily check for today, so a rebuild on a
bad-readiness day can never bring today back to full intensity; "Undo" on the daily card restores today's session as
the new plan had it.

### Frontend changes

- `FitState` gains: `backendUserId`, `backendDeviceId`, `planWishes: string[]`, `planSource: "ai" | "fallback" |
  "rules"`, `planSummary`, `daily: { date, status, note, stats } | null`. Persisted version bumped with a migration
  that defaults them (existing local users get a backend user created lazily on next load).
- **Onboarding finish:** create backend user → device → sync (backfills 7 days) → `/api/plan`. While it runs, the
  existing finish screen shows "Your trainer is building your plan…" with the trainer avatar. If the backend is
  unreachable, onboarding still completes with the rule-based plan (`planSource: "rules"`) and a toast.
- **Daily check:** on app open, once per date (and after a bad-night simulation): sync → `/api/plan/daily` → apply
  to today's session (`adapt-planned`-like reducer action) and show a card on Today: trainer avatar, today's
  statistics (sleep, resting HR, HRV, readiness, labelled Demo), the note, and "Undo" (restores the original
  session) when something changed.
- **Devices screen:** "Demo: simulate tonight" with Normal / Bad night, which re-syncs today and re-runs the check.
- **Coach screen:** AI chat as above; suggested prompts updated to plan-shaping ones ("Fewer leg days", "I can only
  train at home", "More cardio", "Shorter sessions", "My knee hurts").
- **Plan rebuild is free** in this flow (today "Rebuild my plan" is Premium). Builder's call, flagged for review:
  the headline demo feature must not hit a paywall.
- **Settings profile edits** (preferences, goal, trainer) PATCH the backend user and recreate the plan through
  `/api/plan` with the stored `planWishes`, so the plan stays AI-made. Saving shows the same "rebuilding" state; if the
  AI or backend fails, the local rule rebuild runs as today (`planSource: "rules"`). (Builder's call.) The same
  applies to the regex fallback's `remove-equipment` / `avoid-limitation` actions.
- Copy goes through `messages/parts/*.json` as the frontend rules require. AI-generated text is shown as is.

### Testing

- Backend: Vitest + Testcontainers for each endpoint (create/patch user, devices, sync determinism and bad-night
  ranges, snapshots per day, trainings save/latest, 404 for unknown user).
- Frontend: Vitest for the pure parts: AI plan conversion and validation (unknown ids, unusable exercises, clamping,
  session count, duration trimming, "never harder" rule), readiness → status mapping, fallbacks; route handlers with
  Gemini mocked (success, garbage JSON, timeout → fallback, safety message never reaches Gemini).
- Manual demo run on the local stack (`docker compose up`): onboarding → plan, bad night → lighter today, chat
  "no lunges, more cardio" → recreate.

## Left to the builder

- Prompt wording, the exact stats summary text and the fixed fallback note templates.
- Exact Gemini response-schema encoding and the structured-output API shape in `@google/genai`.
- Layout and styling of the Today daily card and the chat rebuild button, within the existing UI kit.
- How progression across the 4 weeks is computed, within "small and safe".
- Endpoint error shapes and internal module layout in the backend.
