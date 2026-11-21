import { NextResponse } from "next/server";
import { z } from "zod";
import { AiConfigError, writeNudge } from "@/lib/ai";
import { backend } from "@/lib/api/backend";
import { createRateLimiter } from "@/lib/ai/rateLimit";
import { NUDGE_KINDS } from "@/lib/fit/nudge";

const count = (max: number) => z.number().int().min(0).max(max);
const bodySchema = z
	.object({
		trainerId: z.string().min(1).max(40),
		kind: z.enum(NUDGE_KINDS),
		facts: z.object({ title: z.string().max(80), daysMissed: count(365), streak: count(10_000), minutes: count(600), done: count(100), goal: count(100) }).partial().strict(),
	})
	.strict();

// No login yet, so cap each client: a runaway loop must not burn the Gemini quota (one nudge per notification is the norm).
const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

// Writes one notification in the chosen trainer's voice. Only typed facts go to Gemini, never free text from the user.
export async function POST(request: Request) {
	const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
	if (!allow(client)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const trainers = await backend.trainers();
	if (!trainers.ok) return NextResponse.json({ error: "Trainers unavailable" }, { status: 503 });
	const trainer = trainers.data.trainers.find((t) => t.id === body.data.trainerId);
	if (!trainer) return NextResponse.json({ error: "Unknown trainer" }, { status: 404 });
	try {
		const text = await writeNudge({ name: trainer.name, tov: trainer.tov }, body.data.kind, body.data.facts);
		if (text === null) return NextResponse.json({ error: "AI returned nothing" }, { status: 502 });
		return NextResponse.json({ text });
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
		return NextResponse.json({ error: "AI request failed" }, { status: 502 });
	}
}
