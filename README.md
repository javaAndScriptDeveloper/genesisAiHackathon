# genesisAiHackathon
Hackathon final project for the Genesis AI Engineering school

## Before you start: SSH key (required)

CI deploys to the Hetzner VPS (`37.27.8.181`) over SSH, and you need the same key to log in yourself.
The key lives in `ssh/`:

| File | In git? | Purpose |
|---|---|---|
| `ssh/hetzner_ed25519.pub` | yes | Public key, already authorized on the VPS |
| `ssh/hetzner_ed25519` | **no** (gitignored) | Private key. Get it from a teammate over a secure channel; never commit or paste it in chat |

Checklist:

1. Put the private key at `ssh/hetzner_ed25519` and run `chmod 600 ssh/hetzner_ed25519`.
2. Check access: `./ssh/connect.sh` (opens a shell on the VPS).
3. **Add it to GitHub, or CI deploys will fail:**
   ```bash
   gh secret set VPS_SSH_KEY < ssh/hetzner_ed25519
   gh secret set POSTGRES_PASSWORD --body "$(openssl rand -hex 24)"
   ```
4. Push to `main`. CI tests, builds, deploys and checks http://37.27.8.181/api/health.

Details: `docs/deploy.md`, `CLAUDE.md`.
