import { addDays, formatDay, toISO, weekKey } from "./dates";
import { weeklyChallenge } from "./gamification";
import { computeStreak, weekStats } from "./stats";
import type { AppNotification, FitState, NotificationKind, NotificationSettings } from "./types";

export const NOTIFICATION_LABELS: Record<NotificationKind, { label: string; hint: string }> = {
	workout: { label: "Workout reminders", hint: "A single nudge on training days." },
	missed: { label: "Missed workout follow-ups", hint: "A supportive check-in, never more than one." },
	achievement: { label: "Achievements", hint: "When you unlock a badge or record." },
	"weekly-goal": { label: "Weekly goal updates", hint: "When you finish the week's plan." },
	recovery: { label: "Recovery reminders", hint: "When your body needs a rest day." },
	coach: { label: "Coach messages", hint: "At most one tip a week." },
	"weekly-summary": { label: "Weekly progress summary", hint: "A short recap each Monday." },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
	enabled: { workout: true, missed: true, achievement: true, "weekly-goal": true, recovery: true, coach: true, "weekly-summary": true },
	reminderTime: "07:30",
	browserPush: false,
};

/**
 * Notifications implied by the current state. Ids are deterministic so calling this repeatedly never duplicates:
 * the reducer only appends ids it has not seen. Respect the user's per-kind switches.
 */
export function deriveNotifications(state: FitState, now: Date): AppNotification[] {
	const today = toISO(now);
	const at = now.toISOString();
	const on = state.notificationSettings.enabled;
	const out: AppNotification[] = [];
	const push = (n: Omit<AppNotification, "createdAt" | "read">) => {
		if (on[n.kind]) out.push({ ...n, createdAt: at, read: false });
	};

	const todays = state.planned.find((w) => w.date === today && w.status === "planned" && !w.adHoc);
	if (todays) {
		push({ id: `n-workout-${today}`, kind: "workout", title: `Today: ${todays.title}`, body: `${todays.durationMin} min planned. Your reminder is set for ${state.notificationSettings.reminderTime}.`, href: `/training/session/${todays.id}` });
	}

	const missed = state.planned
		.filter((w) => w.status === "planned" && !w.adHoc && w.date < today && w.date >= addDays(today, -3))
		.sort((a, b) => b.date.localeCompare(a.date))[0];
	if (missed) {
		push({ id: `n-missed-${missed.id}`, kind: "missed", title: `${missed.title} on ${formatDay(missed.date)} is still open`, body: "Life happens. Move it to a day that works or skip it without losing your progress.", href: `/training/session/${missed.id}` });
	}

	const recent = state.history.filter((l) => l.date >= addDays(today, -2));
	if (recent.length >= 3) {
		push({ id: `n-recovery-${today}`, kind: "recovery", title: "Time for a lighter day", body: "Three sessions in three days. Recovery is where the gains happen, so keep tomorrow easy.", href: "/coach" });
	}

	const stats = weekStats(state.planned, state.history, today);
	if (stats.planned > 0 && stats.done === stats.planned) {
		push({ id: `n-goal-${weekKey(today)}`, kind: "weekly-goal", title: "Weekly goal complete", body: `All ${stats.planned} planned sessions done this week. Enjoy the rest.`, href: "/progress" });
	}

	if (now.getDay() === 1 || state.history.length > 0) {
		const last = weekStats(state.planned, state.history, today, -1);
		if (last.planned > 0) {
			push({ id: `n-summary-${weekKey(addDays(today, -7))}`, kind: "weekly-summary", title: "Your week in review", body: `${last.done} of ${last.planned} sessions, ${last.minutes} min training, ${last.volume.toLocaleString("en-US")} kg lifted. Streak: ${computeStreak(state.planned, today).current}.`, href: "/progress" });
		}
	}

	const challenge = weeklyChallenge(state, today);
	push({ id: `n-coach-${challenge.weekKey}`, kind: "coach", title: `This week: ${challenge.title}`, body: challenge.description, href: "/progress" });

	return out;
}

export function unreadCount(state: Pick<FitState, "notifications">): number {
	return state.notifications.filter((n) => !n.read).length;
}
