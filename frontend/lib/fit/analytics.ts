import { recordBrowserEvent } from "@/lib/insights/browserEvents";

// Lightweight, typed product analytics. Components and the store call `track`; sinks decide where events go.
export interface AnalyticsEvents {
	onboarding_completed: { goal: string; daysPerWeek: number };
	workout_started: { plannedId: string | null; exercises: number };
	workout_paused: { elapsedSec: number };
	workout_completed: { status: "completed" | "partial"; durationSec: number; volumeKg: number; prs: number; quality: boolean };
	workout_abandoned: { setsDone: number; reason: "ended-early" | "discarded" | "safety-stop" };
	workout_adapted: { adaptation: string };
	coach_used: { intent: "message" | "action"; voice: boolean };
	achievement_unlocked: { id: string };
	notification_opened: { id: string; kind: string };
	subscription_viewed: { source: string };
	subscription_started: { plan: string; demo: true };
}

export type EventName = keyof AnalyticsEvents;
export type AnalyticsSink = <E extends EventName>(event: E, props: AnalyticsEvents[E]) => void;

const sinks = new Set<AnalyticsSink>();
const buffer: { event: EventName; props: unknown; at: string }[] = [];

export function addSink(sink: AnalyticsSink): () => void {
	sinks.add(sink);
	return () => sinks.delete(sink);
}

export function track<E extends EventName>(event: E, props: AnalyticsEvents[E]): void {
	const now = new Date();
	buffer.push({ event, props, at: now.toISOString() });
	if (buffer.length > 200) buffer.shift();
	const workout = "quality" in props ? { completed: props.status === "completed", quality: props.quality } : {};
	recordBrowserEvent({ event, at: now.getTime(), ...workout });
	for (const sink of sinks) sink(event, props);
}

export function recentEvents() {
	return [...buffer];
}

// Default sink: console in development. Swap or add a real provider here without touching any component.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
	addSink((event, props) => console.debug("[analytics]", event, props));
}
