import { NextResponse } from "next/server";
import { AiConfigError, transcribeAudio } from "@/lib/ai";

const MAX_BYTES = 5 * 1024 * 1024;

// Speech-to-text for the goal field: the browser uploads a short recording, Gemini returns the transcript.
export async function POST(request: Request) {
	const form = await request.formData().catch(() => null);
	const audio = form?.get("audio");
	if (!(audio instanceof Blob) || !audio.type.startsWith("audio/") || audio.size === 0 || audio.size > MAX_BYTES) {
		return NextResponse.json({ error: "Invalid audio" }, { status: 400 });
	}
	try {
		const text = await transcribeAudio({ data: Buffer.from(await audio.arrayBuffer()), mimeType: audio.type.split(";")[0] ?? audio.type });
		return NextResponse.json({ text: text.trim() });
	} catch (error) {
		if (error instanceof AiConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
		return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
	}
}
