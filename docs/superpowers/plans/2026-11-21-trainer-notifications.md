# Trainer-Voice Notifications, Streaks, Achievements and Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifications written by Gemini in the chosen trainer's voice, new streak notifications, streak/level/achievement placement on Today and Progress, and Share buttons (image card plus text) for reports, streaks and achievements.

**Architecture:** `deriveNotifications` and `recordEvents` keep creating deterministic template notifications and now attach a small typed `facts` record. A client hook asks `POST /api/nudge` (Next route, Gemini, trainer `tov` loaded from platform-backend) once per notification id and stores the text as `aiText`; failure leaves the template. Sharing is one `shareCard` helper (canvas PNG plus text, share sheet, clipboard fallback) used by every Share button.

**Tech Stack:** Next.js App Router, TypeScript strict, SCSS Modules, Vitest (node env), bun, `@google/genai`, zod.

**Spec:** `docs/superpowers/specs/2026-11-21-trainer-notifications-design.md`

## Global Constraints

- `frontend/AGENTS.md`: bun only; no `any`/`@ts-ignore`/unsafe `as`; UI copy in `messages/parts/*.json` then `node scripts/build-messages.mjs` (never edit `messages/en.json`); kit components; Hugeicons via `components/ui/Icon`; tokens only; Server Components by default.
- No closed-app push, no social-network API integrations. Gemini text is English only.
- Gemini input is only the typed `NudgeFacts` record, never free user text; a failed or slow Gemini call never blocks the UI or drops a notification.
- Shared text/image contains only the user's own stats and the app name: no name, photo, profile or email.
- Old saved state (no `streak` setting, no `aiText`, no `facts`) must load and behave.
- Commits: subject ≤72 chars, imperative, body explains why, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Saved `notificationSettings.enabled` without a `streak` key: streak notifications are on (missing means on), the settings screen does not crash.
- Gemini key missing, 5xx, timeout, empty or over-long reply: template text stays, no retry loop, no error toast.
- The same notification id is never sent to Gemini twice (reload, re-derive each minute, two tabs of state).
- Model reply with quotes, markdown, emojis or 500 characters: cleaned and capped; empty reply treated as failure.
- No trainer chosen (`trainerId` null): notifications stay as templates, no request is made.
- Share: browser without `navigator.share`, without file sharing, user cancels the sheet (`AbortError`), canvas unavailable: never throws, user sees copied or failed toast only for real failures, not for a cancel.
- Streak at risk fires once per day and not on rest days, not before the reminder time, not after the workout is done.

---

### Task 1: Nudge domain (prompt builder and reply cleaner)

**Files:** Create `frontend/lib/fit/nudge.ts`, `frontend/tests/nudge.test.ts`.

**Interfaces:** Produces in `nudge.ts`:
- `type NudgeKind = "workout" | "missed" | "streak-risk" | "streak" | "achievement" | "weekly-summary"`
- `interface NudgeFacts { title?: string; daysMissed?: number; streak?: number; minutes?: number; done?: number; goal?: number }`
- `const NUDGE_KINDS: readonly NudgeKind[]`
- `buildNudgePrompt(trainer: { name: string; tov: string }, kind: NudgeKind, facts: NudgeFacts): { system: string; prompt: string }` (system holds the trainer's voice plus the hard rules: stay in character, at most 2 short sentences, no emojis or hashtags, no body shaming, no medical advice, use only given facts and never invent numbers or names, reply with the message text only; prompt names the situation and lists the facts)
- `cleanNudgeText(raw: string): string | null` (trims, strips wrapping quotes and markdown markers, collapses whitespace, truncates at a word boundary to 220 chars with no ellipsis added past the cap, returns null for empty)

- [ ] **Step 1: Write failing tests** `tests/nudge.test.ts`: system contains the `tov` text and "2 short sentences" and "never invent"; prompt for `missed` mentions the title and `daysMissed`; each kind in `NUDGE_KINDS` yields a non-empty prompt; `cleanNudgeText('"Move it, now!"')` → `Move it, now!`; markdown `**Go**` → `Go`; 500 chars → length ≤ 220 and no trailing partial word; `"  \n"` → null.
- [ ] **Step 2: Run** `cd frontend && bun run test -- nudge`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** both functions in `lib/fit/nudge.ts` (pure, no imports of server-only code so the client can reuse the types).
- [ ] **Step 4: Run** `bun run test -- nudge && bun run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Add nudge prompt builder and reply cleaner`.

---

### Task 2: Notification state, streak notifications, facts, voice action

**Files:** Modify `frontend/lib/fit/types.ts`, `frontend/lib/fit/seed.ts` (default settings), `frontend/lib/fit/notifications.ts`, `frontend/lib/fit/store/reducer.ts`; create `frontend/tests/notifications-voice.test.ts`.

**Interfaces:**
- Consumes `NudgeKind`, `NudgeFacts` (Task 1).
- Produces: `NotificationKind` gains `"streak"`; `AppNotification` gains `aiText?: string` and `nudge?: { kind: NudgeKind; facts: NudgeFacts }`; `NOTIFICATION_LABELS` and `DEFAULT_NOTIFICATION_SETTINGS.enabled` gain `streak`; action `{ type: "notification-voice"; id: string; text: string }` (sets `aiText` on that id, ignores unknown id and empty text, never overwrites an existing `aiText`); `isVoiced(n: AppNotification): boolean` in `notifications.ts` (true when `n.nudge` is set).
- Streak rules in `deriveNotifications(state, now)`: milestone when `progressOf(state, today).streak.current` is 3, 7, 14 or 30 → id `n-streak-<n>`, kind `streak`, nudge kind `streak`. At risk when `streak.current >= 2` and there is a planned non-ad-hoc workout today still `planned` and the local time of `now` is at or after `reminderTime` → id `n-streak-risk-<today>`, kind `streak`, nudge kind `streak-risk`. Missing `enabled.streak` counts as on: change `push` to `on[n.kind] !== false`.
- Existing notifications get `nudge`: workout → `{kind:"workout", facts:{title, minutes}}`, missed → `{kind:"missed", facts:{title, daysMissed}}`, weekly-summary → `{kind:"weekly-summary", facts:{done, goal}}` from the report numbers already used, badge/level in `recordEvents` → `{kind:"achievement", facts:{title}}`. Recovery, weekly-goal and coach stay template only.

- [ ] **Step 1: Write failing tests** (reducer `reducer`, `deriveNotifications`, fixture states from `emptyState()` with `planned`/`history` built the way `tests/fit.test.ts` does): milestone at streak 7 creates `n-streak-7` once and not at 6; at-risk only with streak ≥ 2, planned workout today, time ≥ reminder; not before reminder time; not when today's workout is done; `enabled` without `streak` key still produces the notification; with `enabled.streak=false` produces none; derived workout/missed notifications carry `nudge` with the facts above; `notification-voice` sets `aiText`, ignores unknown id/empty text and does not overwrite; legacy notification without `nudge`/`aiText` renders (`isVoiced` false).
- [ ] **Step 2: Run** `bun run test -- notifications-voice`. Expected: FAIL.
- [ ] **Step 3: Implement** the type, defaults, derivation, `nudge` on badge/level notifications in `recordEvents`, and the reducer case. Use `progressOf(state, today).streak.current` for the streak (same source as the Today chip).
- [ ] **Step 4: Run** `bun run test && bun run typecheck`. Expected: PASS (existing tests updated only where default settings changed).
- [ ] **Step 5: Commit** `Add streak notifications and voice text to notification state`.

---

### Task 3: `/api/nudge` route

**Files:** Create `frontend/app/api/nudge/route.ts`, `frontend/lib/ai/nudge.ts`, `frontend/tests/nudgeRoute.test.ts`; modify `frontend/lib/api/backend.ts`, `frontend/lib/ai/index.ts`.

**Interfaces:**
- Produces `backend.trainers(): Promise<BackendResult<{ trainers: { id: string; name: string; pathToImage: string; tov: string }[] }>>` in `backend.ts` (zod-parsed like `health`).
- Produces `writeNudge(trainer: { name: string; tov: string }, kind: NudgeKind, facts: NudgeFacts): Promise<string | null>` in `lib/ai/nudge.ts` (builds the prompt with `buildNudgePrompt`, calls `askGemini`, returns `cleanNudgeText(reply)`), re-exported from `lib/ai/index.ts`.
- Route `POST /api/nudge` body (zod, strict): `{ trainerId: string (1–40), kind: NudgeKind, facts: { title?: string (≤80), daysMissed?: int 0–365, streak?: int 0–10000, minutes?: int 0–600, done?: int 0–100, goal?: int 0–100 } }`. Responses: 200 `{ text }`; 400 invalid body; 404 unknown trainer; 502 `{ error }` when Gemini fails or the cleaned text is null; 503 when `AiConfigError`; 503 when the backend is unreachable.

- [ ] **Step 1: Write failing tests** `tests/nudgeRoute.test.ts` (mock `@/lib/ai` `writeNudge` with `vi.mock`, stub `fetch` for the backend trainers call): valid request returns `{text}` and `writeNudge` receives the trainer's `tov`; unknown trainer → 404 and Gemini not called; extra body property or bad kind → 400; `writeNudge` rejecting with `AiConfigError` → 503; rejecting otherwise → 502; resolving `null` → 502; backend down → 503.
- [ ] **Step 2: Run** `bun run test -- nudgeRoute`. Expected: FAIL.
- [ ] **Step 3: Implement** the three pieces, following `app/api/goal/route.ts` error handling.
- [ ] **Step 4: Run** `bun run test && bun run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Add /api/nudge route that writes notifications in the trainer voice`.

---

### Task 4: Client rewrite hook and popup

**Files:** Create `frontend/lib/fit/nudgeClient.ts`, `frontend/lib/fit/store/useTrainerVoice.ts`, `frontend/tests/nudgeClient.test.ts`; modify `frontend/lib/fit/store/FitProvider.tsx` (mount the hook, skip voiced kinds in the existing popup effect), `frontend/lib/fit/notifications.ts` (`showBrowserNotification`).

**Interfaces:**
- Produces `fetchNudge(trainerId: string, nudge: { kind: NudgeKind; facts: NudgeFacts }): Promise<string | null>` (POST `/api/nudge`, null on any non-200, network error or malformed JSON; never throws; `AbortSignal.timeout(25_000)`).
- Produces `pendingVoice(state: Pick<FitState, "notifications" | "trainerId">, tried: ReadonlySet<string>): AppNotification | null` (pure: the newest unread notification with `nudge`, no `aiText`, id not in `tried`, only when `trainerId` is set).
- Produces hook `useTrainerVoice()` (call once inside `FitProvider`): when `pendingVoice` returns one, add its id to a module-level `tried` set, call `fetchNudge`, dispatch `notification-voice` on success. One request in flight at a time, no retry. After success or failure it calls `showBrowserNotification(n, text)` if the user opted in and granted permission and the notification is younger than 60 s. The existing popup effect no longer fires for notifications where `isVoiced(n)`.
- `showBrowserNotification(n: AppNotification, text?: string): void` in `notifications.ts` (uses `new Notification(n.title, { body: text ?? n.body })`, guarded like the current code).

- [ ] **Step 1: Write failing tests** `tests/nudgeClient.test.ts`: `fetchNudge` returns the text on 200; null on 503, on thrown fetch, on non-JSON; request body is `{trainerId, kind, facts}`; `pendingVoice` picks newest unread voiced, skips ids in `tried`, skips ones with `aiText`, skips read ones, returns null with `trainerId` null.
- [ ] **Step 2: Run** `bun run test -- nudgeClient`. Expected: FAIL.
- [ ] **Step 3: Implement** the three pieces and wire the hook into `FitProvider`.
- [ ] **Step 4: Verify** `bun run lint && bun run typecheck && bun run test`. Expected: PASS (known unrelated lint error in `useProgressSync.ts` may remain).
- [ ] **Step 5: Commit** `Rewrite voiced notifications in the trainer voice on the client`.

---

### Task 5: UI placement (Today chips, trainer card, rows, Achievements card)

**Files:** Create `frontend/components/features/ProgressChips/ProgressChips.tsx` (+ `.module.scss`), `frontend/components/features/TrainerNudge/TrainerNudge.tsx` (+ `.module.scss`), `frontend/messages/parts/nudges.json`; modify `components/features/Today/Today.tsx`, `components/features/Notifications/Notifications.tsx` (+ scss), `components/features/Progress/Progress.tsx`.

**Interfaces:** Consumes `useFit`, `progressOf`/existing `stats.streak.current`, level from `progressOf(...).level`, `useTrainers()`, `isVoiced`, `aiText`. Produces:
- `ProgressChips()` in the Today header actions: streak chip (flame icon, number, `aria-label`), level chip; each links to `/progress` (kit `Badge`/link, tokens only).
- `TrainerNudge()` at the top of Today content: shows the newest unread voiced notification (`aiText ?? body`) with the trainer avatar (`next/image` `unoptimized`, as in `TrainerCard`), a Dismiss button (`notification-read`) and an action button to `n.href`; renders nothing when none.
- Notifications screen: voiced rows show the trainer avatar and `aiText ?? body`.
- Progress: "Achievements" card with recent and next badges (`recentBadges`/`nextBadges` from `lib/progress/badges`) linking to the existing Awards route.
- Copy: `fit.nudges.*` keys in `messages/parts/nudges.json` (chip labels, dismiss, open, achievements title and link, streak setting copy).

- [ ] **Step 1:** Implement the components and copy; run `node scripts/build-messages.mjs`.
- [ ] **Step 2: Verify** `bun run lint && bun run typecheck && bun run test && bun run build`. Expected: PASS.
- [ ] **Step 3: Browser** (`docker compose up --build -d`, http://localhost:18080): chips show streak and level and open Progress; a seeded missed workout shows the trainer card with the template, then the Gemini text in the trainer's voice after a moment; dismiss marks it read; notification rows show the avatar; Achievements card opens Awards; with no `GEMINI_API_KEY` the template stays and no error appears.
- [ ] **Step 4: Commit** `Show streak, level, trainer nudges and achievements in the UI`.

---

### Task 6: Share cards and Share buttons

**Files:** Create `frontend/lib/fit/shareCard.ts`, `frontend/tests/shareCard.test.ts`; modify `lib/fit/share.ts`, `components/features/WeeklyReport/WeeklyReport.tsx`, `components/features/Awards/Awards.tsx`, `components/features/Celebration/Celebration.tsx`, `components/features/ProgressChips/ProgressChips.tsx` (or the Progress streak stat), `components/features/Notifications/Notifications.tsx`, `messages/parts/nudges.json`.

**Interfaces:**
- Produces in `shareCard.ts`:
  - `interface ShareCardSpec { headline: string; value: string; line: string }` (e.g. `{headline:"Streak", value:"7", line:"days in a row"}`)
  - `type ShareCaps = { canShare: boolean; canShareFiles: boolean }`
  - `planShare(caps: ShareCaps): "files" | "text" | "copy"` (pure)
  - `renderShareCard(spec: ShareCardSpec): Promise<File | null>` (canvas 1080x1350 PNG named `personal-coach.png`, brand colours from tokens as literal hex, app name at the bottom; null when canvas is unavailable)
  - `shareCard(title: string, text: string, spec: ShareCardSpec): Promise<ShareResult>` (uses `planShare` with `navigator.canShare({ files })`; `"files"` shares text plus the image, `"text"` falls back to `shareText`, `"copy"` copies the text; an `AbortError` from the sheet returns `"shared"` so no toast fires; any other error returns `"failed"`; never throws)
- Produces text builders reusing `t()`: `fit.nudges.shareStreak` (`"{n}-day streak in Personal Coach. Consistency is the whole game."`), `fit.nudges.shareReport` (`"My week: {done} of {goal} workouts done in Personal Coach."`), existing `fit.celebration.shareText` and `fit.awards.shareText` for achievements.
- Share buttons: weekly report screen (uses the report's workouts done and goal), streak (Share button in the streak detail on Progress or in the chips link target), Awards badge sheet and Celebration overlay (replace `shareText` with `shareCard`), and an icon button on voiced `achievement`/`streak` notification rows. Toast copy as today: copied → `fit.common.copied`, failed → `fit.common.shareFailed`.

- [ ] **Step 1: Write failing tests** `tests/shareCard.test.ts`: `planShare` for all four capability combinations (`canShare` false → `copy`; `canShare` true, files false → `text`; both true → `files`); `shareCard` with a stubbed `navigator` where `share` rejects `AbortError` → resolves `"shared"`, rejects other error → `"failed"`, `share` absent and `clipboard.writeText` ok → `"copied"`; `renderShareCard` returns null when `document` is undefined (node env).
- [ ] **Step 2: Run** `bun run test -- shareCard`. Expected: FAIL.
- [ ] **Step 3: Implement** `shareCard.ts` and add the buttons and strings.
- [ ] **Step 4: Verify** `bun run lint && bun run typecheck && bun run test && bun run build`. Expected: PASS.
- [ ] **Step 5: Browser:** on each Share button the card image renders (check via `renderShareCard` in the console and a screenshot of the canvas data URL), Chrome desktop copies text with the "Copied" toast, cancelling the sheet shows no toast.
- [ ] **Step 6: Commit** `Add share cards and Share buttons for reports, streaks and achievements`.

---

### Task 7: AI quality: hallucination guard, optional evals with a recorded result, cost note

Driven by the hackathon criteria the user pasted: AI is essential to the solution, technique fits the problem, evals exist **with their result**, errors and hallucinations are handled, cost is understood.

**Files:** Create `frontend/lib/fit/nudgeGuard.ts`, `frontend/tests/nudgeGuard.test.ts`, `frontend/evals/nudge.eval.ts`, `frontend/evals/cases.ts`, `frontend/evals/report.ts`, `frontend/vitest.eval.config.ts`, `frontend/evals/README.md`, `frontend/tests/nudgeEvalCases.test.ts`, `docs/ai-notifications.md`; modify `frontend/lib/ai/nudge.ts`, `frontend/app/api/nudge/route.ts`, `frontend/package.json` (script `eval:nudge`).

**Interfaces:**
- `nudgeViolations(text: string, facts: NudgeFacts): string[]` in `lib/fit/nudgeGuard.ts` (pure; rules: empty, more than 2 sentences, over 220 chars, emoji, hashtag, a number in the text that is not one of the numeric facts or the same number written as a word 0-12, and body-shaming or medical-advice phrases from a small deny list). Used by both the server (runtime guard) and the evals (single source of truth).
- `writeNudge` runs the guard on the cleaned text and returns null when it has violations, so the route answers 502 and the client keeps the template (a hallucinated number never reaches the user). The route logs `console.warn("nudge rejected", { kind, violations })` with no user data.
- Evals: `EVAL_CASES` and `FIXTURE_TRAINERS` (five trainers with tov copied from `platform-backend/src/trainers.ts`) in `evals/cases.ts`; `evals/nudge.eval.ts` generates with the real `writeNudge`-equivalent (same prompt builder, no guard rejection so violations are measured), asserts `nudgeViolations` is empty, and an LLM judge (`askGemini`, JSON `{ "inCharacter": boolean, "safe": boolean, "reason": string }`) checks tone of voice and safety. `evals/report.ts` writes `evals/results/latest.md` (per-case pass/fail, pass rates for guard and judge, per-trainer in-character rate, median latency, estimated tokens and cost) after a run.
- `vitest.eval.config.ts` includes only `evals/**/*.eval.ts` (60 s timeout, same aliases as the main config); the main config keeps `tests/**/*.test.ts` so `bun run test` never runs evals. Script `"eval:nudge": "vitest run --config vitest.eval.config.ts"`.
- Quota comment at the top of `nudge.eval.ts`, in `cases.ts` and `evals/README.md`: these call the real Gemini API and spend free-tier quota (cases x 2 calls); they are NOT part of the test suite or CI; for the MVP we do not run them routinely; run on demand with `cd frontend && GEMINI_API_KEY=... bun run eval:nudge` (optionally `-t mike`).
- `docs/ai-notifications.md`: why generation fits (tone of voice is free text; facts are structured so the model is only a writer, not a source of truth), why not an agent or RAG here (nothing to retrieve or decide: the app derives facts deterministically; the trainer `tov` is the only retrieved context and it is passed in the system prompt; a tool loop would add cost and failure modes), hallucination controls (typed facts only, rules in the prompt, runtime guard, template fallback, cleaned and capped output), error handling table (no key 503, timeout or error 502, guard rejection 502, offline, all keep the template), cost model (one short call per notification id, about 150 input and 40 output tokens, deduplicated by id and stored, one request at a time, no retries, at most a handful per day per user; table with the model price from the Gemini pricing page checked at write time and the formula so it can be recomputed), and the latest eval result linked.

- [ ] **Step 1: Write failing tests** `tests/nudgeGuard.test.ts`: passes `"Seven weeks straight. Keep it going."` with `streak: 7`; flags 3 sentences, emoji, hashtag, empty, over 220 chars; flags `"12 weeks"` when `streak: 7`; allows `"two days"` with `daysMissed: 2`; flags a deny-list phrase (`"you look fat"`, `"see a doctor"`); and in `tests/nudgeEvalCases.test.ts` (offline, in the main suite): `EVAL_CASES` cover all five trainers and all six kinds, unique ids, every `trainerId` is in `FIXTURE_TRAINERS`. Also update `tests/nudgeRoute.test.ts`: when `writeNudge` returns null because of the guard the route is 502 (already covered) and add a `writeNudge`-level test with a mocked `askGemini` returning `"You have a 12 week streak"` for `streak: 7` → null.
- [ ] **Step 2: Run** `bun run test -- nudgeGuard nudgeEvalCases nudge`. Expected: FAIL.
- [ ] **Step 3: Implement** guard, wire it into `writeNudge` and the route log, then the eval files, config, script, report writer, README and `docs/ai-notifications.md`.
- [ ] **Step 4: Verify** `bun run test` (eval file not executed, no Gemini call), `bun run typecheck`, `bunx vitest list --config vitest.eval.config.ts` lists the cases.
- [ ] **Step 5: Eval result.** The user's criteria require a recorded result and also said evals must not run in the suite or burn quota: ask the user once before spending quota; if they agree, run `bun run eval:nudge` one time, commit `evals/results/latest.md`, and link it from `docs/ai-notifications.md`. Without agreement, commit the doc with the result section marked "not run yet, command: ...".
- [ ] **Step 6: Commit** `Add nudge guard, optional evals and AI cost notes`.

---

## Final verification

- [ ] `cd frontend && bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] Browser walkthrough of the Review Focus cases (no key, legacy settings, no trainer, share cancel).

## Calls I made (flag if wrong)

- Missing `streak` setting means on (old saves keep working and get the new notifications).
- Streak milestones are 3, 7, 14 and 30 days; at-risk needs a streak of 2 or more.
- Personal-record events do not get a notification in this change (only badge and level do, as today).
- One Gemini request at a time and no retry; a failed rewrite is not attempted again until the notification id is new.
- Evals use the real Gemini API as generator and judge, live in `evals/`, are excluded from the main test run and CI. They are not run without the user agreeing, because they spend quota; the hackathon criteria ask for a recorded result, so the user is asked once.
- A runtime guard rejects generated text with invented numbers, emoji, body-shaming or too many sentences; rejected text falls back to the template.
- Share image is generated on the client with canvas; no server rendering and no new dependency.
