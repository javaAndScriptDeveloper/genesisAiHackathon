# AI utilities (server-only)

`lib/ai` (imports `server-only`; never import from client components):

```ts
import { askClaude, askGemini, streamClaude, streamGemini, AiConfigError } from "@/lib/ai";
const text = await askClaude({ prompt, system, model?, maxTokens? });
const stream: ReadableStream<string> = streamGemini({ prompt });
```

- Keys in `.env.local`: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`; models via `CLAUDE_MODEL`, `GEMINI_MODEL` (defaults in code; check current model ids before the hackathon).
- Missing key → `AiConfigError` (route returns 503 with a readable message).
- Browser calls go through `POST /api/ai` `{ provider: "claude"|"gemini", prompt, system? }` → `{ text }`. For streaming UI, add a route returning `new Response(stream)`.
- Validate all route input with zod; never expose keys or raw provider errors to the client.
