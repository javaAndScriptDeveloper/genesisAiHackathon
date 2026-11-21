import { NextResponse } from "next/server";
import { z } from "zod";
import { AiConfigError, classifyGoal } from "@/lib/ai";

const bodySchema = z.object({ text: z.string().trim().min(1).max(500) });

// Maps the user's own words (typed or dictated) to the closest preset goal; `goal: null` means "could not tell".
export async function POST(request: Request) {
	const body = bodySchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	try {
		return NextResponse.json({ goal: await classifyGoal(body.data.text) });
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
		return NextResponse.json({ error: "AI request failed" }, { status: 502 });
	}
}
