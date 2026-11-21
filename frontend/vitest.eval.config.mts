import { defineConfig } from "vitest/config";
import path from "node:path";

// Optional AI evals. Real Gemini calls: see the quota note in evals/cases.ts. The main config (vitest.config.mts)
// only includes tests/**, so `bun run test` and CI never reach these files.
export default defineConfig({
	resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
	test: { environment: "node", include: ["evals/**/*.eval.ts"], testTimeout: 60_000 },
});
