# Architecture

```
app/                       routes only (page.tsx, layout.tsx, loading.tsx, route handlers)
  api/mock/[...path]/      mock backend (swap for a real one via NEXT_PUBLIC_API_BASE_URL)
  api/ai/                  server route calling Claude/Gemini
  status/                  backend connectivity page (frontend → platform-backend health/ping)
  ui-kit/                  living UI kit page (home `/` renders the same showcase)
components/
  ui/<Name>/               design-system primitives (Name.tsx + Name.module.scss), exported from components/ui/index.ts
  sections/<Name>/         page-level blocks composed from ui/ (Hero, UiKitShowcase…)
  features/<Name>/         domain widgets that own data/behaviour (create when needed)
lib/
  api/                     typed client (client.ts), types + zod schemas (types.ts), mock/ backend, index.ts = `api` object
  api/backend.ts           server-only calls to platform-backend (BACKEND_URL), zod-validated
  ai/                      server-only Claude/Gemini helpers
  query/Providers.tsx      QueryClient + ToastProvider
  validation/              shared zod form schemas
  hooks/                   tiny shared hooks
  fonts.ts, messages.ts
messages/*.json           all user-facing copy (en default, uk; parts/ are merged into en.json)
app/(app)/                 fitness app routes inside the phone shell, see docs/agent/fitness-app.md
lib/fit/, lib/i18n/        fitness domain + store, locale provider
styles/                    globals.scss + partials (tokens, reset, typography, corners, mixins, scrollbar)
scripts/convert-images.mjs image pipeline
tests/                     vitest tests for lib/
```

## Rules
- Flow: `app/route` → `sections/features` → `ui`. `ui` never imports from `sections`/`features`/`lib/api`.
- Server Components fetch on the server when possible (call the API layer directly). Client components use `useQuery` from `@tanstack/react-query` with keys like `["items", page]`.
- Route-level loading: add `loading.tsx` with a `<Thing>Skeleton`. Errors: `error.tsx`.
- New domain: add zod schema + type in `lib/api/types.ts`, an endpoint in `lib/api/index.ts`, a mock handler in `lib/api/mock/`.
- Next 16 has `cacheComponents`-era behavior and generated types (`LayoutProps`, `RouteContext`): run `bunx next typegen` if those types are missing. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
