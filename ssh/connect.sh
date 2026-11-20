#!/usr/bin/env bash
# Connect to the Hetzner server using the key in this folder.
# Usage: ./connect.sh [command...]   (no args = interactive shell)
set -euo pipefail

HOST="37.27.8.181"
USER_NAME="${HETZNER_USER:-root}"
KEY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hetzner_ed25519"

exec ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "${USER_NAME}@${HOST}" "$@"
