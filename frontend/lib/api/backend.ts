import "server-only";
import { z } from "zod";

// Server-side calls to platform-backend (service-to-service). Separate from `api.*`, which is the
// browser-facing client; these run in Server Components and never expose BACKEND_URL to the client.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://platform-backend:3000";

export const healthSchema = z.object({ status: z.string(), db: z.boolean() });
export type Health = z.infer<typeof healthSchema>;

export const pingSchema = z.object({ message: z.string(), time: z.string() });
export type Ping = z.infer<typeof pingSchema>;

export const trainersSchema = z.object({ trainers: z.array(z.object({ id: z.string(), name: z.string(), pathToImage: z.string(), tov: z.string() })) });
export type TrainersResponse = z.infer<typeof trainersSchema>;

export type BackendResult<T> = { ok: true; data: T } | { ok: false };

async function callBackend<T>(path: string, schema: z.ZodType<T>): Promise<BackendResult<T>> {
	try {
		// A 503 from /api/health still carries a valid body ({ status: "error", db: false }), so parse it too.
		const response = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
		const parsed = schema.safeParse(await response.json());
		return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
	} catch {
		return { ok: false };
	}
}

export const backend = {
	health: () => callBackend("/api/health", healthSchema),
	ping: () => callBackend("/api/ping", pingSchema),
	trainers: () => callBackend("/api/trainers", trainersSchema),
};
