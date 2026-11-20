# Deploy

Push to `main` -> CI tests, builds images to GHCR, SSHes to the VPS (`37.27.8.181`), runs `docker compose up -d`,
then curls `http://37.27.8.181/api/health` and requires `"db":true`.

## One-time setup

```bash
gh secret set VPS_SSH_KEY < ssh/hetzner_ed25519     # private key whose .pub is on the VPS
gh secret set POSTGRES_PASSWORD --body "$(openssl rand -hex 24)"
```

VPS needs Docker + compose plugin and a free port 80 (`./ssh/connect.sh "docker compose version"`).

## Operate

- Logs: `./ssh/connect.sh "cd /opt/app && docker compose -f compose.prod.yml logs -f"`
- Roll back: `./ssh/connect.sh "cd /opt/app && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<old>/' .env && docker compose -f compose.prod.yml up -d"`
- Local dev: `docker compose up --build` -> http://localhost:18080
