# Hackathon backbone

Minimal monorepo: push to `main` goes live on the VPS.

## Layout
- `platform-backend/` — Node 24 + TypeScript + Fastify + Knex/Objection (migrations in `src/migrations`, run on boot). Schema: `trainers`, `users`, `user_devices`, `user_trainings`, `user_device_data_snapshots` (trainers keep a text `slug` that the API returns as `id`). Manual runs: `DATABASE_URL=... npm run migrate:latest` / `migrate:rollback -- --all` (records the same `.js` names as the app). Routes: `GET /api/health` (runs `SELECT 1`; 503 if DB down), `GET /api/trainers` (5 seeded AI trainers). Tests: Vitest + Testcontainers (needs Docker).
- `frontend/` — Next.js (App Router, standalone), package manager **bun** (`bun.lock`). Full frontend starter with its own rules in `frontend/AGENTS.md` (read it before frontend work). Calls the backend server-side (`lib/api/backend.ts`, page `/status`); `/api/*` is a `fallback` rewrite to the backend, so `app/api/*` handlers (mock, ai) keep priority.
- `compose.yml` — local stack, frontend on http://localhost:18080, Postgres on `localhost:15432` (`postgres://app:app@localhost:15432/app`).
- `deploy/compose.prod.yml` — production stack (db + platform-backend + frontend).
- `ssh/` — Hetzner key (private `hetzner_ed25519` and `.pub` are both committed on purpose (private repo)) and `connect.sh`.
- New microservice: add a folder with a Dockerfile, a service in both compose files, and build/push + test steps in `.github/workflows/ci.yml`.

## Where it is deployed
- Hetzner VPS `37.27.8.181` (user `root`), app dir `/opt/app`. Plain HTTP, no domain yet.
- Live: http://37.27.8.181/ (frontend, port 80) and http://37.27.8.181/api/health.
- Only the frontend is published; `platform-backend` and `db` (Postgres, volume `postgres_data`) stay on the internal compose network.
- Shell: `./ssh/connect.sh` (e.g. `./ssh/connect.sh "cd /opt/app && docker compose -f compose.prod.yml logs -f"`).

## CI/CD (`.github/workflows/ci.yml`)
Repo: `javaAndScriptDeveloper/genesisAiHackathon` (private). On push to `main` (PRs run the checks only):
1. In parallel: frontend typecheck + tests, backend tests (Testcontainers), and the two image builds pushed to GHCR (no separate `next build`; the image build compiles the frontend).
2. Images go to GHCR (`ghcr.io/javaandscriptdeveloper/genesisaihackathon/<service>:sha-<commit>` + `:latest`).
3. `deploy` (needs all of the above green) SSHes to the VPS, copies `deploy/compose.prod.yml`, writes `/opt/app/.env`, `docker compose pull && up -d`.
4. Verifies by curling `http://37.27.8.181/api/health` (retries, requires `"db":true`); the run fails if it doesn't.

Secrets (repo): `VPS_SSH_KEY` (contents of `ssh/hetzner_ed25519`), `POSTGRES_PASSWORD`, `GEMINI_API_KEY` (optional; goal parsing and voice input in Settings). See `docs/deploy.md` for setup and rollback.
Gotchas: Postgres reads its password only on first init — changing `POSTGRES_PASSWORD` later needs `docker compose down -v` on the VPS (wipes data). Ports 3000/8080 may be taken locally, hence 18080.
