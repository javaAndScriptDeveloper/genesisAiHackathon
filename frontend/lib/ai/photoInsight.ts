import { z } from "zod";

export const MAX_PHOTO_BYTES = 400 * 1024;
export const DAILY_LIMIT = 5;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function decodeDataUrl(dataUrl: string): { mimeType: string; data: Buffer } | null {
	const m = DATA_URL.exec(dataUrl);
	if (!m || !m[1] || !m[2]) return null;
	const data = Buffer.from(m[2], "base64");
	return data.length > 0 ? { mimeType: m[1], data } : null;
}

const photo = z.object({
	date: z.iso.date(),
	dataUrl: z
		.string()
		.max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64)
		.refine((v) => {
			const d = decodeDataUrl(v);
			return d !== null && d.data.length <= MAX_PHOTO_BYTES;
		}),
	weightKg: z.number().positive().max(700).optional(),
});

export const photoInsightRequestSchema = z
	.object({
		token: z.uuid(),
		locale: z.enum(["en", "uk"]),
		before: photo,
		after: photo,
		context: z.object({
			weightChangeKg: z.number().nullable(),
			consistency: z.number().nullable(),
			streakWeeks: z.number().int().min(0),
			records: z.array(z.object({ exercise: z.string().max(80), text: z.string().max(120) })).max(5),
			periodDays: z.number().int().min(0),
		}),
	})
	.refine((b) => b.before.date < b.after.date, { path: ["after", "date"] });

export type PhotoInsightRequest = z.infer<typeof photoInsightRequestSchema>;
export type PhotoInsightContext = PhotoInsightRequest["context"];

export const photoInsightResultSchema = z.object({
	suitable: z.boolean(),
	summary: z.string().max(600),
	observations: z.array(z.object({ area: z.string().max(60), text: z.string().max(300) })).max(4),
	encouragement: z.string().max(300),
});
export type PhotoInsightResult = z.infer<typeof photoInsightResultSchema>;

export function parsePhotoInsightResult(text: string): PhotoInsightResult | null {
	try {
		const r = photoInsightResultSchema.safeParse(JSON.parse(text));
		return r.success ? r.data : null;
	} catch {
		return null;
	}
}

/** In-memory per-token daily counter (UTC day). */
export class RateLimiter {
	private hits = new Map<string, { day: string; count: number }>();
	constructor(private limit = DAILY_LIMIT) {}
	take(token: string, now = new Date()): boolean {
		const day = now.toISOString().slice(0, 10);
		const cur = this.hits.get(token);
		if (!cur || cur.day !== day) {
			this.hits.set(token, { day, count: 1 });
			return true;
		}
		if (cur.count >= this.limit) return false;
		cur.count += 1;
		return true;
	}
}

export function buildPhotoPrompt(context: PhotoInsightContext, locale: "en" | "uk"): string {
	const language = locale === "uk" ? "Ukrainian" : "English";
	return [
		"You compare two progress photos of the same person: the first image is BEFORE, the second is AFTER.",
		`Write every text field in ${language}.`,
		"Rules:",
		"- Use neutral, supportive language. Do not judge or rate the body; no talk of an ideal body, attractiveness, or good/bad bodies.",
		"- Do not state numbers read from the photos (weight, body fat percentage, measurements).",
		"- Give no medical conclusions or diagnoses; this is not a medical assessment.",
		"- Describe only visible, neutral things (posture, visible muscle definition, how the person carries themselves, photo consistency) and tie them to the training data below.",
		'- If the photos are not of a person\'s body, or are too dark, blurry or inconsistent to compare, set "suitable" to false and explain briefly in "summary", with no observations.',
		"- At most 4 observations. Keep it concise.",
		`Training data for this period (${context.periodDays} days): ${JSON.stringify({
			weightChangeKg: context.weightChangeKg,
			consistency: context.consistency,
			streakWeeks: context.streakWeeks,
			records: context.records,
		})}`,
		'Reply only with JSON: {"suitable": boolean, "summary": string, "observations": [{"area": string, "text": string}], "encouragement": string}',
	].join("\n");
}
