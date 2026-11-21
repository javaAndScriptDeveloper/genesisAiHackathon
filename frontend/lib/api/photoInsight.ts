import { z } from "zod";
import type { InsightContext, PhotoPair } from "../fit/photoInsight";

// Client side of app/api/progress/photo-insight. Mirrors lib/ai/photoInsight.ts without importing server code.
export const photoInsightResponseSchema = z.object({
	suitable: z.boolean(),
	summary: z.string(),
	observations: z.array(z.object({ area: z.string(), text: z.string() })).max(4),
	encouragement: z.string(),
	model: z.string().optional(),
});
export type PhotoInsightResponse = z.infer<typeof photoInsightResponseSchema>;

export type PhotoInsightError = "rate_limited" | "unavailable" | "failed" | "network" | "invalid";
export type PhotoInsightOutcome = { ok: true; data: PhotoInsightResponse } | { ok: false; error: PhotoInsightError };

export function parsePhotoInsightResponse(json: unknown): PhotoInsightResponse | null {
	const r = photoInsightResponseSchema.safeParse(json);
	return r.success ? r.data : null;
}

export function errorFromStatus(status: number): PhotoInsightError {
	if (status === 429) return "rate_limited";
	if (status === 503) return "unavailable";
	if (status === 400) return "invalid";
	return "failed";
}

const MOCK: PhotoInsightResponse = {
	suitable: true,
	model: "mock",
	summary: "Across these photos your posture looks a little more upright, and the lighting and framing are consistent enough to compare.",
	observations: [
		{ area: "Posture", text: "Shoulders appear slightly more relaxed and back in the later photo." },
		{ area: "Consistency", text: "Your steady weeks of training match the steady habit of checking in." },
		{ area: "Photo setup", text: "Keeping the same spot and light makes comparisons easier." },
	],
	encouragement: "Small changes add up. Keep showing up at your own pace.",
};

/** Dev-only canned answer for `?mockPhotoAi=1`. */
export function mockAllowed(search: string, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
	return nodeEnv !== "production" && new URLSearchParams(search).get("mockPhotoAi") === "1";
}

export async function requestPhotoInsight(args: { token: string; locale: "en" | "uk"; pair: PhotoPair; context: InsightContext; mock?: boolean }): Promise<PhotoInsightOutcome> {
	if (args.mock) {
		await new Promise((r) => setTimeout(r, 900));
		return { ok: true, data: MOCK };
	}
	const side = (p: PhotoPair["before"]) => ({ date: p.date, dataUrl: p.dataUrl, ...(p.weightKg !== undefined ? { weightKg: p.weightKg } : {}) });
	try {
		const res = await fetch("/api/progress/photo-insight", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ token: args.token, locale: args.locale, before: side(args.pair.before), after: side(args.pair.after), context: args.context }),
		});
		if (!res.ok) return { ok: false, error: errorFromStatus(res.status) };
		const data = parsePhotoInsightResponse(await res.json().catch(() => null));
		return data ? { ok: true, data } : { ok: false, error: "failed" };
	} catch {
		return { ok: false, error: "network" };
	}
}
