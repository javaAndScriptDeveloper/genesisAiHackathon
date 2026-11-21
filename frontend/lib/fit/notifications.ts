import { addDays, daysBetween, formatDay, mondayOf, toISO, weekKey } from "./dates";
import { weeklyChallenge } from "./gamification";
import { weekStats } from "./stats";
import { historyFromFit } from "../progress/fromFit";
import { weeklyReportV2 } from "../progress/report";
import { t } from "../messages";
import { progressCtx, progressOf } from "./store/progressStats";
import type { AppNotification, FitState, NotificationKind, NotificationSettings } from "./types";

export const NOTIFICATION_LABELS: Record<NotificationKind, { label: string; hint: string }> = {
	workout: { label: "Workout reminders", hint: "A single nudge on training days." },
	missed: { label: "Missed workout follow-ups", hint: "A supportive check-in, never more than one." },
	achievement: { label: "Achievements", hint: "When you unlock a badge or record." },
	"weekly-goal": { label: "Weekly goal updates", hint: "When you finish the week's plan." },
	recovery: { label: "Recovery reminders", hint: "When your body needs a rest day." },
	coach: { label: "Coach messages", hint: "At most one tip a week." },
	"weekly-summary": { label: "Weekly progress summary", hint: "A short recap each Monday." },
	streak: { label: "Streak alerts", hint: "When a workout today keeps your streak alive." },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
	enabled: { workout: true, missed: true, achievement: true, "weekly-goal": true, recovery: true, coach: true, "weekly-summary": true, streak: true },
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
		// A missing switch (settings saved before a kind existed) counts as on.
		if (on[n.kind] !== false) out.push({ ...n, createdAt: at, read: false });
	};

	const progress = progressOf(state, today);
	const goal = progress.week;

	const todays = state.planned.find((w) => w.date === today && w.status === "planned" && !w.adHoc);
	if (todays) {
		push({ id: `n-workout-${today}`, kind: "workout", title: `Today: ${todays.title}`, body: `${todays.durationMin} min planned. Your reminder is set for ${state.notificationSettings.reminderTime}.`, href: `/training/session/${todays.id}`, nudge: { kind: "workout", facts: { title: todays.title, minutes: todays.durationMin } } });
	}

	const missed = state.planned
		.filter((w) => w.status === "planned" && !w.adHoc && w.date < today && w.date >= addDays(today, -3))
		.sort((a, b) => b.date.localeCompare(a.date))[0];
	if (missed) {
		push({ id: `n-missed-${missed.id}`, kind: "missed", title: `${missed.title} on ${formatDay(missed.date)} is still open`, body: "Life happens. Move it to a day that works or skip it without losing your progress.", href: `/training/session/${missed.id}`, nudge: { kind: "missed", facts: { title: missed.title, daysMissed: daysBetween(missed.date, today) } } });
	}

	// The week streak survives only if enough quality sessions land this week, so a still-open workout today is the nudge.
	const [hh = "0", mm = "0"] = state.notificationSettings.reminderTime.split(":");
	const afterReminder = now.getHours() * 60 + now.getMinutes() >= Number(hh) * 60 + Number(mm);
	if (todays && afterReminder && progress.streak.current >= 2 && goal.quality < goal.goal) {
		push({ id: `n-streak-risk-${today}`, kind: "streak", title: `Keep your ${progress.streak.current}-week streak alive`, body: `Today's workout is still open. ${goal.quality} of ${goal.goal} done this week.`, href: `/training/session/${todays.id}`, nudge: { kind: "streak-risk", facts: { streak: progress.streak.current, title: todays.title } } });
	}

	const recent = state.history.filter((l) => l.date >= addDays(today, -2));
	if (recent.length >= 3) {
		push({ id: `n-recovery-${today}`, kind: "recovery", title: "Time for a lighter day", body: "Three sessions in three days. Recovery is where the gains happen, so keep tomorrow easy.", href: "/coach" });
	}

	if (goal.quality >= goal.goal) {
		push({ id: `n-goal-${weekKey(today)}`, kind: "weekly-goal", title: "Weekly goal complete", body: `${goal.quality} of ${goal.goal} quality workouts done this week. Enjoy the rest.`, href: "/progress" });
	}

	if (now.getDay() === 1 || state.history.length > 0) {
		const last = weekStats(state.planned, state.history, today, -1);
		if (last.planned > 0) {
			// Text comes from the engine's weekly report (stub for a real Monday 9:00 local push).
			const { pushText } = weeklyReportV2(historyFromFit(state, today), progressCtx(state), addDays(mondayOf(today), -7));
			push({ id: `n-summary-${weekKey(addDays(today, -7))}`, kind: "weekly-summary", title: "Your week in review", body: t(pushText.key, pushText.params), href: "/progress", nudge: { kind: "weekly-summary", facts: { done: pushText.params.done, goal: pushText.params.goal } } });
		}
	}

	const challenge = weeklyChallenge(state, today);
	push({ id: `n-coach-${challenge.weekKey}`, kind: "coach", title: `This week: ${challenge.title}`, body: challenge.description, href: "/progress" });

	return out;
}

/** Browser popup for one notification; only when the user opted in and granted permission, and only while it is fresh. */
export function showBrowserNotification(n: AppNotification, text?: string): void {
	if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
	if (n.read || Date.now() - new Date(n.createdAt).getTime() > 60_000) return;
	new Notification(n.title, { body: text ?? n.body });
}

/** True for notifications the trainer rewrites in their own voice. */
export function isVoiced(n: AppNotification): boolean {
	return n.nudge !== undefined;
}

export function unreadCount(state: Pick<FitState, "notifications">): number {
	return state.notifications.filter((n) => !n.read).length;
}
