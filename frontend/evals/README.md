# Optional AI evals

Evals for the trainer-voice notifications (`/api/nudge`). They call the real Gemini API, so they spend free-tier quota
(cases x 2 calls). They are **not** part of `bun run test` or CI. For the MVP we do not run them routinely.

Run on demand:

```bash
cd frontend
GEMINI_API_KEY=... bun run eval:nudge          # all cases
GEMINI_API_KEY=... bun run eval:nudge -t mike  # one trainer or case
bunx vitest list --config vitest.eval.config.mts  # list cases, no API calls
```

What is checked per case: the rule guard (`lib/fit/nudgeGuard.ts`, the same one enforced at runtime) and an LLM judge for
tone of voice and safety. The run writes `evals/results/latest.md`. See `docs/ai-notifications.md`.
