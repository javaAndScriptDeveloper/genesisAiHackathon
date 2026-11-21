import { NextResponse } from "next/server";
import { z } from "zod";
import { AiConfigError, askClaude, askGemini } from "@/lib/ai";

const bodySchema = z.object({
	provider: z.enum(["claude", "gemini"]),
	prompt: z.string().min(1).max(20_000),
	system: z.string().max(5_000).optional(),
});

export async function POST(request: Request) {
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const { provider, prompt, system } = body.data;
	try {
		const text = provider === "claude" ? await askClaude({ prompt, system }) : await askGemini({ prompt, system });
		return NextResponse.json({ text });
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
		return NextResponse.json({ error: "AI request failed" }, { status: 502 });
	}
}
