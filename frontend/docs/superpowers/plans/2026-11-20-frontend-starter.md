# Frontend Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hackathon-ready Next.js frontend base with tokens, typography, own minimal UI kit, mock API, Gemini/Claude utilities and agent context.

**Architecture:** App Router, Server Components by default, `use client` only at interactive leaves. UI primitives in `components/ui/<Name>/` with co-located SCSS Modules; data access through a typed `lib/api` layer with a mock adapter swappable for a real backend; LLM calls only server-side in `lib/ai`.

**Tech Stack:** Next (latest stable), React (latest stable), TypeScript strict, Sass, Swiper, @hugeicons/react + @hugeicons/core-free-icons, zod, react-hook-form, @tanstack/react-query, sharp, @anthropic-ai/sdk, @google/genai, Vitest (for lib tests).

**Spec:** `docs/superpowers/specs/2026-11-20-frontend-starter-design.md`

## Global Constraints

- Project root: `/Users/dmitrofedorcenko/Documents/www/AI Hackathon Genesis` (no git init, no deploy config).
- bun (never npm); latest stable Next/React at install time; TypeScript strict, no `any`, no suppressions.
- SCSS Modules only, no Tailwind; one root class per module, camelCase nested selectors, rem units with `html { font-size: 62.5% }`, breakpoints 576/768/992/1200px.
- Radii only via `@include corners.radius(<r>)` / `corners.nested(<parent>, <gap>)`.
- Icons: Hugeicons only (individual imports); no emoji or glyph icons.
- Fonts via `next/font`: Inter (body), Unbounded (h1/display), Montserrat, Poppins; Cyrillic subset included.
- One light theme, no theme/locale switcher; copy in `messages/uk.json`.
- Images: WebP, @2x where possible, via `next/image`.
- Interactive targets at least 4.4rem; visible focus; reduced motion; no native form validation; skeletons for loading; custom confirm dialog for destructive actions.
- API keys only in `.env.local` (server-side), listed in `.env.example`.
- Do not run project-wide lint/test beyond verification steps named here.

## Review Focus

- Missing `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`: AI utilities throw a typed `AiConfigError`, not an opaque crash.
- Mock API latency/failure: `mockApi` can simulate delay and error; UI shows skeleton then an error state.
- Select/Dropdown keyboard use: arrows, Enter, Escape, typeahead; focus returns to trigger.
- Modal with a form focuses the first editable field; ConfirmDialog keeps container focus.
- Table with zero rows and with long cell text: renders empty state and truncates without breaking layout.

---

### Task 1: Scaffold, dependencies, config

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/page.tsx`.

**Interfaces:** Produces: working `bun run dev`, `bun run typecheck`, path alias `@/*` → project root.

- [ ] **Step 1:** Run `bunx create-next-app@latest` into the project root (TypeScript, App Router, no Tailwind, no src dir, alias `@/*`, bun), keeping `docs/`.
- [ ] **Step 2:** `bun add swiper @hugeicons/react @hugeicons/core-free-icons zod react-hook-form @hookform/resolvers @tanstack/react-query sharp @anthropic-ai/sdk @google/genai clsx` and `bun add -d sass vitest`.
- [ ] **Step 3:** Set `strict`, `noUncheckedIndexedAccess` in `tsconfig.json`; add scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `images` (task 9).
- [ ] **Step 4:** `next.config.ts`: `images.formats = ["image/webp"]`, `deviceSizes`/`imageSizes` covering 2x.
- [ ] **Step 5:** Verify `bun run typecheck` passes and `bun run dev` serves `/` (HTTP 200).

### Task 2: Styles foundation

**Files:** Create `styles/globals.scss`, `styles/partials/{_tokens,_reset,_typography,_corners,_scrollbar,_mixins}.scss`, `lib/fonts.ts`; Modify `app/layout.tsx`.

**Interfaces:** Produces: CSS variables (`--color-*`, `--space-*`, `--font-body`, `--font-display`), mixins `corners.radius($r)`, `corners.nested($parent, $gap)` (floor 0.2rem; squircle under `@supports (corner-shape: squircle)` with radius doubled), `mixins.respond($bp)`; `lib/fonts.ts` exports `inter`, `unbounded`, `montserrat`, `poppins` (next/font with `cyrillic`, `latin`, CSS variables).

- [ ] **Step 1:** Define tokens: neutral near-black/white scale, single accent, borders, shadows, radii scale, spacing, z-index, motion durations; Linear/Notion-like restraint.
- [ ] **Step 2:** Reset, typography scale (h1 uses `--font-display` Unbounded heavy weight; body Inter), selection, scrollbar, focus-visible ring, `prefers-reduced-motion`.
- [ ] **Step 3:** Wire fonts and globals in `app/layout.tsx` (`lang="uk"`).
- [ ] **Step 4:** Verify via `bun run dev`: page renders Inter body and Unbounded h1 (check computed font-family in browser/devtools or screenshot).

### Task 3: UI kit batch A (inputs)

**Files:** Create `components/ui/{Button,Input,Textarea,Checkbox,Badge}/{Name.tsx,Name.module.scss}` and `components/ui/index.ts`.

**Interfaces:** Produces: `Button({variant:"primary"|"secondary"|"ghost"|"danger", size:"sm"|"md"|"lg", loading?, iconLeft?, iconRight?, ...ButtonHTMLAttributes})`; `Input`/`Textarea` (forwardRef, `label`, `error`, `hint`; focus = border-color change only, no outline/shadow); `Checkbox({label, checked, onChange})`; `Badge({tone})`. Icon-only controls ≥ 4.4rem.

- [ ] **Step 1:** Implement each component with variants and states (hover, focus-visible, disabled, loading).
- [ ] **Step 2:** Verify `bun run typecheck`, and render them on `/ui-kit` (Task 8).

### Task 4: UI kit batch B (overlays)

**Files:** Create `components/ui/{Select,Dropdown,Modal,ConfirmDialog,Tooltip,Toast}/…`.

**Interfaces:** Produces: `Select<T>({options:{value:T;label:string}[], value, onChange, placeholder, searchable?})` with full keyboard support; `Dropdown({trigger, items})`; `Modal({open, onClose, title, children})` (focuses first editable field); `ConfirmDialog({open, title, description, confirmLabel, onConfirm, onCancel, tone})`; `Tooltip`; `ToastProvider` + `useToast(): {show(message, tone)}`.

- [ ] **Step 1:** Select/Dropdown panels use `corners.nested`; arrows/Enter/Escape/typeahead; focus returns to trigger.
- [ ] **Step 2:** Modal traps focus, closes on Escape/backdrop, restores focus.
- [ ] **Step 3:** Verify keyboard behavior manually on `/ui-kit` and typecheck.

### Task 5: UI kit batch C (data and layout)

**Files:** Create `components/ui/{Table,Tabs,Pagination,Skeleton,Carousel,Icon,Container}/…`.

**Interfaces:** Produces: `Table<T>({columns:{key, header, render?, width?}[], rows:T[], emptyState?, loading?})` (skeleton rows when `loading`, empty state when no rows, text truncation); `Tabs`; `Pagination({page, pageCount, onChange})`; `Skeleton({width, height, radius})`; `Carousel` (Swiper wrapper, props `slides`, `autoplay?`, a11y labels); `Icon({icon})` wrapping `HugeiconsIcon`.

- [ ] **Step 1:** Implement; import Swiper CSS modules inside Carousel only.
- [ ] **Step 2:** Verify typecheck and `/ui-kit` render with zero rows, many rows, long text.

### Task 6: Data layer and mock API

**Files:** Create `lib/api/{client.ts,types.ts,mock/{db.ts,handlers.ts}}`, `lib/api/index.ts`, `lib/query/Providers.tsx`, `lib/validation/schemas.ts`, `app/api/mock/[...path]/route.ts`, `tests/api.test.ts`.

**Interfaces:** Produces: `apiFetch<T>(path, schema: ZodType<T>, init?): Promise<T>` reading `NEXT_PUBLIC_API_BASE_URL` (default `/api/mock`); `mock` handlers supporting `?delay=` and `?fail=1`; `Providers` wraps `QueryClientProvider` and `ToastProvider`.

- [ ] **Step 1:** Test: `apiFetch` rejects with typed `ApiError` when response fails zod parse or `fail=1`.
- [ ] **Step 2:** Run `bunx vitest run tests/api.test.ts` (fail), implement, rerun (pass).
- [ ] **Step 3:** Add example list/detail endpoint (`/items`) used by `/ui-kit` demo table.

### Task 7: AI utilities (Gemini, Claude)

**Files:** Create `lib/ai/{claude.ts,gemini.ts,errors.ts,index.ts}`, `app/api/ai/route.ts`, `tests/ai.test.ts`.

**Interfaces:** Produces: `class AiConfigError`; `askClaude({prompt, system?, model?}): Promise<string>`; `askGemini({prompt, system?, model?}): Promise<string>`; `streamClaude`/`streamGemini` returning `ReadableStream<string>`; route `POST /api/ai` with zod body `{provider:"claude"|"gemini", prompt}`. Models default via env (`CLAUDE_MODEL`, `GEMINI_MODEL`), with current latest defaults.

- [ ] **Step 1:** Test: both functions throw `AiConfigError` when the key env var is unset.
- [ ] **Step 2:** Run (fail), implement, rerun (pass). Mark modules `server-only`.

### Task 8: Pages, `/ui-kit`, messages

**Files:** Create `app/ui-kit/page.tsx`, `components/sections/Hero/…`, `messages/uk.json`, `lib/messages.ts`; Modify `app/page.tsx`.

**Interfaces:** Produces: `t(key: string): string` over `messages/uk.json`; `/ui-kit` shows every component and token (typography scale, colors).

- [ ] **Step 1:** Build `/ui-kit` and a minimal home page using only kit components and messages.
- [ ] **Step 2:** Verify with dev server: `/` and `/ui-kit` return 200, no console errors; check a mobile-width screenshot.

### Task 9: Image pipeline

**Files:** Create `scripts/convert-images.mjs`, `assets-src/.gitkeep`, `public/img/.gitkeep`, `components/ui/Picture/Picture.tsx`.

**Interfaces:** Produces: `bun run images` converts `assets-src/**/*.{png,jpg,jpeg}` to `public/img/<name>.webp` and `<name>@2x.webp` (width doubled source respected, no upscaling); `Picture({src, alt, width, height, priority?})` wrapping `next/image`.

- [ ] **Step 1:** Implement script with sharp; skip files already up to date.
- [ ] **Step 2:** Verify by converting one sample PNG and checking both outputs exist.

### Task 10: Agent context and skills

**Files:** Create `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`), `docs/agent/{architecture,styling,ui-kit,data-and-api,ai-utils,images,ux-rules}.md`, `.claude/skills/<name>/SKILL.md` and mirrored `.agents/skills/<name>/SKILL.md` for: `frontend-quality`, `new-component`, `new-page`, `api-integration`, `images`, `hackathon-checklist`.

**Interfaces:** Produces: short root `AGENTS.md` (rules + index to `docs/agent/*`); each skill has a trigger-focused description and links to the doc it uses.

- [ ] **Step 1:** Write rules adapted from VEZHOR/hub-next/bc-new AGENTS.md (trimmed, own wording): architecture, SCSS, UX safety, skeletons, validation, icons, performance.
- [ ] **Step 2:** Create skills and mirror them to `.agents/skills`.
- [ ] **Step 3:** Verify every doc link in `AGENTS.md` resolves (`ls`).

### Task 11: Superpowers for Claude and Codex

- [ ] **Step 1:** Claude: confirm the superpowers plugin is installed (`~/.claude/plugins/installed_plugins.json`); if not, install from `https://github.com/obra/superpowers` per its README.
- [ ] **Step 2:** Codex/GPT: follow the repo README's Codex install instructions (clone into `~/.codex/superpowers` and link skills), or vendor its `skills/` into `.agents/skills/`.
- [ ] **Step 3:** Verify both locations list the superpowers skills.

### Task 12: Final verification

- [ ] **Step 1:** `bun run typecheck && bunx vitest run` pass; `bun run build` succeeds.
- [ ] **Step 2:** Report to the user what is installed, what is missing (API keys, real brief), and anything skipped.
