import { describe, expect, it } from "vitest";
import { addDays, mondayOf, toISO } from "@/lib/fit/dates";
import { deriveNotifications, isVoiced } from "@/lib/fit/notifications";
import { scenarioState } from "@/lib/fit/scenarios";
import { reducer, type Action } from "@/lib/fit/store/reducer";
import type { AppNotification, FitState, NotificationSettings } from "@/lib/fit/types";

const today = toISO(new Date());
const at = (hhmm: string) => new Date(`${today}T${hhmm}:00`);
const noon = at("12:00");

/** S2 has a 12-week streak. Dropping this week's sessions leaves the streak alive but the week goal open. */
function atRisk(): FitState {
	const monday = mondayOf(today);
	const s = scenarioState("S2", today);
	const template = s.planned[0];
	if (!template) throw new Error("fixture has no planned workout");
	const planned = [...s.planned.filter((w) => w.date !== today), { ...template, id: "w-today", date: today, status: "planned" as const, adHoc: false, logId: undefined }];
	return { ...s, history: s.history.filter((l) => l.date < monday), planned };
}
const find = (list: AppNotification[], id: string) => list.find((n) => n.id === id);
const riskId = `n-streak-risk-${today}`;
const run = (state: FitState, ...actions: Action[]) => actions.reduce(reducer, state);

describe("streak at risk", () => {
	it("fires with the streak in weeks when today's workout is open after the reminder time", () => {
		const n = find(deriveNotifications(atRisk(), noon), riskId);
		expect(n).toMatchObject({ kind: "streak", nudge: { kind: "streak-risk" } });
		expect(n?.nudge?.facts.streak).toBeGreaterThanOrEqual(2);
	});
	it("waits for the reminder time", () => {
		expect(find(deriveNotifications(atRisk(), at("06:00")), riskId)).toBeUndefined();
	});
	it("does not fire once today's workout is done", () => {
		const s = atRisk();
		const done = { ...s, planned: s.planned.map((w) => (w.id === "w-today" ? { ...w, status: "completed" as const } : w)) };
		expect(find(deriveNotifications(done, noon), riskId)).toBeUndefined();
	});
	it("does not fire when the week goal is already reached", () => {
		const full = scenarioState("S2", today);
		const withToday = { ...full, planned: [...full.planned, { ...full.planned[0]!, id: "w-today", date: today, status: "planned" as const, adHoc: false, logId: undefined }] };
		expect(find(deriveNotifications(withToday, noon), riskId)).toBeUndefined();
	});
	it("does not fire without a streak of at least 2 weeks", () => {
		const s = scenarioState("S1", today);
		const withToday = { ...s, planned: [...s.planned, { ...s.planned[0]!, id: "w-today", date: today, status: "planned" as const, adHoc: false, logId: undefined }] };
		expect(find(deriveNotifications(withToday, noon), riskId)).toBeUndefined();
	});
	it("treats a missing streak setting (old save) as on, and respects an explicit off", () => {
		const s = atRisk();
		const { streak: _drop, ...legacyEnabled } = s.notificationSettings.enabled;
		const legacy: NotificationSettings = { ...s.notificationSettings, enabled: legacyEnabled as NotificationSettings["enabled"] };
		expect(find(deriveNotifications({ ...s, notificationSettings: legacy }, noon), riskId)).toBeDefined();
		const off: NotificationSettings = { ...s.notificationSettings, enabled: { ...s.notificationSettings.enabled, streak: false } };
		expect(find(deriveNotifications({ ...s, notificationSettings: off }, noon), riskId)).toBeUndefined();
	});
});

describe("facts for the trainer voice", () => {
	it("workout and missed notifications carry what the trainer needs", () => {
		const s = atRisk();
		const yesterday = addDays(today, -1);
		const base = s.planned[0]!;
		const withMissed = { ...s, planned: [...s.planned, { ...base, id: "w-missed", date: yesterday, status: "planned" as const, adHoc: false, logId: undefined, title: "Leg day" }] };
		const list = deriveNotifications(withMissed, noon);
		const workout = find(list, `n-workout-${today}`);
		expect(workout?.nudge).toMatchObject({ kind: "workout", facts: { minutes: expect.any(Number) } });
		expect(find(list, "n-missed-w-missed")?.nudge).toEqual({ kind: "missed", facts: { title: "Leg day", daysMissed: 1 } });
	});
	it("isVoiced is false for notifications saved before this feature", () => {
		const old: AppNotification = { id: "x", kind: "coach", title: "t", body: "b", createdAt: noon.toISOString(), read: false };
		expect(isVoiced(old)).toBe(false);
	});
});

describe("notification-voice", () => {
	const base = (): FitState => run({ ...atRisk() }, { type: "sync", now: noon.toISOString() });
	it("stores the text on the notification", () => {
		const s = base();
		const id = s.notifications[0]!.id;
		expect(run(s, { type: "notification-voice", id, text: "Move it." }).notifications.find((n) => n.id === id)?.aiText).toBe("Move it.");
	});
	it("ignores unknown ids and empty text, and never overwrites", () => {
		const s = base();
		const id = s.notifications[0]!.id;
		expect(run(s, { type: "notification-voice", id: "nope", text: "x" })).toBe(s);
		expect(run(s, { type: "notification-voice", id, text: "  " })).toBe(s);
		const once = run(s, { type: "notification-voice", id, text: "first" });
		expect(run(once, { type: "notification-voice", id, text: "second" })).toBe(once);
	});
});

describe("notification-voice-failed", () => {
	it("marks the notification so it is not requested again", () => {
		const s = run({ ...atRisk() }, { type: "sync", now: noon.toISOString() });
		const id = s.notifications[0]!.id;
		const next = run(s, { type: "notification-voice-failed", id });
		expect(next.notifications.find((n) => n.id === id)?.aiFailed).toBe(true);
		expect(run(next, { type: "notification-voice-failed", id: "nope" })).toBe(next);
	});
});

describe("older saved settings", () => {
	it("loadState fills in notification switches added later", async () => {
		const { loadState, STORAGE_KEY } = await import("@/lib/fit/store/persist");
		const base = atRisk();
		const { streak: _s, ...enabled } = base.notificationSettings.enabled;
		const store: Record<string, string> = { [STORAGE_KEY]: JSON.stringify({ ...base, notificationSettings: { ...base.notificationSettings, enabled } }) };
		(globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => store[k] ?? null } };
		try {
			expect(loadState().notificationSettings.enabled.streak).toBe(true);
		} finally {
			delete (globalThis as { window?: unknown }).window;
		}
	});
});
