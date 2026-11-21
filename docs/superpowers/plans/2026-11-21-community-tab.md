# Community Tab (Gym Buddies) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Gym Bro" screen with a Community tab left of Profile: find gym buddies, send a connection request that shows "Awaiting approval" until approved, and once connected see their results, share photos and chat. Everything is simulated, frontend-only (hackathon MVP).

**Architecture:** Buddies are a fixed sample list in `lib/fit/community.ts` (with fake results and scripted chat replies). Connection, invite time and chats live in `FitState` (localStorage). Approval is time-based and derived (`partners-sync` accepts invites older than 5 s), so it survives navigation and reloads, unlike the old per-component timer. Chat replies are also generated through a reducer action fired by a short timer in the chat screen.

**Tech Stack:** Next.js App Router, TypeScript strict, SCSS Modules, Vitest, bun.

**Spec:** No separate design doc; requirements are the user's messages ("separate tab left to profile… find gym buddy, connect by approval with 'awaiting approval', see their results, share photo, text in chat; fake, hackathon MVP; migrate the existing buddy feature").

## Global Constraints

- Frontend rules from `frontend/AGENTS.md`: bun only; no `any`/`@ts-ignore`/unsafe `as`; all UI text in `messages/parts/*.json` then `node scripts/build-messages.mjs` (never edit `messages/en.json`); kit components; Hugeicons via `components/ui/Icon`; tokens only; Server Components by default.
- Community is the tab immediately left of Profile; tab order: Today, Training, Progress, Community, Profile.
- The old `/partners` screen and the Profile "Gym Bro" row are removed; `/partners` redirects to `/community`.
- Joint-workout scheduling stays (Premium-gated, reuses `joint-workout` action and `fit.partners.*` copy).
- Photos are resized to max 480 px JPEG before being stored; each chat keeps at most 50 messages.
- Commits: subject ≤72 chars, imperative, body explains why, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- State saved before this change (no `chats` / `partnerInvitedAt`): app must load and the Community tab must work.
- Chat history over the cap or full localStorage: oldest messages are dropped; the app must not crash.
- Empty or whitespace-only message with no photo: nothing is sent.
- Non-image file chosen as a photo: user sees an error toast, nothing is sent.
- Leaving the Community screen while an invite or reply is pending: the invite still gets approved later (derived from time), and no state updates run on an unmounted screen.

---

### Task 1: Community domain and state

**Files:**
- Create: `frontend/lib/fit/community.ts`, `frontend/tests/community.test.ts`
- Modify: `frontend/lib/fit/types.ts`, `frontend/lib/fit/seed.ts`, `frontend/lib/fit/store/reducer.ts`

**Interfaces:**
- Produces in `community.ts`: `interface Buddy { id: string; name: string; goal: Goal; days: string; level: number; results: BuddyResults }`; `interface BuddyResults { weeklyWorkouts: number; streakWeeks: number; lastWorkout: { title: string; daysAgo: number }; pr: { exercise: string; kg: number } }`; `BUDDIES: Buddy[]` (maya, leo, sam, plus priya and tom); `ACCEPT_DELAY_MS = 5000`; `MAX_CHAT_MESSAGES = 50`; `buddyReply(buddy: Buddy, sent: { text: string; hasPhoto: boolean }, n: number): string` (deterministic: picks by `n`, a photo-specific line when `hasPhoto`; never empty).
- Produces in `types.ts`: `interface ChatMessage { id: string; from: "me" | "buddy"; text: string; photo?: string; at: string }`; `FitState.partnerInvitedAt: Record<string, string>`; `FitState.chats: Record<string, ChatMessage[]>`.
- Produces actions: `{ type: "partner"; id: string; status: "invited" | "accepted" | null; now?: string }` (existing action, extended: `invited` records `now` in `partnerInvitedAt`; `null` also deletes that buddy's `chats` and `partnerInvitedAt`); `{ type: "partners-sync"; now: string }` (accepts every invited buddy whose invite is at least `ACCEPT_DELAY_MS` old); `{ type: "chat-send"; buddyId: string; message: ChatMessage }` (no-op if `text.trim() === ""` and no `photo`; appends; keeps only the last `MAX_CHAT_MESSAGES`).

- [ ] **Step 1: Write failing tests** in `tests/community.test.ts` (reducer via `reducer`, `emptyState`):
  - `invite stores the time and keeps status invited before 5 s`: dispatch `partner` invited at `t0`; `partners-sync` at `t0+4999ms` → still `invited`.
  - `sync approves the invite after 5 s`: sync at `t0+5000ms` → `accepted`.
  - `sync leaves accepted and never-invited buddies alone`.
  - `removing a connection deletes its chat and invite time`.
  - `chat-send appends and ignores empty messages`: whitespace text without photo → state unchanged (`toBe`); photo-only message accepted.
  - `chat keeps only the last 50 messages`: send 55, length 50, first kept is message 6.
  - `buddyReply is deterministic, non-empty and mentions the photo path differently`: same inputs equal; `hasPhoto` true differs from false; every buddy for n in 0..9 non-empty.
  - `BUDDIES has unique ids and valid goals`.
  - `old saved state without chats loads`: `{ ...emptyState(), ...legacy }` where legacy omits both new fields still has `chats` `{}` (via spread of `emptyState()`).
- [ ] **Step 2: Run** `cd frontend && bun run test -- community`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** types, `emptyState` fields (`partnerInvitedAt: {}`, `chats: {}`), reducer cases and `community.ts`. Buddy replies are short friendly gym-buddy lines (English only, same as coach content).
- [ ] **Step 4: Run** `bun run test && bun run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Add community state: buddies, approval and chats`.

---

### Task 2: Share the image resize helper

**Files:** Create `frontend/lib/fit/image.ts`; modify `frontend/components/features/CheckIns/CheckIns.tsx`.

**Interfaces:** Produces `resizeToDataUrl(file: File, max?: number): Promise<string>` (moved verbatim from CheckIns, default `max = 480`, rejects with `Error("image")` for non-images).

- [ ] **Step 1:** Move the function unchanged into `lib/fit/image.ts` and import it in `CheckIns.tsx` (pure refactor, behavior identical; no new test, covered by build and the existing check-ins UI).
- [ ] **Step 2: Verify** `bun run typecheck && bun run test`. Expected: PASS.
- [ ] **Step 3: Commit** `Extract resizeToDataUrl so chat can reuse it`.

---

### Task 3: Community tab and buddy list

**Files:**
- Create: `frontend/components/features/Community/Community.tsx`, `frontend/app/(app)/community/page.tsx`
- Modify: `frontend/components/features/BottomNav/BottomNav.tsx`, `frontend/components/features/Profile/Profile.tsx` (remove the `partners` link and unused icon import), `frontend/app/(app)/partners/page.tsx` (→ `redirect("/community")`), `frontend/messages/parts/shell.json`, new `frontend/messages/parts/community.json`; delete `frontend/components/features/Partners/Partners.tsx`.

**Interfaces:** Consumes `BUDDIES`, `ACCEPT_DELAY_MS`, actions from Task 1. Produces route `/community` (list) linking to `/community/<id>` (Task 4).

- [ ] **Step 1:** BottomNav: insert `{ href: "/community", key: "community", icon: UserGroupIcon }` before Profile; `fit.nav.community: "Community"`.
- [ ] **Step 2:** `Community` screen (client): header "Community"; on mount and every second while any buddy is `invited`, dispatch `partners-sync` with `new Date().toISOString()`; toast "X approved your request" when a buddy flips to accepted while mounted. Sections in order: **Connected** (card per buddy → link to `/community/<id>`, shows level and last result line), **Awaiting approval** (card with `Awaiting approval` warning badge and a Cancel button), **Find gym buddies** (card with name, goal, usual days, level, `Connect` button that dispatches `partner` invited with `now`). Empty sections are hidden. Keep the demo notice ("sample people for the demo").
- [ ] **Step 3:** `/partners` redirects; remove Profile row and delete the old `Partners.tsx`; move any reused `fit.partners.*` keys that stay in use (scheduling) untouched; remove only dead keys.
- [ ] **Step 4: Verify** `bun run lint && bun run typecheck && bun run test && bun run build`; browser: 5 tabs with Community left of Profile; Connect → "Awaiting approval" → after ~5 s moves to Connected, also if you switch tabs and come back; Cancel returns to Find.
- [ ] **Step 5: Commit** `Add Community tab with buddy requests and approval`.

---

### Task 4: Buddy screen (results, photo, chat)

**Files:**
- Create: `frontend/components/features/Community/BuddyScreen.tsx`, `frontend/components/features/Community/Community.module.scss`, `frontend/app/(app)/community/[id]/page.tsx`
- Modify: `frontend/messages/parts/community.json`

**Interfaces:** Consumes `BUDDIES`, `buddyReply`, `chat-send`, `resizeToDataUrl`.

- [ ] **Step 1:** Page (server): `export default async function Page({ params }: PageProps<"/community/[id]">)` renders `<BuddyScreen id={id} />`.
- [ ] **Step 2:** `BuddyScreen`: unknown id or not accepted → friendly empty state with a link back to `/community`. Otherwise header with buddy name and back to `/community`, then kit `Tabs`: **Results** (this week's workouts, streak, last workout "title · N days ago", PR using `useUnits().fmtMass`, and the joint-workout scheduling card moved from the old Partners screen, Premium-gated via `PremiumGate`) and **Chat**.
- [ ] **Step 3:** Chat tab: message bubbles (mine right, buddy left) with timestamp, photos shown inline; input + Send button (disabled when empty) and a photo button (hidden `<input type="file" accept="image/*">`). Send dispatches `chat-send` with `from: "me"`, then after 1.2 s dispatches the buddy message from `buddyReply(buddy, {text, hasPhoto}, messagesSoFar)`; the timer is cleared on unmount. Non-image or failed resize shows a danger toast and sends nothing. Scroll to the newest message when messages change.
- [ ] **Step 4: Verify** lint, typecheck, test, build; browser: connect to a buddy, open it, see results; send text → reply arrives; send a photo → appears inline; reload keeps the chat; remove connection clears it.
- [ ] **Step 5: Commit** `Add buddy screen with results, photo sharing and chat`.

---

## Final verification

- [ ] `cd frontend && bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] Browser walkthrough of the Review Focus cases (legacy state, empty message, non-image file, leave and return during approval).

## Calls I made (flag if wrong)

- Approval is automatic after 5 s (simulated); a real backend would replace `partners-sync`.
- Five sample buddies (Maya, Leo, Sam plus Priya and Tom); their results are fixed fake numbers.
- Buddy chat replies are scripted, text only; the user can send photos, buddies do not.
- Removing a connection also deletes the chat.
