import { z } from "zod";

// Speech-to-text for goal fields (onboarding quiz, Profile → Goal): POST /api/stt, Gemini returns the transcript.

const replySchema = z.object({ text: z.string().min(1) });

/** Turns a voice recording into text. Throws when the AI is not configured, fails, is slow or heard nothing. */
export async function transcribe(audio: Blob, timeoutMs = 25_000): Promise<string> {
	const form = new FormData();
	form.append("audio", audio, "goal.webm");
	const res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
	const reply = replySchema.safeParse(await res.json().catch(() => null));
	if (!res.ok || !reply.success) throw new Error("Transcription failed");
	return reply.data.text;
}
