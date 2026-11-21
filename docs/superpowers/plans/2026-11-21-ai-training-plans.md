# AI Training Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI trainer creates the user's plan from onboarding + device statistics, adjusts today's session from daily statistics, and recreates the plan from a chat with the trainer; everything is saved in platform-backend.

**Architecture:** platform-backend stores users, devices, daily snapshots (generated demo statistics) and plan versions. Next.js route handlers (`/api/plan`, `/api/plan/daily`, `/api/coach`) call Gemini, validate the output against the exercise library and fall back to the rule-based generator. The browser keeps `FitState` as the source of truth and orchestrates calls through pure, dependency-injected flow functions wrapped in one hook.

**Tech Stack:** Fastify 5 + Knex/Objection + Postgres (Vitest + Testcontainers); Next.js 16 App Router, React 19, zod 4, `@google/genai`, Vitest; bun in `frontend/`, npm in `platform-backend/`.

**Spec:** `docs/superpowers/specs/2026-11-21-ai-training-plans-design.md`

## Global Constraints

- Frontend rules in `frontend/AGENTS.md` apply: bun only; no `any`, no `@ts-ignore`, no unsafe `as`; validate external data with zod; SCSS Modules with tokens; reuse `components/ui` kit; all UI copy in `messages/parts/*.json` then `node scripts/build-messages.mjs` (never edit `messages/en.json` by hand); `"use client"` only on interactive leaves.
- AI keys only server-side (`lib/ai`, route handlers). Gemini model: `process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`. Every Gemini call times out after **20 s**.
- The AI may only use exercise ids from `lib/fit/exercises.ts` that pass `isUsable(exercise, profile)`.
- Ranges: sets 1–6, reps 3–30, seconds 15–120, rest 15–180 s; `daysPerWeek` 1–6, `durationMin` 10–90; plan horizon 4 weeks; recovery session ≤ 30 min.
- Readiness → status: `>= 60` unchanged, `40–59` lighter, `< 40` recovery. A daily adjustment is never harder than the original (total sets and minutes ≤ original).
- Symptom messages (`isSafetyConcern`) never reach Gemini.
- New plans replace only future planned sessions (date ≥ today, status `planned`, not `adHoc`).
- Backend: ESM with `.js` import suffixes, new schema only via a new migration file, JSON in camelCase (snake-case mappers), request validation via Fastify JSON schema (no new deps).
- Plan recreate from chat is free (no `PremiumGate`).

## Review Focus

1. Gemini returns ids outside the list, missing fields, prose instead of JSON, or times out → the user still gets a full plan (fallback), never an error screen. *(Task 5 tests, Task 7 tests)*
2. Backend unreachable (local dev without backend, VPS restart) during onboarding or rebuild → onboarding still finishes with the rule plan; rebuild leaves the current plan untouched. *(Task 11 tests)*
3. A user with demo history or a session already done today recreates the plan → history, completed and today's finished session stay. *(Task 10 tests)*
4. Bad night → recovery today → chat recreate → today must stay recovery, not jump back to full intensity. *(Task 11 test)*
5. A browser with saved state from before this feature (no `backend`, `daily`, `planWishes` fields) → app loads, backend user is created lazily, daily check runs. *(Task 10 + Task 11 tests)*

---

## File Structure

**platform-backend/**
- `src/migrations/20261124_01_add_users_onboarding.ts` — `users.onboarding jsonb NULL`.
- `src/demoStats.ts` — pure demo statistics generator (baselines, scenarios, readiness).
- `src/users.ts` — `registerUserRoutes(app, db)`: users, devices, sync, snapshots, trainings.
- `src/app.ts` — registers the routes.
- `test/demoStats.test.ts`, `test/users.test.ts`.

**frontend/**
- `lib/fit/dailyStats.ts` — `DailyStats`, `Scenario`, `DailyStatus`, `statusForReadiness`, `statsSummary`.
- `lib/fit/aiPlan.ts` — zod schemas for AI output, `buildPlanFromAi`, `buildDailySession`, `fallbackDaily`, `diffPlans`.
- `lib/fit/aiPrompts.ts` — pure prompt builders.
- `lib/fit/backendUser.ts` — `toBackendUser` (profile → backend body).
- `lib/fit/aiFlow.ts` — pure orchestration with injected deps (`ensureBackend`, `rebuildPlan`, `dailyCheck`).
- `lib/fit/aiClient.ts` — browser fetchers (backend via `/api/*` rewrite, Next AI routes).
- `lib/ai/planner.ts` — `askJson` + `generateWeek`, `adjustSession`, `coachChat` (Gemini).
- `lib/api/platform.ts` — server-only backend client for routes (snapshots, trainings, trainer tov).
- `app/api/plan/route.ts`, `app/api/plan/daily/route.ts`, `app/api/coach/route.ts`.
- `lib/fit/types.ts`, `lib/fit/seed.ts`, `lib/fit/store/reducer.ts`, `lib/fit/store/persist.ts` — state.
- `lib/fit/store/useAiPlan.ts` — hook wrapping `aiFlow` with real deps; `components/features/DailyCheck/DailyCheckRunner.tsx` (mounted in AppShell) and `DailyCheckCard`.
- UI: `Onboarding.tsx`, `Today.tsx`, `Devices.tsx`, `Coach.tsx`, `Settings/GoalCard.tsx`, `Settings/TrainerCard.tsx`.
- `messages/parts/ai.json` — all new copy under `fit.ai.*`.
- Tests: `tests/aiPlan.test.ts`, `tests/aiRoutes.test.ts`, `tests/aiFlow.test.ts`, additions to `tests/fit.test.ts`.

---

### Task 1: Backend — onboarding column, users and devices

**Files:**
- Create: `platform-backend/src/migrations/20261124_01_add_users_onboarding.ts`
- Create: `platform-backend/src/users.ts`
- Modify: `platform-backend/src/app.ts`
- Test: `platform-backend/test/users.test.ts`

**Interfaces:**
- Produces (HTTP, camelCase JSON):
  - `POST /api/users` body `{ name: string; gender: string|null; dob: string|null /*YYYY-MM-DD*/; weightKg: number|null; heightCm: number|null; level: string|null; trainerSlug: string|null; onboarding: object }` → `201 { id: number }`. Email generated `demo-<12 hex chars>@demo.local`. Unknown `trainerSlug` → `trainer_id` null.
  - `PATCH /api/users/:id` same fields, all optional → `200 { id }`; `404 { error: "user not found" }`.
  - `POST /api/users/:id/devices` `{ title: string (1..100) }` → `201 { id: number }`; 404 for unknown user.
  - `export function registerUserRoutes(app: FastifyInstance, db: Knex): void` in `src/users.ts`.
- Body fields map: `weightKg → weight`, `heightCm → height`, `trainerSlug → trainer_id` (lookup `trainers.slug`). `numeric` columns come back from pg as strings; don't return them.

- [ ] **Step 1: Write failing tests** in `test/users.test.ts` (Testcontainers setup copied from `test/trainers.test.ts`: migrate + `seedTrainers`):
  - `creates a user with onboarding and trainer` — POST with `trainerSlug: "hanna"` → 201 numeric id; DB row has `email` matching `/^demo-[0-9a-f]{12}@demo\.local$/`, `trainer_id` = id of slug `hanna`, `onboarding.goal === "build-muscle"`, `weight === "80.00"`.
  - `two users get different emails` — two POSTs succeed (unique constraint not hit).
  - `unknown trainer slug stores null` → `trainer_id` null.
  - `rejects a body without name` → 400.
  - `patches fields and trainer` — PATCH `{ weightKg: 78.5, trainerSlug: "mike" }` → row updated, `updated_at` > `created_at`.
  - `patch unknown user` → 404.
  - `creates a device` → 201; device row `user_id` matches; unknown user → 404.
- [ ] **Step 2:** `cd platform-backend && npx vitest run test/users.test.ts` → FAIL (routes missing).
- [ ] **Step 3:** Migration (`up`: `alterTable users add jsonb onboarding nullable`; `down`: drop column). Implement routes with Fastify JSON schemas; PATCH sets `updated_at = now()`. Register in `buildApp`.
- [ ] **Step 4:** `npx vitest run` → all backend tests PASS (incl. existing schema tests: add `onboarding` to the `users` column expectations in `test/schema.test.ts`).
- [ ] **Step 5:** Commit `feat(backend): users and devices endpoints with onboarding column`.

### Task 2: Backend — demo statistics, device sync, snapshots

**Files:**
- Create: `platform-backend/src/demoStats.ts`
- Modify: `platform-backend/src/users.ts`
- Test: `platform-backend/test/demoStats.test.ts`, `platform-backend/test/users.test.ts`

**Interfaces:**
- Produces in `src/demoStats.ts`:
  ```ts
  export type Scenario = "normal" | "tired" | "bad-night";
  export interface DailyStats { date: string; sleepHours: number; sleepScore: number; restingHr: number; hrvMs: number;
    steps: number; activeKcal: number; readiness: number; source: "demo"; scenario: Scenario }
  export interface Baseline { restingHr: number; hrvMs: number; sleepHours: number; steps: number }
  export function baselineFor(userId: number): Baseline;
  export function readinessOf(s: Pick<DailyStats, "sleepHours" | "restingHr" | "hrvMs">, b: Baseline): number;
  export function generateDailyStats(userId: number, date: string, scenario: Scenario): DailyStats;
  ```
  (`tired` is an addition to the spec's two scenarios so the demo can show the "lighter" status too.)
- HTTP:
  - `POST /api/users/:id/devices/:deviceId/sync` `{ date: "YYYY-MM-DD"; scenario?: Scenario }` → `200 { snapshot: DailyStats }`. Inserts today's snapshot (always a new row); for each of the 6 previous dates with no snapshot for this device, inserts a `normal` one. 404 if the device doesn't belong to the user.
  - `GET /api/users/:id/snapshots?days=7` (1..31, default 7) → `{ snapshots: DailyStats[] }`: latest row per `data->>'date'` within the last N dates up to the newest, oldest first.
- Values: PRNG `mulberry32` seeded from a string hash of `${userId}:${date}`. Baseline from a PRNG seeded by `userId`: restingHr 52–68, hrvMs 45–85, sleepHours 6.5–8.0, steps 5000–11000. Per scenario:
  - normal: sleep base ±0.6 h, restingHr base ±3, hrv base ×0.9–1.1, steps ±25 %
  - tired: sleep 5.5–6.0, restingHr base +4..+6, hrv ×0.75–0.85, steps ×0.6–0.8
  - bad-night: sleep 4.0–5.0, restingHr base +8..+12, hrv ×0.6–0.7, steps ×0.4–0.6
  - `sleepScore = round(clamp(sleepHours / 8, 0, 1) * 100)`, `activeKcal = round(steps * 0.045)`; round sleep to 0.1, others to integers.
  - Readiness (pinned so the scenario ranges hold):
    ```ts
    const sleepPart = clamp((s.sleepHours - 4) / 4, 0, 1) * 40;
    const rhrPart = clamp(1 - (s.restingHr - b.restingHr) / 12, 0, 1) * 30;
    const hrvPart = (clamp(s.hrvMs / b.hrvMs, 0, 1.2) / 1.2) * 30;
    return Math.round(sleepPart + rhrPart + hrvPart);
    ```

- [ ] **Step 1: Failing tests** `test/demoStats.test.ts` (pure, no DB):
  - `same user and date give the same stats` (deep equal).
  - `normal readiness is always >= 60` for userIds 1..50 × 10 dates.
  - `tired readiness is 40..59` and `bad-night readiness is < 40` over the same grid.
  - `bad-night sleep is 4..5 h and resting HR is 8..12 above baseline`.
- [ ] **Step 2: Failing tests** in `test/users.test.ts`:
  - `sync backfills a week` — new device, sync `2026-11-21` → `GET snapshots?days=7` returns 7 items, dates `2026-11-15..2026-11-21` ascending, all `source: "demo"`.
  - `bad-night sync replaces today` — sync again with `scenario: "bad-night"` → snapshots still 7, last has `scenario: "bad-night"` and `readiness < 40`; table now has 8 rows (append-only).
  - `sync rejects a device of another user` → 404.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. **Step 5:** Run all backend tests → PASS.
- [ ] **Step 6:** Commit `feat(backend): demo device statistics, sync and snapshots`.

### Task 3: Backend — training versions

**Files:**
- Modify: `platform-backend/src/users.ts`
- Test: `platform-backend/test/users.test.ts`

**Interfaces:**
- `POST /api/users/:id/trainings` `{ trainerSlug: string|null; planData: object }` → `201 { id: number }` (404 unknown user).
- `GET /api/users/:id/trainings/latest` → `{ training: { id: number; trainerSlug: string|null; planData: object; createdAt: string } | null }`.

- [ ] **Step 1: Failing tests:** save two versions → latest returns the second with `trainerSlug: "alex"` and `planData.kind === "daily-adjust"`; user without versions → `{ training: null }`; unknown user POST → 404.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (join trainers for slug). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(backend): save and read training plan versions`.

### Task 4: Frontend — daily stats types, backend user mapping, server backend client

**Files:**
- Create: `frontend/lib/fit/dailyStats.ts`, `frontend/lib/fit/backendUser.ts`, `frontend/lib/api/platform.ts`
- Test: `frontend/tests/aiPlan.test.ts` (new file; later tasks add to it), `frontend/tests/backend.test.ts`

**Interfaces:**
- `lib/fit/dailyStats.ts`:
  ```ts
  export type Scenario = "normal" | "tired" | "bad-night";
  export type DailyStatus = "unchanged" | "lighter" | "recovery";
  export const dailyStatsSchema: z.ZodType<DailyStats>; // mirrors backend DailyStats
  export type DailyStats = { date: string; sleepHours: number; sleepScore: number; restingHr: number; hrvMs: number; steps: number; activeKcal: number; readiness: number; source: "demo"; scenario: Scenario };
  export function statusForReadiness(readiness: number): DailyStatus;
  export function statsSummary(stats: DailyStats[]): string; // e.g. "7 days: avg sleep 7.1 h, resting HR 58→66, HRV 64→41 ms, readiness today 32/100 (bad-night)"; "No device data." when empty
  ```
- `lib/fit/backendUser.ts`:
  ```ts
  export interface BackendUserBody { name: string; gender: string|null; dob: string; weightKg: number; heightCm: number; level: string; trainerSlug: string; onboarding: Omit<Profile, "name"|"age"|"gender"|"heightCm"|"weightKg"|"experience"> }
  export function toBackendUser(profile: Profile, trainerSlug: string, today: ISODate): BackendUserBody;
  ```
  `dob` = today's month-day, year minus `profile.age`; `02-29` becomes `02-28`. `gender: "private"` → null.
- `lib/api/platform.ts` (`import "server-only"`, base `process.env.BACKEND_URL ?? "http://platform-backend:3000"`, 5 s timeout, zod-parsed):
  ```ts
  export async function getSnapshots(userId: number, days: number): Promise<DailyStats[]>; // [] on any failure
  export async function saveTraining(userId: number, trainerSlug: string, planData: PlanData): Promise<number | null>; // null on failure
  export async function getTrainerTov(slug: string): Promise<{ name: string; tov: string }>; // from GET /api/trainers; fallback { name: "Coach", tov: "Friendly, clear and encouraging." }
  export interface PlanData { kind: "weekly" | "daily-adjust" | "fallback"; createdBy: "ai" | "fallback"; inputs: { profile: Profile; stats: DailyStats[]; wishes: string[] }; summary: string; planned: PlannedWorkout[] }
  ```

- [ ] **Step 1: Failing tests:**
  - `statusForReadiness`: 60 → unchanged, 59 → lighter, 40 → lighter, 39 → recovery.
  - `statsSummary([])` → `"No device data."`; with two snapshots contains `"readiness today"` and the last readiness.
  - `toBackendUser` for age 30 on `2026-11-21` → `dob "1996-11-21"`; on `2028-02-29` age 30 → `"1998-02-28"`; `gender "private"` → null; `onboarding` has `goal`, `equipment`, `daysPerWeek` and no `name`.
  - `platform` (fetch stubbed like `tests/backend.test.ts`): `getSnapshots` returns parsed list, `[]` on 500 and on bad shape; `saveTraining` returns id, null when fetch rejects; `getTrainerTov("hanna")` picks the trainer, unknown slug → fallback.
- [ ] **Step 2:** `cd frontend && bun run test` → FAIL. **Step 3:** Implement. **Step 4:** `bun run test && bun run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(fit): daily stats types, backend user mapping and server backend client`.

### Task 5: Frontend — AI output schemas, validation and conversion

**Files:**
- Create: `frontend/lib/fit/aiPlan.ts`
- Modify: `frontend/lib/fit/plan.ts` (export `difficultyOf`, `DAY_PATTERNS` already exported)
- Test: `frontend/tests/aiPlan.test.ts`

**Interfaces:**
```ts
export const aiExerciseSchema = z.object({ exerciseId: z.string(), sets: z.number(), reps: z.number().optional(), seconds: z.number().optional(), restSec: z.number() });
export const aiWeekSchema = z.object({ summary: z.string(), sessions: z.array(z.object({ weekday: z.number().int(), title: z.string(), focus: z.string(), exercises: z.array(aiExerciseSchema) })) });
export const aiSessionSchema = z.object({ note: z.string(), title: z.string(), exercises: z.array(aiExerciseSchema) });
export type AiWeek = z.infer<typeof aiWeekSchema>; export type AiSession = z.infer<typeof aiSessionSchema>;

export function buildPlanFromAi(week: AiWeek, profile: Profile, today: ISODate, weeks?: number /*4*/): { planned: PlannedWorkout[]; valid: boolean };
export function buildDailySession(ai: AiSession, original: PlannedWorkout, status: Exclude<DailyStatus, "unchanged">, profile: Profile): PlannedWorkout | null;
export function fallbackDaily(original: PlannedWorkout, status: Exclude<DailyStatus, "unchanged">, profile: Profile): PlannedWorkout;
export function diffPlans(before: PlannedWorkout[], after: PlannedWorkout[], today: ISODate): { added: string[]; removed: string[] }; // exercise names in the next 7 days
```
Rules for `buildPlanFromAi`:
- Per exercise: drop if `findExercise` is undefined or `!isUsable`; drop duplicates inside a session; clamp sets 1–6, rest 15–180; timed exercises use `seconds ?? reps` clamped 15–120, others `reps ?? 10` clamped 3–30; weight from `startingWeight`.
- Drop sessions with < 2 exercises or weekday outside 0–6; first session per weekday wins; keep the first `daysPerWeek` by weekday.
- `valid` = surviving AI sessions ≥ `Math.ceil(daysPerWeek / 2)`. Missing sessions: take weekdays from `DAY_PATTERNS[daysPerWeek]` not used yet and fill with the rule-built workout for that date from `generatePlan(profile, today, weeks)` (matched by date).
- Trim: while `estimateMinutes(blocks) > durationMin + 10` and blocks > 2, drop the last block.
- Layout: `date = addDays(mondayOf(today), w * 7 + weekday)` for `w` in `0..weeks-1`, skip `date < today`; id `w-${date}` (same scheme as `generatePlan`, so `rebuildUpcoming`-style merging works); status `planned`; `durationMin = estimateMinutes`; `difficulty = difficultyOf(profile, blocks)`; title/focus trimmed to 40 chars.
- Progression in week `w`: non-timed reps without weight `+w`; weights `roundLoad(weight * (1 + 0.025 * w))`; timed `+5 * w` s (re-clamped).

Rules for `buildDailySession`: same exercise filtering/clamping; recovery allows only exercises with kind `mobility` or `cardio`, or muscle `core`, and `estimateMinutes ≤ 30`; lighter requires total sets ≤ original total sets and `estimateMinutes ≤ original.durationMin`; fewer than 2 exercises → null. Keeps `original.id`, `date`, `status`; title from AI (recovery) or original title (lighter).
`fallbackDaily`: lighter → `applyAdapt(original.exercises, { kind: "tired" }, { profile, startIndex: 0 })`; recovery → `buildAdHocWorkout("mobility", original.date, profile)` with `id: original.id`, `adHoc: undefined`.

- [ ] **Step 1: Failing tests** (profile from `tests/fit.test.ts`: home, dumbbells+bench, 3 days, 45 min):
  - `keeps only library exercises the user can do` — AI week mixing a valid id, `"unicorn-press"` and a barbell exercise → only the valid id survives.
  - `clamps numbers` — sets 12 → 6, reps 100 → 30, rest 5 → 15.
  - `lays out 4 weeks on the AI weekdays with w- ids and no past dates`.
  - `fills missing sessions from the rule plan and marks invalid when fewer than half survive` — AI week with 1 good session for 3 days → 3 sessions/week, `valid: false`; with 2 good → `valid: true`.
  - `trims sessions longer than duration + 10`.
  - `progresses reps or load in later weeks`.
  - `buildDailySession` returns null when lighter has more sets than original, and when recovery contains a strength exercise; returns a session with original id otherwise.
  - `fallbackDaily` lighter has total load ≤ original; recovery is mobility and keeps the id.
  - `diffPlans` lists exercise names added and removed in the next 7 days.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `bun run test && bun run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(fit): validate and convert AI plans and daily sessions`.

### Task 6: Frontend — prompts and Gemini planner

**Files:**
- Create: `frontend/lib/fit/aiPrompts.ts`, `frontend/lib/ai/planner.ts`
- Modify: `frontend/lib/ai/index.ts` (export planner)
- Test: `frontend/tests/aiPlan.test.ts`

**Interfaces:**
- `lib/fit/aiPrompts.ts` (pure):
  ```ts
  export interface TrainerVoice { name: string; tov: string }
  export function systemFor(trainer: TrainerVoice): string; // "You are <name>, a personal fitness trainer. Tone of voice: <tov>. ..." + safety: never diagnose, never push through pain
  export function usableExerciseList(profile: Profile): { id: string; name: string; muscle: Muscle; kind: ExerciseKind; level: number; timed: boolean }[];
  export function weekPrompt(i: { profile: Profile; stats: DailyStats[]; wishes: string[] }): string;
  export function dailyPrompt(i: { profile: Profile; stats: DailyStats; status: DailyStatus; session: PlannedWorkout | null }): string;
  export function coachPrompt(i: { profile: Profile; stats: DailyStats[]; wishes: string[]; planSummary: string; messages: { from: "user" | "coach"; text: string }[] }): string;
  ```
  `weekPrompt` states: exactly `daysPerWeek` sessions, weekday 0=Mon, ~`durationMin` minutes, rest days between hard days, respect limitations and wishes, lighter first days when recent readiness < 60; includes `statsSummary`, profile JSON and the usable list. `coachPrompt` explains when to set `rebuild` (user wants anything about the plan changed), that `wishes` restates all current wishes, and which `profileChanges` fields exist.
- `lib/ai/planner.ts` (`server-only`):
  ```ts
  export async function askJson<T>(schema: z.ZodType<T>, o: { system: string; prompt: string; timeoutMs?: number }): Promise<T>; // throws AiConfigError without key; throws Error on timeout / invalid JSON / schema mismatch
  export async function generateWeek(trainer: TrainerVoice, i: Parameters<typeof weekPrompt>[0]): Promise<AiWeek>;
  export async function adjustSession(trainer: TrainerVoice, i: Parameters<typeof dailyPrompt>[0]): Promise<AiSession>;
  export async function coachChat(trainer: TrainerVoice, i: Parameters<typeof coachPrompt>[0]): Promise<CoachAiReply>;
  ```
  `askJson`: `responseMimeType: "application/json"` and `responseJsonSchema: z.toJSONSchema(schema)`; strip code fences like `parseGoalReply`; race against a 20 s timeout (`AbortSignal.timeout` via `config.abortSignal` where supported, else `Promise.race`).
- `CoachAiReply` and its schema live in `lib/fit/aiPlan.ts` (add there):
  ```ts
  export const profileChangesSchema = z.object({ equipment: z.array(z.enum(EQUIPMENT)), location: z.enum(LOCATIONS), limitations: z.array(z.enum(LIMITATIONS)), limitationNote: z.string().max(200), daysPerWeek: z.number().int().min(1).max(6), durationMin: z.number().int().min(10).max(90), goal: z.enum(GOALS) }).partial();
  export const coachAiReplySchema = z.object({ reply: z.string().min(1), rebuild: z.object({ wishes: z.array(z.string()).max(10), profileChanges: profileChangesSchema.nullable(), summary: z.string() }).nullable() });
  export type CoachAiReply = z.infer<typeof coachAiReplySchema>; export type ProfileChanges = z.infer<typeof profileChangesSchema>;
  ```

- [ ] **Step 1: Failing tests:** `usableExerciseList` for an equipment-less profile with `knees` contains no exercise needing equipment or stressing knees; `weekPrompt` contains `"3 sessions"`, every usable id, each wish, and the stats summary; `systemFor` contains the trainer's tov; `coachAiReplySchema` rejects `daysPerWeek: 9` and accepts `rebuild: null`; `askJson` without `GEMINI_API_KEY` rejects with `AiConfigError`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run tests + typecheck → PASS.
- [ ] **Step 5:** Commit `feat(ai): trainer prompts and structured Gemini planner`.

### Task 7: Route — `POST /api/plan`

**Files:**
- Create: `frontend/lib/fit/aiApi.ts` (request/response zod schemas shared by routes and the browser client; Tasks 8–9 add theirs here)
- Create: `frontend/app/api/plan/route.ts`
- Test: `frontend/tests/aiRoutes.test.ts` (mock `@/lib/ai/planner` and `@/lib/api/platform` with `vi.mock`)

**Interfaces:**
- `lib/fit/aiApi.ts` exports `profileSchema` (zod for `Profile`, enums from `lib/fit/options.ts`), `plannedWorkoutSchema`, `planRequestSchema`, `planResponseSchema` and their `z.infer` types `PlanRequest`, `PlanResponse`.
- Body (`planRequestSchema`): `{ userId: number | null; profile: Profile; trainerSlug: string; wishes: string[] (≤10, each ≤200); today: ISODate }`.
- `200 { planned: PlannedWorkout[]; summary: string; createdBy: "ai" | "fallback"; trainingId: number | null }`; `400` on bad body. Never 5xx for AI failures.
- Flow: stats = `userId ? getSnapshots(userId, 7) : []`; trainer = `getTrainerTov(slug)`; try `generateWeek` → `buildPlanFromAi`; if it throws or `!valid` → `generatePlan(profile, today, 4)`, `createdBy: "fallback"`, summary from `fit.ai.fallbackSummary` copy with trainer name (`t(key, { name }, "en")`). If `userId`, `saveTraining(userId, slug, { kind: createdBy === "ai" ? "weekly" : "fallback", createdBy, inputs: { profile, stats, wishes }, summary, planned })`.

- [ ] **Step 1: Failing tests:** AI success → `createdBy "ai"`, `saveTraining` called once with `kind "weekly"` and the wishes; `generateWeek` rejects → `createdBy "fallback"`, sessions = `daysPerWeek` per week, still 200; AI returns only invalid ids → fallback; `userId: null` → no `getSnapshots`/`saveTraining` calls, `trainingId: null`; invalid body → 400.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): AI weekly plan route with fallback and versioning`.

### Task 8: Route — `POST /api/plan/daily`

**Files:**
- Create: `frontend/app/api/plan/daily/route.ts`
- Test: `frontend/tests/aiRoutes.test.ts`

**Interfaces:**
- Schemas `dailyRequestSchema` / `dailyResponseSchema` (+ `DailyRequest`, `DailyResponse`) in `lib/fit/aiApi.ts`.
- Body: `{ userId: number; profile: Profile; trainerSlug: string; session: PlannedWorkout | null; upcoming: PlannedWorkout[]; wishes: string[]; today: ISODate }` (`upcoming` = future planned sessions, used for the saved version).
- `200 { status: DailyStatus; session: PlannedWorkout | null; note: string; stats: DailyStats | null; createdBy: "ai" | "fallback" }`.
- Flow: stats = last item of `getSnapshots(userId, 1)` if its `date === today`, else `status "unchanged"`, `stats: null`, neutral note (`fit.ai.noStats`). `status = statusForReadiness(stats.readiness)`. Unchanged or no session → AI one-line note via `adjustSession` (use only `note`; on failure `fit.ai.dailyFine`), `session: null`, nothing saved. Lighter/recovery with session → `adjustSession` → `buildDailySession`; null or throw → `fallbackDaily` + note `fit.ai.dailyLighter`/`fit.ai.dailyRecovery`, `createdBy "fallback"`. Save `{ kind: "daily-adjust", ..., planned: upcoming with the session replaced }`.

- [ ] **Step 1: Failing tests:** readiness 30 → `status "recovery"`, returned session id equals original id and is ≤ 30 min, `saveTraining` called with `kind "daily-adjust"`; readiness 50 with AI returning more sets than original → fallback lighter, `createdBy "fallback"`; readiness 80 → `session: null`, `saveTraining` not called; no snapshot for today → `stats: null`, `status "unchanged"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): daily readiness check route`.

### Task 9: Route — `POST /api/coach`

**Files:**
- Create: `frontend/app/api/coach/route.ts`
- Test: `frontend/tests/aiRoutes.test.ts`

**Interfaces:**
- Schemas `coachRequestSchema` / `coachResponseSchema` (+ `CoachRequest`, `CoachResponse`) in `lib/fit/aiApi.ts`.
- Body: `{ userId: number | null; profile: Profile; trainerSlug: string; wishes: string[]; planSummary: string (≤4000); messages: { from: "user" | "coach"; text: string (≤600) }[] (1..12, last is user) }`.
- `200 { reply: string; rebuild: CoachAiReply["rebuild"]; safety: boolean }`; `503 { error }` when Gemini is unavailable or fails (client falls back to regex coach); `400` bad body.
- If `isSafetyConcern(last.text)` → `200 { reply: <SAFETY_TEXT joined, as coachReply builds it>, rebuild: null, safety: true }` without calling Gemini.

- [ ] **Step 1: Failing tests:** safety text ("I have chest pain") → `safety: true`, `coachChat` not called; normal message → passes Gemini's `reply` and `rebuild` through; Gemini returns `profileChanges.daysPerWeek: 9` (schema fail → planner throws) → 503; `AiConfigError` → 503.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): AI trainer chat route with safety guard`.

### Task 10: State — new fields, reducer actions, persistence defaults

**Files:**
- Modify: `frontend/lib/fit/types.ts`, `frontend/lib/fit/seed.ts` (`emptyState`), `frontend/lib/fit/store/reducer.ts`, `frontend/lib/fit/store/persist.ts`
- Test: `frontend/tests/fit.test.ts`

**Interfaces:**
- `FitState` adds:
  ```ts
  backend: { userId: number; deviceId: number } | null;
  planWishes: string[];
  planSource: "ai" | "fallback" | "rules";
  planSummary: string | null;
  daily: DailyCheck | null;
  ```
  `export interface DailyCheck { date: ISODate; status: DailyStatus; note: string; stats: DailyStats | null; sessionId: string | null; original: PlannedWorkout | null; undone: boolean }`
- `CoachMessage` adds `rebuild?: CoachAiReply["rebuild"]` (non-null when present).
- Actions:
  - `{ type: "set-backend"; backend: { userId: number; deviceId: number } }`
  - `{ type: "apply-ai-plan"; planned: PlannedWorkout[]; summary: string; source: "ai" | "fallback"; wishes: string[]; today: ISODate }` — merge exactly like `rebuildUpcoming` (extract a shared `mergeUpcoming(state, upcoming, today)`, including `applyProgression` from history); sets `planSummary`, `planSource`, `planWishes`; sets `daily: null` so the check runs again.
  - `{ type: "apply-daily"; check: Omit<DailyCheck, "original" | "undone">; session: PlannedWorkout | null }` — when `session`, replace the planned item with that id and store the previous one in `daily.original`.
  - `{ type: "undo-daily" }` — restore `daily.original`, set `undone: true`.
  - `complete-onboarding` gains optional `ai?: { backend: { userId: number; deviceId: number } | null; planned: PlannedWorkout[]; summary: string; source: "ai" | "fallback" }`; without it `planSource: "rules"`.
  - `update-profile` sets `planSource: "rules"` (it still rebuilds with rules; the AI rebuild follows from the hook).
- `persist.ts`: `loadState` already spreads `emptyState()` defaults; keep `version: 1` (fields are additive). Ensure `emptyState()` has `backend: null, planWishes: [], planSource: "rules", planSummary: null, daily: null`.

- [ ] **Step 1: Failing tests:**
  - `apply-ai-plan keeps history, completed and adHoc sessions` — state from `complete-onboarding` with `demoHistory: true`, mark today's session completed, add an ad-hoc → apply AI plan with a different session on today → completed today stays, ad-hoc stays, past sessions unchanged, future replaced; `planSource "ai"`, wishes stored, `daily null`.
  - `apply-daily replaces the session and undo restores it`.
  - `old saved state without new fields loads with defaults` — `loadState` with `localStorage` stubbed to a pre-feature JSON → `backend null`, `planWishes []`, `daily null`.
  - `complete-onboarding with ai uses the AI plan and stores backend ids`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `bun run test && bun run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(fit): state for AI plans, backend ids and daily check`.

### Task 11: Orchestration — `aiFlow`, browser client, `useAiPlan`

**Files:**
- Create: `frontend/lib/fit/aiFlow.ts`, `frontend/lib/fit/aiClient.ts`, `frontend/lib/fit/store/useAiPlan.ts`
- Test: `frontend/tests/aiFlow.test.ts`

**Interfaces:**
- `lib/fit/aiClient.ts` (browser; zod-parsed; each throws `ApiError` from `lib/api/types` on non-OK):
  ```ts
  createUser(body: BackendUserBody): Promise<number>; patchUser(id: number, body: Partial<BackendUserBody>): Promise<void>;
  createDevice(userId: number, title: string): Promise<number>;
  syncDevice(userId: number, deviceId: number, date: ISODate, scenario?: Scenario): Promise<DailyStats>;
  requestPlan(body: PlanRequest): Promise<PlanResponse>; requestDaily(body: DailyRequest): Promise<DailyResponse>; requestCoach(body: CoachRequest): Promise<CoachResponse>;
  ```
  Request/response types come from `lib/fit/aiApi.ts` (Tasks 7–9).
- `lib/fit/aiFlow.ts` — deps object `AiDeps = typeof aiClient`-shaped, so tests pass fakes:
  ```ts
  export async function ensureBackend(deps: AiDeps, s: { backend: FitState["backend"]; profile: Profile; trainerSlug: string; today: ISODate }): Promise<{ userId: number; deviceId: number } | null>; // creates user + device ("Apple Watch" | "Garmin" | "Demo device" from profile.wearable) + first sync; null on failure
  export async function rebuildPlan(deps: AiDeps, s: { backend; profile; trainerSlug; wishes: string[]; today }): Promise<PlanResponse | null>; // null on failure: caller keeps current plan
  export async function dailyCheck(deps: AiDeps, s: { backend; profile; trainerSlug; planned: PlannedWorkout[]; wishes; today; daily: DailyCheck | null; scenario?: Scenario; force?: boolean }): Promise<{ check: Omit<DailyCheck, "original" | "undone">; session: PlannedWorkout | null } | null>;
  ```
  `dailyCheck` returns null without calls when `daily?.date === today && !force`; otherwise syncs the device (with scenario) then calls `requestDaily` with today's planned session (status `planned`, date today, not adHoc) and future planned sessions as `upcoming`.
- `lib/fit/store/useAiPlan.ts` (`"use client"`): `useAiPlan(): { busy: boolean; rebuild(o?: { profile?: Profile; wishes?: string[] }): Promise<"ai" | "fallback" | "failed">; runDaily(o?: { scenario?: Scenario; force?: boolean }): Promise<void> }`. `rebuild` = `ensureBackend` (dispatch `set-backend` when new) → `patchUser` (ignore failure) → `rebuildPlan` → dispatch `apply-ai-plan` → `runDaily({ force: true })`. `runDaily` also starts with `ensureBackend` (lazy creation for users saved before this feature) and dispatches `apply-daily` with the result. Trainer slug via `activeTrainerId(state)`.

- [ ] **Step 1: Failing tests** with fake deps:
  - `ensureBackend reuses existing ids` (no calls) and `creates user, device and syncs when missing`; `returns null when createUser rejects`.
  - `rebuildPlan returns null when the request fails`.
  - `dailyCheck runs once per date unless forced`.
  - `dailyCheck sends today's session and future sessions, with scenario passed to sync`.
  - `after rebuild on a bad day the forced check runs again` — simulate: `dailyCheck` after `apply-ai-plan` (daily reset to null) calls `requestDaily` again and the resulting session replaces today (use reducer + fakes).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `bun run test && bun run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(fit): AI plan orchestration and client`.

### Task 12: UI — onboarding build, daily card, devices demo control, settings rebuild

**Files:**
- Create: `frontend/components/features/DailyCheck/DailyCheckRunner.tsx`, `frontend/components/features/DailyCheck/DailyCheckCard.tsx` + `DailyCheckCard.module.scss`
- Create: `frontend/messages/parts/ai.json` (all `fit.ai.*` copy for Tasks 7–13), run `node scripts/build-messages.mjs`
- Modify: `components/features/AppShell/*` (mount runner), `Onboarding/Onboarding.tsx`, `Today/Today.tsx`, `Devices/Devices.tsx`, `Settings/GoalCard.tsx`, `Settings/TrainerCard.tsx`

**Interfaces:**
- Consumes: `useAiPlan` (Task 11), actions from Task 10, `DailyCheck`.
- Onboarding (create mode) `submit`: show a building view in place of the step content (trainer `Avatar` + `fit.ai.building` "{name} is building your plan…"); `ensureBackend` → `requestPlan` with `wishes: []`; then `go("/today", { type: "complete-onboarding", ..., ai })`. On any failure or after 25 s: complete without `ai` (rules plan) and toast `fit.ai.buildFailed`. Edit mode: keep `update-profile`, then `rebuild()` in the background.
- `DailyCheckRunner`: when `ready && profile && daily?.date !== today` → `runDaily()` once per date.
- `DailyCheckCard` on Today (above the workout hero): trainer avatar, stats row (sleep h, resting HR, HRV ms, readiness/100) with a `Badge` "Demo", the note, and an "Undo" button when `status !== "unchanged" && !undone`. Skeleton while the first check runs; hidden when `daily` is null after failure.
- Devices: card "Demo: simulate tonight" with `SegmentedControl` Normal / Tired / Bad night and a "Simulate" button → `runDaily({ scenario, force: true })`, toast with the resulting status.
- GoalCard and TrainerCard: after their existing dispatch, call `rebuild()` and show `fit.ai.rebuilding` toast, then `fit.ai.rebuilt` / `fit.ai.rebuildFailed`.

- [ ] **Step 1:** Implement the components and copy; `bun run typecheck && bun run test` → PASS.
- [ ] **Step 2:** Manual check on the local stack (`docker compose up --build`, http://localhost:18080, `GEMINI_API_KEY` in env): complete onboarding → plan appears with AI summary (or fallback toast without a key); Today shows the daily card; Devices → Bad night → Today shows a recovery session and the card offers Undo; Undo restores. Check the backend rows: `docker compose exec db psql -U app -d app -c "select id, plan_data->>'kind', plan_data->>'createdBy' from user_trainings order by id"`.
- [ ] **Step 3:** Commit `feat(ui): AI onboarding plan, daily check card and demo statistics control`.

### Task 13: UI — AI trainer chat with recreate

**Files:**
- Modify: `frontend/components/features/Coach/Coach.tsx` (+ its SCSS if needed), `frontend/lib/fit/coach.ts` (`SUGGESTED_PROMPTS`)
- Test: `frontend/tests/fit.test.ts` (prompt list), manual

**Interfaces:**
- Consumes: `requestCoach`, `useAiPlan().rebuild`, `diffPlans`, `ProfileChanges`, `statsSummary`.
- `send`: unchanged safety path (`isSafetyConcern` → local reply + `safety-stop`). Otherwise `requestCoach` with the last 12 messages, `planWishes`, a plan summary of the next 7 days (title + exercise names per session) and `userId`; on error use the existing `coachReply` (regex) path unchanged. AI replies are stored as `CoachMessage` with `rebuild`.
- Message with `rebuild`: card listing `summary`, each settings change (`fit.ai.change.<field>` with old → new value; use existing option labels `fit.opt.*`) and a primary button "Recreate my plan" (`fit.ai.recreate`), disabled once applied (`appliedAction: "rebuild"`). Tap: if `profileChanges` → `dispatch update-profile` with merged profile; push coach message `fit.ai.rebuildingChat` ("{name} is rebuilding your plan…"); `rebuild({ profile: merged, wishes })`; then coach message with the plan summary plus `diffPlans` ("Added: …", "Removed: …"), or `fit.ai.rebuildFailed` if `"failed"`.
- Regex fallback path: after `coach-apply` of `remove-equipment` or `avoid-limitation`, call `rebuild()` so the plan stays AI-made (spec, Settings section).
- `SUGGESTED_PROMPTS` = `["Fewer leg days", "I can only train at home", "More cardio", "Shorter sessions", "My knee hurts", "How am I progressing?"]`.

- [ ] **Step 1:** Update the prompt-list test in `tests/fit.test.ts` if it asserts the old list; implement; `bun run typecheck && bun run test` → PASS.
- [ ] **Step 2:** Manual: chat "No lunges and more cardio" → reply in the trainer's voice with "Recreate my plan" → tap → progress message → diff message; Training tab shows the new plan; a new `user_trainings` row exists. Chat "I can only train at home" → change card shows "Location: Gym → Home"; recreated plan uses no gym equipment. "I have chest pain" → safety reply, no network call to `/api/coach` (check the Network panel).
- [ ] **Step 3:** Commit `feat(ui): AI trainer chat recreates the plan`.

### Task 14: Docs and full verification

**Files:**
- Modify: `frontend/docs/agent/fitness-app.md` (AI plan flow, fallback, daily check, demo control), `CLAUDE.md` (new backend routes in the Layout line), `docs/deploy.md` only if env changes (none expected).

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `cd platform-backend && npm test` → all PASS; `cd frontend && bun run typecheck && bun run test` → all PASS.
- [ ] **Step 3:** Full demo run on the local stack in order: onboarding → AI plan; Devices → Bad night → recovery today; chat "fewer leg days, more cardio" → recreate → today stays recovery; Settings → change trainer → plan rebuilt in the new voice. Stop Gemini (unset key) and repeat onboarding → rule plan with toast, chat falls back to regex replies.
- [ ] **Step 4:** Commit `docs: AI training plans`.
