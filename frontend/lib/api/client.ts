import type { ZodType } from "zod";
import { ApiError } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/mock";

// Typed fetch: validates every response with a zod schema, so UI never sees unchecked data.
export async function apiFetch<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`, init);
	if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
	const parsed = schema.safeParse(await response.json());
	if (!parsed.success) throw new ApiError("Unexpected response shape", 502);
	return parsed.data;
}
