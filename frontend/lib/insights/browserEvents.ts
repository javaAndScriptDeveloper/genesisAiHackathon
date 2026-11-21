import { z } from "zod";

export const eventNames = [
	"onboarding_completed",
	"workout_started",
	"workout_paused",
	"workout_completed",
	"workout_abandoned",
	"workout_adapted",
	"coach_used",
	"achievement_unlocked",
	"notification_opened",
	"subscription_viewed",
	"subscription_started",
] as const;

const eventSchema = z.object({
	event: z.enum(eventNames),
	at: z.number().finite(),
	completed: z.boolean().optional(),
	quality: z.boolean().optional(),
});

export type BrowserEvent = z.infer<typeof eventSchema>;

interface EventSnapshot {
	events: BrowserEvent[];
	available: boolean;
}

const prefix = "fit.analytics.v1.";
const maxAgeMs = 91 * 86_400_000;
const maxEvents = 4000;
const listeners = new Set<() => void>();
let cache: EventSnapshot | null = null;

function keys(storage: Storage): string[] {
	const matches: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (key?.startsWith(prefix)) matches.push(key);
	}
	return matches;
}

function invalidate() {
	cache = null;
	listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
	if (event.key === null || event.key.startsWith(prefix)) invalidate();
}

export function subscribeBrowserEvents(listener: () => void) {
	if (!listeners.size) window.addEventListener("storage", onStorage);
	listeners.add(listener);
	// Other tabs can write while no dashboard is mounted.
	cache = null;
	return () => {
		listeners.delete(listener);
		if (!listeners.size) window.removeEventListener("storage", onStorage);
	};
}

export function readBrowserEvents(): EventSnapshot {
	if (cache) return cache;
	try {
		const storage = window.localStorage;
		const cutoff = Date.now() - maxAgeMs;
		const events = keys(storage).flatMap((key) => {
			try {
				const parsed = eventSchema.safeParse(JSON.parse(storage.getItem(key) ?? "null"));
				return parsed.success && parsed.data.at >= cutoff ? [parsed.data] : [];
			} catch {
				return [];
			}
		});
		cache = { events: events.sort((a, b) => b.at - a.at), available: true };
	} catch {
		cache = { events: [], available: false };
	}
	return cache;
}

export function recordBrowserEvent(event: BrowserEvent) {
	if (typeof window === "undefined") return;
	try {
		const storage = window.localStorage;
		const id = Array.from(crypto.getRandomValues(new Uint32Array(2))).join("-");
		// Separate entries make writes from different tabs independent.
		storage.setItem(`${prefix}${event.at}.${id}`, JSON.stringify(event));
		const storedKeys = keys(storage).sort();
		const cutoff = event.at - maxAgeMs;
		storedKeys.forEach((key, index) => {
			const at = Number(key.slice(prefix.length).split(".")[0]);
			if (at < cutoff || index < storedKeys.length - maxEvents) storage.removeItem(key);
		});
		invalidate();
	} catch {
		cache = { events: [], available: false };
		listeners.forEach((listener) => listener());
	}
}

export function clearBrowserEvents() {
	try {
		const storage = window.localStorage;
		for (const key of keys(storage)) storage.removeItem(key);
	} catch {
		// The rest of the in-app reset still works when storage is disabled.
	}
	invalidate();
}
