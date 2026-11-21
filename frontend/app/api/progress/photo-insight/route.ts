import { NextResponse } from "next/server";
import { AiConfigError, analyzeProgressPhotos } from "@/lib/ai";
import { MAX_BODY_BYTES, RateLimiter, buildPhotoPrompt, parsePhotoInsightResult, photoInsightRequestSchema } from "@/lib/ai/photoInsight";

const limiter = new RateLimiter();

const tooLarge = () => NextResponse.json({ error: "too_large" }, { status: 413 });

// Compares two progress photos with Gemini. Photos are forwarded in memory only: never logged, never stored.
export async function POST(request: Request) {
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return tooLarge();
	const text = await request.text().catch(() => null);
	if (text === null) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
	if (text.length > MAX_BODY_BYTES) return tooLarge();
	let json: unknown = null;
	try {
		json = JSON.parse(text);
	} catch {}
	const body = photoInsightRequestSchema.safeParse(json);
	if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
	const { token, locale, before, after, context } = body.data;
	if (!limiter.take(token)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
	const { system, user } = buildPhotoPrompt(context, locale);
	try {
		const out = await analyzeProgressPhotos({ before: before.image, after: after.image, system, prompt: user });
		const result = parsePhotoInsightResult(out);
		if (!result) {
			limiter.refund(token);
			return NextResponse.json({ error: "bad_ai_response" }, { status: 502 });
		}
		return NextResponse.json(result);
	} catch (error) {
		limiter.refund(token);
		// Error name only: messages may echo request content.
		console.error("photo-insight provider failure:", error instanceof Error ? error.name : "unknown");
		if (error instanceof AiConfigError) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
		return NextResponse.json({ error: "ai_failed" }, { status: 502 });
	}
}
