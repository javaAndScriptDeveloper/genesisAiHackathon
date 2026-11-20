# Hackathon backbone — design

## Intent
Reusable, minimal push-to-live pipeline for a hackathon whose task is unknown. A commit to `main` runs tests,
builds images and ends up running on the Hetzner VPS (37.27.8.181). Proof it works: a request to the VPS returns
a response from the backend that touched Postgres.

## Goals
- `frontend` (Next.js + TS) and `platform-backend` (Node + TS) as separate services, so more microservices can be added.
- One backend route, `GET /api/health`, that runs `SELECT 1` against Postgres (no tables).
- One Postgres, reachable only by the backend.
- Backend test uses Testcontainers (real Postgres).
- Fast CI: test, build images, push, deploy. Nothing else.

## Non-goals / anti-goals
- No Grafana/observability, gitleaks, trivy, zizmor, commit lint, semver releases, replicas, Watchtower, backups.
- No domain/HTTPS yet (plain `http://37.27.8.181`); Caddy can be added later.
- No tables, migrations, auth.

## Constraints
- Deploy over SSH with the key in `ssh/` (private key lives in a GitHub secret, never in git).
- Images in GHCR. Docker is available on `ubuntu-latest`, so Testcontainers works.

## Approaches
1. Pull-based (template): CI pushes `latest`, Watchtower on VPS polls. No SSH key in CI, but slow feedback, extra moving part.
2. **Chosen** — push-based: CI builds and pushes images to GHCR, last step SSHes in and runs `docker compose pull && up -d`. Immediate, red/green tells the truth.
3. Build on the VPS (rsync + `compose build`): no registry, but slow builds on a small box and no CI-built artifact.

## Design (my calls)
- Layout: `frontend/`, `platform-backend/`, `compose.yml` (local), `deploy/compose.prod.yml` (VPS), `.github/workflows/ci.yml`.
- Backend: Fastify + TypeScript, `pg` pool, Vitest + `@testcontainers/postgresql`. Route `GET /api/health` -> `{status:"ok", db:true}`.
- Frontend: Next.js (App Router, standalone output); page fetches backend server-side and shows the result. Port 80 on VPS.
- Backend is not published; frontend reaches it on the compose network. `/api/*` proxied by Next rewrites so `http://IP/api/health` works.
- CI: job `test` (backend tests) -> job `deploy` (main only: build+push both images, SSH deploy, curl `http://IP/api/health` to verify).
- Secrets: `VPS_SSH_KEY`, `POSTGRES_PASSWORD` (plus built-in `GITHUB_TOKEN` for GHCR).

## Left to builder
Versions, Dockerfile details, exact compose healthchecks, VPS first-time bootstrap script.
