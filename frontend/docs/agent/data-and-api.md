# Data, API, forms

- Client: `lib/api/client.ts` → `apiFetch(path, zodSchema, init?)` validates every response; errors are `ApiError(status)`.
- Endpoints are exposed as `api.*` in `lib/api/index.ts` (schemas in `types.ts`).
- **Mock backend** under `app/api/mock/[...path]`: `GET /api/mock/items?page=&pageSize=`, `/items/:id`. Add `?delay=800` for latency and `?fail=1` for a 500. Add data in `lib/api/mock/db.ts`, logic in `handlers.ts`, routing in the route file.
- **Switching to the real backend:** set `NEXT_PUBLIC_API_BASE_URL`, adjust `api.*` paths/schemas to match; UI stays unchanged. If auth is needed, add it in `apiFetch` (headers/cookies).
- Client data: `useQuery({ queryKey: [...], queryFn: () => api.x() })`; mutations with `useMutation` + `queryClient.invalidateQueries`; surface failures with `useToast().show(msg, "danger")`.
- Forms: `useForm` + `zodResolver(schema)` (schemas in `lib/validation/schemas.ts`), fields via `register`, errors into the kit's `error` prop. Set `noValidate` on `<form>`.
- Views handle three states: loading (skeleton), empty (EmptyState), error (message + retry).

## platform-backend (monorepo, Docker)
- Server-side calls live in `lib/api/backend.ts` (`server-only`, `BACKEND_URL`, zod schemas, never throws: returns `{ ok }`). Render them from Server Components, e.g. `components/sections/BackendStatus` on `/status`.
- `next.config.ts` rewrites `/api/*` to the backend as a **`fallback`** rewrite. Do not change it to `afterFiles`: that shadows the dynamic `app/api/mock/[...path]` route. Static/dynamic handlers in `app/api` always win.
- `output: "standalone"` and `frontend/Dockerfile` (bun build, node runtime) are required by CI/CD; do not remove them. CI runs `typecheck`, `test` and `build` for the frontend.
