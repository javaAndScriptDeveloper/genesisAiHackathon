<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Hackathon Genesis: frontend rules

Frontend starter for a hackathon. Brief and backend are not final, so keep everything small, typed and easy to swap.
**Inspect before building:** read nearby code and `/ui-kit` (`components/sections/UiKitShowcase`) first. Reuse before creating.

## Table of contents (read the part you need)

| Topic | File |
|---|---|
| Folder structure, layering, server vs client | [docs/agent/architecture.md](docs/agent/architecture.md) |
| SCSS, tokens, typography, fonts, corners, breakpoints | [docs/agent/styling.md](docs/agent/styling.md) |
| UI components: list, API conventions, how to add one | [docs/agent/ui-kit.md](docs/agent/ui-kit.md) |
| Icons (Hugeicons) usage and rules | [docs/agent/icons.md](docs/agent/icons.md) |
| Typed API client, mock backend, react-query, forms, validation | [docs/agent/data-and-api.md](docs/agent/data-and-api.md) |
| Claude and Gemini server utilities | [docs/agent/ai-utils.md](docs/agent/ai-utils.md) |
| Images: WebP, @2x, `next/image` | [docs/agent/images.md](docs/agent/images.md) |
| UX, accessibility and product rules | [docs/agent/ux-rules.md](docs/agent/ux-rules.md) |
| Fitness app: domain, state, mock vs real | [docs/agent/fitness-app.md](docs/agent/fitness-app.md) |
| Libraries installed and why | [docs/agent/libraries.md](docs/agent/libraries.md) |
| Hackathon day workflow and checklist | [docs/agent/hackathon-workflow.md](docs/agent/hackathon-workflow.md) |

Superpowers (obra/superpowers) is active for Claude via the plugin and vendored for Codex/GPT in `.agents/skills/` (brainstorming, writing-plans, TDD, debugging, verification…). Use `using-superpowers` first in any session.
Skills (same content in `.claude/skills/` and `.agents/skills/`): `frontend-quality`, `new-component`, `new-page`, `api-integration`, `images`, `hackathon-checklist`.
Design history: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## General rules (always apply)

- **Package manager: bun.** `bun add`, `bun run`, `bunx`. Never npm/yarn/pnpm.
- **Stack:** Next.js App Router (latest), React (latest), TypeScript strict, SCSS Modules. No Tailwind, no CSS-in-JS.
- **TypeScript:** no `any`, no `@ts-ignore`/`@ts-expect-error`, no unsafe `as`. Validate external data with zod.
- **Server Components by default.** Add `"use client"` only at the smallest interactive leaf.
- **Layers:** page → section/feature component → `components/ui` primitive; data only via `lib/api`. No fetching or business logic inside `components/ui`.
- **Components:** each in its own PascalCase folder with a co-located `Name.module.scss`. Reuse an existing UI component; never use a bare native control where a kit component exists.
- **Styles:** rem units (`html { font-size: 62.5% }`), one root class per module, camelCase nested classes, breakpoints 576/768/992/1200 via `mixins.respond`. Radii only via `corners.radius` / `corners.nested` (squircle `corner-shape` is applied by these mixins). Always check nested border radius: a rounded child inside a rounded parent uses `corners.nested($parentRadius, $gap)`. Colors and spacing only from tokens.
- **Fonts:** Inter body, Unbounded for h1 (heavy), Montserrat/Poppins opt-in. Loaded via `next/font` in `lib/fonts.ts`.
- **Icons:** Hugeicons via `components/ui/Icon` (individual named imports). Sport pictograms only: `components/ui/SportIcon` (Tabler). Never emoji or text glyphs as icons.
- **Images:** WebP, @2x when possible, always through `next/image` (`Picture`). Convert with `bun run images`.
- **Copy / i18n:** the app is multilingual, English is the default and source language. All user-facing text lives in `messages/<locale>.json` (`en` plus the languages of Europe, no Russian; add a locale in `lib/i18n/config.ts` and `lib/i18n/loaders.ts`; non-English dictionaries load lazily and fall back to English key by key; fill gaps with `bun --env-file=.env.local scripts/translate-messages.mjs <code>`), read with `useT()` in client components or `t(key, params, locale)` elsewhere; `{name}` interpolation, missing keys fall back to English. Never hardcode UI strings in components. Domain content that is data (exercise library in `lib/fit/exercises.ts`, coach replies in `lib/fit/coach.ts`) is English-only for now and is the next thing to move into message files.
- **Theme:** the base kit (`/ui-kit`) has one light theme. The fitness app uses the Training UI design system (`training-ui/`, `styles/partials/_training.scss`) with a dark/light switch (`useTheme`, `ThemeToggle`, Settings → Appearance), applied on `PhoneFrame`.
- **Forms:** react-hook-form + zod; no browser-native validation; show errors in the kit's own UI.
- **Loading/empty/error:** every data view has a skeleton, an empty state and an error state. Data that can take a while to load or switch (pagination, tabs, filters, search, refetch) MUST show skeletons during the switch, not stale/blank content; skeleton keeps the same layout (columns, row count, heights) so nothing jumps.
- **Destructive actions** always go through `ConfirmDialog`.
- **Secrets:** AI keys only in `.env.local`, used in server code (`lib/ai`, route handlers). Never `NEXT_PUBLIC_` for secrets.
- **Render only what changes:** keep input state local, no re-keying of controls the user is typing in.
- **Verify before claiming done:** `bun run typecheck` and `bun run test`; for UI also open the page and look at it. Do not run a full build/lint unless asked or before finishing a milestone.
- **Docs:** if you make a non-obvious architectural decision, add it to the relevant `docs/agent/*.md`. Repeated user feedback becomes a permanent rule here.
- No git init and no deploy config until the user asks.
