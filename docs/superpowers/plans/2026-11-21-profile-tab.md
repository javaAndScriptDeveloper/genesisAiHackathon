# Profile Tab, Trainers, Goal Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Profile the 5th (rightmost) bottom tab with a Go Premium banner and a gear that opens Settings, where the user changes their training goal (typed or spoken) and their AI trainer; trainers live in Postgres and are served by platform-backend.

**Architecture:** Trainers = backend (Postgres table seeded on boot, `GET /api/trainers`, reached from the browser through the existing `/api/*` fallback rewrite). The selected trainer id and goal text are frontend state (`FitState`, localStorage), because the app has no accounts. Voice goal = browser `MediaRecorder` → Next route `/api/stt` → Gemini transcription (free tier key). Typed or spoken goal text → Next route `/api/goal` → Gemini maps it to the existing `Goal` enum so plan generation keeps working.

**Tech Stack:** Fastify 5 + `pg` + Knex (migrations) + Objection (models) + Vitest/Testcontainers (backend); Next.js App Router, TypeScript strict, SCSS Modules, react-query, zod, `@google/genai`, Vitest, bun (frontend).

**Spec:** No separate design doc; the requirements are the user's messages in this session (summarized under Global Constraints). Read `frontend/AGENTS.md` and `frontend/docs/agent/{architecture,ui-kit,data-and-api,ai-utils}.md` before frontend work.

## Global Constraints

- **Scope: only the Profile screen, the Settings screen (opened by the gear on Profile) and what they need underneath (trainers backend, state, two server routes).** Do not change Today, Training, Progress, Coach, Onboarding, Notifications, Subscription, AppShell or any other screen. Existing Settings cards (language, reminders, data) stay as they are; the new Goal and Trainer cards are added above them. The only shared file touched is `BottomNav` (adds the Profile tab). No legal/About pages.

- Profile is the **last** tab in `BottomNav`; the Profile screen shows a **Go Premium** banner (like the reference screenshot: full-width accent button with crown) and a **gear at top right** that opens `/settings`.
- Premium purchase = existing demo flow at `/subscription` (no billing). Banner hidden when `subscription.tier === "premium"`.
- Settings lets the user change **goal** (text input or voice) and **trainer**.
- Exactly **5 trainers**, stored in the DB: each has `id`, `name`, `icon_path`, `description` (character / tone of voice, TOV): **Mike** (angry, harsh-truth), **John** (supportive), **Hanna** and **Caroline** (female, similar to each other: warm, encouraging), **Alex** (non-binary).
- Icons are generated dummy images under `frontend/public/trainers/<id>.svg`; `icon_path` is `/trainers/<id>.svg`.
- STT and goal parsing use Gemini via `GEMINI_API_KEY` (free-plan key), server-side only.
- Frontend rules: bun only; no `any` / `@ts-ignore`; zod for external data; Server Components by default; all UI text in `messages/parts/*.json` (edit parts, then `node scripts/build-messages.mjs`; never edit `messages/en.json`); Hugeicons via `components/ui/Icon`; kit components, tokens only, radii via `corners` mixins; one light theme.
- Hackathon MVP: no new dependencies except `knex` and `objection` (backend); no accounts, no sync of trainer/goal to the backend.
- Commits: subject ≤72 chars, imperative, body explains why, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Backend restarts / redeploys: migrating and seeding twice must not duplicate rows or fail (idempotent).
- Persisted state from before this change (no `trainerId`, no `goalText`): app must load and show the default trainer (`john`), not crash.
- Empty or whitespace-only goal text: Save disabled, nothing dispatched.
- Gemini returns junk or a goal outside the enum: goal parser returns `null`, UI keeps the current goal and says so.
- Microphone denied / unsupported / audio too large or non-audio upload: user sees a toast, `/api/stt` answers 4xx, nothing is saved.

---

## File Structure

| File | Responsibility |
|---|---|
| `platform-backend/src/db.ts` (new) | `createDb`, `migrate` (Knex) |
| `platform-backend/src/migrations/20261121_create_trainers.ts` (new) | trainers table |
| `platform-backend/src/trainers.ts` (new) | `Trainer` type, `TRAINER_SEED`, `seedTrainers`, `listTrainers` |
| `platform-backend/src/app.ts` (mod) | `buildApp(db: Knex)`, add `GET /api/trainers` |
| `platform-backend/src/server.ts` (mod) | migrate + seed before listen |
| `platform-backend/test/trainers.test.ts` (new) | endpoint + idempotency tests |
| `frontend/public/trainers/*.svg` (new) | 5 dummy avatars |
| `frontend/lib/fit/types.ts`, `seed.ts`, `store/reducer.ts` (mod) | `trainerId`, `goalText`, actions |
| `frontend/lib/api/trainers.ts` (new) | zod schema, `fetchTrainers`, `useTrainers` |
| `frontend/lib/fit/goalParse.ts` (new) | `parseGoalReply` pure function |
| `frontend/lib/ai/gemini.ts` (mod) | `transcribeAudio`, `classifyGoal` |
| `frontend/app/api/stt/route.ts`, `app/api/goal/route.ts` (new) | server routes |
| `frontend/lib/hooks/useVoiceRecorder.ts` (new) | MediaRecorder hook |
| `frontend/components/features/BottomNav/BottomNav.tsx` (mod) | 5th tab |
| `frontend/components/features/Profile/Profile.tsx` (mod) | gear, premium banner, trainer card |
| `frontend/components/features/Settings/{GoalCard,TrainerCard}.tsx` (new), `Settings.tsx` (mod) | goal + trainer UI |
| `frontend/messages/parts/{shell,secondary}.json` (mod) | copy |
| `deploy/compose.prod.yml`, `.github/workflows/ci.yml`, `frontend/.env.example`, `CLAUDE.md` (mod) | `GEMINI_API_KEY` plumbing |

---

### Task 1: Backend Knex + Objection setup, trainers migration, seed, endpoint

**Files:**
- Create: `platform-backend/src/db.ts`, `platform-backend/src/migrations/20261121_create_trainers.ts`, `platform-backend/src/trainers.ts`, `platform-backend/test/trainers.test.ts`
- Modify: `platform-backend/package.json` (add `knex` and `objection` dependencies; `pg` is already there), `platform-backend/src/app.ts`, `platform-backend/src/server.ts`, `platform-backend/test/health.test.ts`

**Interfaces:**
- Produces:
  - `createDb(connectionString: string): Knex` (config spreads objection's `knexSnakeCaseMappers()` so `iconPath` ↔ `icon_path`) and `migrate(db: Knex): Promise<void>` in `db.ts` (`migrate` = `db.migrate.latest()` with `directory` resolved from `import.meta.dirname` + `"migrations"` and `loadExtensions: [".js", ".ts"]`, so it works from `dist/` in Docker and from `src/` under Vitest).
  - `interface Trainer { id: string; name: string; iconPath: string; description: string }`; `class TrainerModel extends Model` (`static tableName = "trainers"`, fields `id, name, iconPath, description, sortOrder`); `TRAINER_SEED: Trainer[]` (order: mike, john, hanna, caroline, alex); `seedTrainers(db: Knex): Promise<void>`; `listTrainers(db: Knex): Promise<Trainer[]>`.
  - `buildApp(db: Knex): FastifyInstance` (replaces the old `Queryable` parameter; health now runs `db.raw("SELECT 1")`).
  - HTTP `GET /api/trainers` → `{ trainers: Trainer[] }` (camelCase keys).

- [ ] **Step 1: Add the dependencies:** `cd platform-backend && npm install knex objection`. Check `Dockerfile` still builds (migrations are compiled by `tsc` into `dist/migrations`; if the build only copies selected files, copy that folder too).
- [ ] **Step 2: Write failing tests.** `test/trainers.test.ts` (Testcontainers as in `health.test.ts`, one `createDb` per suite):
  - `GET /api/trainers returns the 5 seeded trainers in order`: after `migrate(db)` + `seedTrainers(db)`, names equal `["Mike","John","Hanna","Caroline","Alex"]`; every trainer has non-empty `description` and `iconPath` matching `/^\/trainers\/[a-z]+\.svg$/`.
  - `migrate and seed are idempotent`: run both twice, `db("trainers").count()` is 5.
  - `GET /api/trainers returns 503 when the database fails`: `createDb("postgres://x:x@127.0.0.1:1/x")` → status 503, body `{ error: "trainers unavailable" }`.
  Update `health.test.ts` to build the app from `createDb(container.getConnectionUri())` and use the same unreachable-DB knex for the 503 case.
- [ ] **Step 3: Run** `npm test` (needs Docker). Expected: FAIL, modules missing.
- [ ] **Step 4: Implement.**
  - Migration `up`: `createTable("trainers")` with `id` text primary key, `name` text not null, `icon_path` text not null, `description` text not null, `sort_order` integer not null; `down`: `dropTable`.
  - `seedTrainers`: `TrainerModel.query(db).insert(rows).onConflict("id").merge()` of all seed rows (add `sortOrder` from array index), so edited TOV text propagates on every deploy without a new migration.
  - `listTrainers`: `TrainerModel.query(db).orderBy("sortOrder")`, return plain `Trainer` objects (`toJSON()`-free: pick the four fields).
  - `app.ts`: health via `db.raw`, new route with try/catch (on error log and `reply.code(503).send({ error: "trainers unavailable" })`).
  - `server.ts`: `const db = createDb(url); await migrate(db); await seedTrainers(db);` before `app.listen`; shutdown calls `db.destroy()`.
  - Seed descriptions (2–3 sentences each; these are the future LLM tone-of-voice briefs):
    - Mike: blunt, no sugar-coating, tells hard truths about excuses, short sentences, a bit of sarcasm, never insults the person's body, safety warnings stay serious.
    - John: supportive big-brother, celebrates small wins, patient, "we" language.
    - Hanna: warm, encouraging, gentle humour, focuses on consistency and feeling good.
    - Caroline: warm and encouraging like Hanna but calmer and more structured; explains the why behind each step.
    - Alex: non-binary, easygoing and curious, neutral language, asks reflective questions, adapts to the user's mood.
- [ ] **Step 5: Run** `npm test && npm run build`. Expected: all PASS, no TS errors.
- [ ] **Step 6: Commit** `Add Knex migrations and trainers table with seed and endpoint`. Body: more tables are coming, so schema changes go through migrations rather than boot-time DDL.

---

### Task 2: Dummy trainer avatars

**Files:** Create `frontend/public/trainers/{mike,john,hanna,caroline,alex}.svg`

- [ ] **Step 1:** Each SVG is 256×256, rounded-square background in a distinct flat colour (Mike deep red `#B3261E`, John blue `#2F6FED`, Hanna pink `#E5739A`, Caroline teal `#1F9E8F`, Alex purple `#7E57C2`), a simple circle head + shoulders silhouette in white, with a tiny distinguishing feature (Mike: furrowed brows lines, John: smile, Hanna/Caroline: different hair shapes, Alex: short asymmetric hair). Include `<title>` with the trainer name. Dummy art, SVG is deliberate (exception to the WebP rule, noted in the file comment of `lib/api/trainers.ts`).
- [ ] **Step 2: Verify** `ls frontend/public/trainers | wc -l` prints `5`; open one in the browser later in Task 5.
- [ ] **Step 3: Commit** `Add dummy trainer avatars`.

---

### Task 3: Trainer and goal text in app state

**Files:**
- Modify: `frontend/lib/fit/types.ts` (`Profile.goalText?: string`; `FitState.trainerId: string | null`), `frontend/lib/fit/seed.ts` (`emptyState` → `trainerId: null`), `frontend/lib/fit/store/reducer.ts`
- Test: `frontend/tests/fit.test.ts`

**Interfaces:**
- Produces: `Action` gains `{ type: "set-trainer"; trainerId: string }` and `{ type: "set-goal"; goal: Goal; goalText: string; today: ISODate }`; `export const DEFAULT_TRAINER_ID = "john"` in `lib/fit/options.ts`; helper `activeTrainerId(state: FitState): string` returning `state.trainerId ?? DEFAULT_TRAINER_ID`.
- `set-goal` must behave exactly like `update-profile` with `{...profile, goal, goalText}` (so `rebuildUpcoming` runs); no-op if `state.profile` is null.

- [ ] **Step 1: Write failing tests** (reducer, in `tests/fit.test.ts` following its existing style): `set-trainer stores the id`; `set-goal updates goal and goalText and rebuilds upcoming workouts` (start from a seeded state with a profile, assert `profile.goal === "build-muscle"`, `goalText === "bench 100 kg by June"`, and that planned workouts after `today` were regenerated, i.e. differ from before or equal `generatePlan(newProfile, today, 4)` tail); `set-goal is a no-op without a profile`; `activeTrainerId falls back to john for old persisted state` (state with `trainerId` undefined cast via `emptyState()` spread, no `as` on unrelated types: build with `{ ...emptyState(), trainerId: null }`).
- [ ] **Step 2: Run** `cd frontend && bun run test -- fit` (check `package.json` for the exact script). Expected: FAIL.
- [ ] **Step 3: Implement** types, seed, reducer cases, `DEFAULT_TRAINER_ID`, `activeTrainerId`. `loadState` already spreads `emptyState()` under saved data, so old saves get `trainerId: null` for free (this is the Review Focus case; the test above pins it).
- [ ] **Step 4: Run** tests + `bun run lint` + `bunx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `Store selected trainer and free-text goal in app state`.

---

### Task 4: Trainers API client for the frontend

**Files:**
- Create: `frontend/lib/api/trainers.ts`
- Test: `frontend/tests/api.test.ts` (extend)

**Interfaces:**
- Produces: `trainerSchema` (zod: `id`, `name`, `iconPath`, `description` strings), `type Trainer`, `fetchTrainers(): Promise<Trainer[]>` (browser `fetch("/api/trainers")`, parses `{ trainers: [...] }`, throws on non-2xx or schema mismatch), `useTrainers()` (react-query, key `["trainers"]`, `staleTime: Infinity`).

- [ ] **Step 1: Failing test:** `fetchTrainers parses the backend payload` (stub `globalThis.fetch` returning the 5-trainer shape) and `fetchTrainers throws on a malformed payload`.
- [ ] **Step 2: Run** tests, expect FAIL. **Step 3: Implement** following `lib/api/client.ts` conventions. **Step 4:** run tests, expect PASS.
- [ ] **Step 5: Commit** `Add typed trainers client and useTrainers hook`.

---

### Task 5: Profile becomes a tab (premium banner, gear, trainer card)

**Files:**
- Modify: `frontend/components/features/BottomNav/BottomNav.tsx`, `frontend/components/features/Profile/Profile.tsx`, `frontend/messages/parts/shell.json`, `frontend/messages/parts/secondary.json`
- Create: `frontend/components/features/Profile/Profile.module.scss` (only if kit styles cannot express the banner)

**Interfaces:** Consumes `useTrainers`, `activeTrainerId` (Tasks 3–4).

- [ ] **Step 1:** BottomNav: append `{ href: "/profile", key: "profile", icon: UserIcon }` as the last entry in `TABS`; add `"profile": "Profile"` to `fit.nav` in `shell.json`.
- [ ] **Step 2:** Profile screen: remove `back="/today"` (it is a tab now); add `actions` with an `IconButton` (`Settings02Icon`, label `t("fit.profile.openSettings")`) that does `router.push("/settings", { transitionTypes: ["nav-forward"] })`; remove the `settings` row from `LINKS` (gear replaces it, avoids duplicate).
- [ ] **Step 3:** Under the identity card, when `state.subscription.tier !== "premium"`, render a full-width accent `Button` with `CrownIcon` and `t("fit.profile.goPremium")` linking to `/subscription` (`router.push` with `nav-forward`). Use the kit `Button`; if a "premium/gold" variant is missing use `variant="primary"` (do not add colours outside tokens).
- [ ] **Step 4:** Add a "Your trainer" row showing the avatar (`next/image`, `unoptimized` for SVG), name, and first sentence of description, linking to `/settings`; while `useTrainers` loads or fails, render the row with name omitted rather than blocking the page. Show the goal text (`profile.goalText ?? t(goal label)`) in the identity card chips area.
- [ ] **Step 6:** Add copy keys (`fit.profile.openSettings`, `fit.profile.goPremium`, `fit.profile.yourTrainer`) to `secondary.json`; run `node scripts/build-messages.mjs`.
- [ ] **Step 7: Verify** `bun run lint && bun run build`, then start the stack (`docker compose up --build` from repo root, http://localhost:18080) and check in the browser: 5 tabs, Profile rightmost and highlighted, banner navigates to `/subscription`, gear opens `/settings`, trainer row shows an avatar. Banner disappears after activating premium in the demo flow.
- [ ] **Step 8: Commit** `Make Profile the last tab with premium banner and settings gear`.

---

### Task 6: Goal and trainer in Settings (typed goal)

**Files:**
- Create: `frontend/lib/fit/goalParse.ts`, `frontend/app/api/goal/route.ts`, `frontend/components/features/Settings/GoalCard.tsx`, `frontend/components/features/Settings/TrainerCard.tsx`
- Modify: `frontend/lib/ai/gemini.ts`, `frontend/components/features/Settings/Settings.tsx` (render the two cards first), `frontend/messages/parts/secondary.json`
- Test: `frontend/tests/ai.test.ts` (extend; uses `server-only-stub.ts`)

**Interfaces:**
- Produces: `parseGoalReply(raw: string): Goal | null` (accepts JSON `{"goal":"build-muscle"}` possibly wrapped in code fences; returns `null` for invalid JSON or a value not in `GOALS`); `classifyGoal(text: string): Promise<Goal | null>` in `lib/ai/gemini.ts` (Gemini call with `responseMimeType: "application/json"`, system prompt lists the five `GOALS` ids); `POST /api/goal` body `{ text: string (1–500 chars) }` → `{ goal: Goal | null }`; 400 on invalid body, 503 on `AiConfigError`, 502 on provider failure.

- [ ] **Step 1: Failing tests:** `parseGoalReply` accepts plain JSON, fenced JSON, rejects `{"goal":"fly"}`, rejects `not json`, rejects empty string; route: `POST /api/goal` with `{ text: "" }` → 400 (import the handler and call with a `Request`).
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement `goalParse.ts`, `classifyGoal`, route (zod body, same error mapping as `app/api/ai/route.ts`). **Step 4:** run, expect PASS.
- [ ] **Step 5: `GoalCard`** (client): kit `Input`/textarea with the current `goalText ?? ""`, a Save button disabled when `text.trim() === ""`. On save: call `/api/goal`; on `goal` non-null dispatch `set-goal` with it; on `null` or error dispatch `set-goal` keeping `profile.goal` and toast `t("fit.settings.goalKept")`. Success toast `t("fit.settings.goalSaved")`. Show the mic button slot (wired in Task 7).
- [ ] **Step 6: `TrainerCard`** (client): list of `useTrainers()` data as selectable cards (avatar, name, description), selected = `activeTrainerId(state)`; selecting dispatches `set-trainer` and toasts. Loading skeleton / retry text on error using existing kit pieces (`ChoiceList` / `OptionCard` if they fit; check `ui-kit.md` first).
- [ ] **Step 7:** Add copy keys; run `node scripts/build-messages.mjs`.
- [ ] **Step 8: Verify** `bun run test && bun run lint && bun run build`; in the browser with `GEMINI_API_KEY` in `frontend/.env.local`: type "I want to run a half marathon" → goal becomes `endurance`, profile chips update, Today plan regenerates; pick Mike, return to Profile, trainer row shows Mike; reload, choice persists.
- [ ] **Step 9: Commit** `Add goal and trainer pickers to Settings with Gemini goal parsing`.

---

### Task 7: Voice goal input (Gemini STT)

**Files:**
- Create: `frontend/lib/hooks/useVoiceRecorder.ts`, `frontend/app/api/stt/route.ts`
- Modify: `frontend/lib/ai/gemini.ts` (`transcribeAudio`), `frontend/components/features/Settings/GoalCard.tsx`, `frontend/messages/parts/secondary.json`
- Test: `frontend/tests/ai.test.ts`

**Interfaces:**
- Produces: `transcribeAudio(audio: { data: Buffer; mimeType: string }): Promise<string>` (Gemini `inlineData` base64 part + prompt "Transcribe this audio verbatim. Return only the transcript."); `POST /api/stt` multipart field `audio` (Blob) → `{ text: string }`; rejects with 400 if the field is missing, `type` does not start with `audio/`, or size > 5 MB; 503 / 502 as in Task 6. Hook `useVoiceRecorder(): { status: "idle" | "recording" | "unsupported" | "denied"; start(): Promise<void>; stop(): Promise<Blob | null> }`.

- [ ] **Step 1: Failing tests:** `/api/stt` returns 400 for missing `audio`, 400 for `text/plain` blob, 400 for a 5 MB + 1 byte `audio/webm` blob (build `FormData` + `Request`).
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Implement route validation first (before any Gemini call), then `transcribeAudio`. **Step 4:** run, expect PASS.
- [ ] **Step 5: Hook:** `getUserMedia({ audio: true })` + `MediaRecorder`; `status: "unsupported"` when either API is absent, `"denied"` on `NotAllowedError`; stop releases tracks. Prefer `audio/webm`, let the browser pick otherwise and send the blob's real `type`.
- [ ] **Step 6: GoalCard mic:** `IconButton` (`Mic01Icon`) toggles record/stop; on stop upload to `/api/stt`, put returned text into the input (user can edit, then Save). Toasts for unsupported / denied / failure (`fit.settings.micDenied`, `micUnsupported`, `micFailed`); button `aria-pressed` while recording.
- [ ] **Step 7: Verify** `bun run test && bun run lint && bun run build`; browser (needs mic + key): record "I want to lose ten kilos", transcript appears, Save sets `lose-fat`; deny mic permission → toast, input untouched.
- [ ] **Step 8: Commit** `Add voice goal input via Gemini transcription`.

---

### Task 8: Ship `GEMINI_API_KEY` to production

**Files:** Modify `deploy/compose.prod.yml` (frontend `environment: GEMINI_API_KEY: ${GEMINI_API_KEY:-}`), `.github/workflows/ci.yml` (pass `secrets.GEMINI_API_KEY` in the deploy step env and add it to the `.env` printf at line ~96), `frontend/.env.example` (already has it; confirm), `CLAUDE.md` (secrets list + trainers endpoint line).

- [ ] **Step 1:** Make the edits above; keep the key optional (`:-`) so deploy does not fail when unset (goal/voice then return 503 with a readable toast).
- [ ] **Step 2: Tell the user** to add repo secret `GEMINI_API_KEY` (their free-plan key) before pushing to `main`.
- [ ] **Step 3: Verify** `docker compose -f deploy/compose.prod.yml config` (with dummy `IMAGE_PREFIX`, `POSTGRES_PASSWORD`) prints the variable; after deploy, `curl http://37.27.8.181/api/trainers` returns 5 trainers.
- [ ] **Step 4: Commit** `Pass GEMINI_API_KEY to the frontend in production`.

---

## Final verification (before claiming done)

- [ ] `cd platform-backend && npm test && npm run build`
- [ ] `cd frontend && bun run test && bun run lint && bun run build`
- [ ] Local stack walkthrough: Profile tab → premium banner → gear → change goal by text and voice → change trainer → reload, state persisted; `/api/health` still `"db":true`.

## Self-review notes

- Coverage (Task 9 legal/About dropped to keep scope to Profile + Settings): tab + banner + gear (T5), goal text+voice (T6–7), trainers in DB with name/icon/TOV (T1–2), 5 named trainers (T1), settings change of goal+trainer (T6), Gemini free key (T6–8). 
- Names used across tasks: `trainerId`, `goalText`, `set-trainer`, `set-goal`, `DEFAULT_TRAINER_ID`, `activeTrainerId`, `useTrainers`, `classifyGoal`, `parseGoalReply`, `transcribeAudio`; consistent.

## Calls I made (flag if wrong)

- Hanna and Caroline read as female and similar to each other; Alex is non-binary.
- Selected trainer and goal text live in localStorage (no accounts), not in the DB. Only the trainer catalogue is in Postgres.
- The coach is still deterministic: trainer TOV is stored but not yet fed into coach replies (follow-up: use `description` as system prompt for `/api/ai`).
- Typed/spoken goal is mapped to the five existing goal enums via Gemini, so the plan generator is untouched; the original wording is kept as `goalText`.
- Avatars are SVG, not WebP.
