---
name: api-integration
description: Use when connecting to a backend, adding endpoints, mocks, forms or AI calls.
---

# api-integration

Read docs/agent/data-and-api.md and docs/agent/ai-utils.md. Define zod schema in lib/api/types.ts, endpoint in lib/api/index.ts, mock in lib/api/mock. Client reads via react-query; forms via react-hook-form + zod with noValidate. AI calls only server-side through lib/ai. Add a vitest test for new lib logic.

Always start from [AGENTS.md](../../../AGENTS.md).
