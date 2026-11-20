# Hackathon workflow

1. Read the brief; list screens and the primary user action per screen.
2. Define types/zod schemas and mock endpoints first (`lib/api`), so UI work never blocks on the backend.
3. Build screens from `components/ui`; extend the kit only when something repeats.
4. Add skeleton/empty/error states as you go, not at the end.
5. Convert images (`bun run images`), write copy in `messages/uk.json`.
6. Wire the real backend by changing `NEXT_PUBLIC_API_BASE_URL` and `api.*`.
7. Before demo: `bun run typecheck && bun run test && bun run build`, check mobile and keyboard.

Checklist before the event: `.env.local` with AI keys (if used), `bun install` done, `bun run dev` works, `/ui-kit` loads.
