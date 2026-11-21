# AI in trainer-voice notifications

## Why AI is essential here
A notification like "go to the gym" is the same fact for every user; what makes it work is **voice**. The app has five trainers (Mike blunt, John supportive, Hanna and Caroline warm, Alex neutral) with a written tone of voice (`tov`) stored in the database. Writing a fresh, in-character line for each situation (missed workout, streak at risk, new badge, weekly recap) is free text generation: templates would repeat every week and cannot hold five personalities. Gemini writes the text; everything else is deterministic code.

## Technique and why not an agent or RAG
- **Grounded generation with structured facts.** The app derives the facts itself (`deriveNotifications`: workout title, days missed, streak weeks, goal numbers). The model receives only that small typed record plus the trainer's `tov` in the system prompt and acts as a writer, not as a source of truth.
- **No agent or tool loop.** Nothing needs deciding or looking up at generation time: the trigger and the facts are already known. A tool-calling agent would add latency, cost and new failure modes for no gain.
- **No RAG.** There is no document corpus to retrieve from. The only retrieved context is the trainer's `tov`, fetched from the backend by trainer id and placed in the system prompt (a one-row lookup). If coach answers or plans later need knowledge (exercise guides, nutrition), that is where retrieval would be added; the AI plan already constrains the model to an exercise catalog.

## Hallucination and error handling
| Risk | Control |
| --- | --- |
| Invented numbers, names, achievements | Only typed facts go in; prompt says never invent; **runtime guard** (`lib/fit/nudgeGuard.ts`) rejects any number in the text that is not one of the facts (digits or number words) |
| Body shaming, medical advice | Prompt rules plus deny-list in the guard |
| Rambling, emoji, hashtags, quotes | Prompt rules, `cleanNudgeText` (strip, cap 220 chars), guard (max 2 sentences, no emoji or hashtags) |
| No API key | `/api/nudge` answers 503; the template text stays |
| Timeout or Gemini error | 20 s client timeout, answer 502; no retry loop; the template text stays (seen in the browser: a 19 s timeout left the template untouched, no error shown) |
| Guard rejection or empty reply | `writeNudge` returns null, route answers 502, logged as `nudge rejected` with rule ids only (no user data) |
| Offline client | `fetchNudge` returns null; nothing breaks |

The user always sees a correct notification: the deterministic template is created first, the AI text only replaces it when it passes every check.

## Cost model
Model: `gemini-3.5-flash-lite`. Standard paid price (checked at write time on <https://ai.google.dev/gemini-api/docs/pricing>): **$0.30 per 1M input tokens, $2.50 per 1M output tokens** (output includes thinking tokens). Re-check before quoting; the free tier is what the MVP uses.

`cost per nudge = in_tokens x 0.30/1M + out_tokens x 2.50/1M`

- Input: about 220 tokens (rules + trainer `tov` + a few facts). Output: about 45 tokens of text.
- Visible text only: 220 x 0.30/1M + 45 x 2.50/1M = **about $0.00018 per nudge**. If thinking adds about 300 tokens: about $0.0009 worst case.
- Volume control: one request per notification id, stored in app state (`aiText`) so reloads never regenerate; one request in flight at a time; no retries; notifications are limited to a few per day per user (one workout, at most one missed, one streak alert, achievements as earned). A heavy user at 5 per day costs roughly $0.001 to $0.005 per day, about $0.03 to $0.15 per month.
- The optional eval run (`bun run eval:nudge`, 20 cases x 2 calls with the judge) costs well under one cent at these prices, but uses free-tier quota, so it is not part of the test suite or CI.

## Evals
Command (real Gemini calls, not in CI, not run routinely): `cd frontend && GEMINI_API_KEY=... bun run eval:nudge`. It checks the same guard rules the runtime enforces plus an LLM judge for in-character tone and safety, across all five trainers and all six notification kinds, and writes `frontend/evals/results/latest.md`. Offline tests (`tests/nudgeGuard.test.ts`, `tests/nudgeWrite.test.ts`, `tests/nudgeEvalCases.test.ts`) run in the normal suite.

**Latest result: not run yet.** Run the command above and link `frontend/evals/results/latest.md` here.

## Abuse and retries (added after review)

- `/api/nudge` has no login yet, so it is rate limited in memory per client (20 requests a minute, HTTP 429). One nudge per notification is the normal load. This limiter lives in one server process; with several instances put a shared limiter in front.
- A notification whose rewrite failed is marked `aiFailed` and never requested again, also after a reload, so a missing key or a bad model day costs at most one call per notification.
- Workout and badge titles are flattened to one line before they enter the prompt, and replies over 220 characters are rejected (template stays) instead of being cut mid-sentence.
