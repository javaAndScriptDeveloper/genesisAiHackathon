import { NextResponse } from "next/server";
import { adjustSession } from "@/lib/ai/planner";
import { getSnapshots, getTrainerTov, saveTraining } from "@/lib/api/platform";
import { dailyRequestSchema, type DailyResponse } from "@/lib/fit/aiApi";
import { buildDailySession, fallbackDaily } from "@/lib/fit/aiPlan";
import { statusForReadiness } from "@/lib/fit/dailyStats";
import { t } from "@/lib/messages";

// Daily readiness check: the status is decided from readiness alone; the AI only writes the session content and note, and never makes a day harder.
export async function POST(request: Request) {
	const body = dailyRequestSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	const { userId, profile, trainerSlug, session, upcoming, today } = body.data;

	const [snapshots, trainer] = await Promise.all([getSnapshots(userId, 1), getTrainerTov(trainerSlug)]);
	const last = snapshots[snapshots.length - 1];
	const stats = last && last.date === today ? last : null;
	const name = trainer.name;

	if (!stats) {
		const response: DailyResponse = { status: "unchanged", session: null, note: t("fit.ai.noStats", { name }, "en"), stats: null, createdBy: "fallback" };
		return NextResponse.json(response);
	}

	const status = statusForReadiness(stats.readiness);

	if (status === "unchanged" || !session) {
		// A rest day on a poor night is not "good to go": the fallback recommends rest.
		const fallbackKey = status === "unchanged" ? "fit.ai.dailyFine" : status === "lighter" ? "fit.ai.restDayLighter" : "fit.ai.restDayRecovery";
		let note = t(fallbackKey, { name }, "en");
		let createdBy: DailyResponse["createdBy"] = "fallback";
		try {
			const ai = await adjustSession(trainer, { profile, stats, status, session });
			note = ai.note;
			createdBy = "ai";
		} catch (error) {
			console.error("AI daily note failed", error instanceof Error ? error.message : "unknown");
		}
		const response: DailyResponse = { status, session: null, note, stats, createdBy };
		return NextResponse.json(response);
	}

	let adjusted = null;
	let note = "";
	try {
		const ai = await adjustSession(trainer, { profile, stats, status, session });
		adjusted = buildDailySession(ai, session, status, profile);
		if (adjusted) note = ai.note;
	} catch (error) {
		console.error("AI daily adjustment failed", error instanceof Error ? error.message : "unknown");
	}
	const createdBy = adjusted ? "ai" : "fallback";
	if (!adjusted) {
		adjusted = fallbackDaily(session, status, profile);
		note = t(status === "lighter" ? "fit.ai.dailyLighter" : "fit.ai.dailyRecovery", { name }, "en");
	}

	const replaced = adjusted;
	const planned = upcoming.some((w) => w.id === replaced.id) ? upcoming.map((w) => (w.id === replaced.id ? replaced : w)) : [...upcoming, replaced];
	await saveTraining(userId, trainerSlug, { kind: "daily-adjust", createdBy, inputs: { profile, stats: [stats], wishes: body.data.wishes }, summary: note, planned });

	const response: DailyResponse = { status, session: adjusted, note, stats, createdBy };
	return NextResponse.json(response);
}
