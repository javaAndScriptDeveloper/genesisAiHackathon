import { NextResponse } from "next/server";
import { AiConfigError, analyzeProgressPhotos } from "@/lib/ai";
import { RateLimiter, buildPhotoPrompt, decodeDataUrl, parsePhotoInsightResult, photoInsightRequestSchema } from "@/lib/ai/photoInsight";

const limiter = new RateLimiter();

// Compares two progress photos with Gemini. Photos are forwarded in memory only: never logged, never stored.
export async function POST(request: Request) {
	const body = photoInsightRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
	const { token, locale, before, after, context } = body.data;
	const a = decodeDataUrl(before.dataUrl);
	const b = decodeDataUrl(after.dataUrl);
	if (!a || !b) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
	if (!limiter.take(token)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
	try {
		const text = await analyzeProgressPhotos({ before: a, after: b, prompt: buildPhotoPrompt(context, locale) });
		const result = parsePhotoInsightResult(text);
		if (!result) return NextResponse.json({ error: "bad_ai_response" }, { status: 502 });
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
		return NextResponse.json({ error: "ai_failed" }, { status: 502 });
	}
}
