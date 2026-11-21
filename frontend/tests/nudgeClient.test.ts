import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNudge, pendingVoice } from "@/lib/fit/nudgeClient";
import type { AppNotification } from "@/lib/fit/types";

afterEach(() => vi.unstubAllGlobals());

describe("fetchNudge", () => {
	const nudge = { kind: "missed", facts: { title: "Leg day", daysMissed: 2 } } as const;
	it("posts trainer, kind and facts and returns the text", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Move it." }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		expect(await fetchNudge("mike", nudge)).toBe("Move it.");
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/nudge");
		expect(JSON.parse(String(init.body))).toEqual({ trainerId: "mike", kind: "missed", facts: { title: "Leg day", daysMissed: 2 } });
	});
	it("returns null on server errors, network errors and malformed replies", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
		expect(await fetchNudge("mike", nudge)).toBeNull();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		expect(await fetchNudge("mike", nudge)).toBeNull();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
		expect(await fetchNudge("mike", nudge)).toBeNull();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 5 }), { status: 200 })));
		expect(await fetchNudge("mike", nudge)).toBeNull();
	});
});

describe("pendingVoice", () => {
	const make = (id: string, extra: Partial<AppNotification> = {}): AppNotification => ({ id, kind: "missed", title: id, body: "b", createdAt: "2026-11-21T10:00:00.000Z", read: false, nudge: { kind: "missed", facts: {} }, ...extra });
	const state = (notifications: AppNotification[]) => ({ notifications });

	it("picks the newest unread voiced notification", () => {
		expect(pendingVoice(state([make("new"), make("old")]), new Set())?.id).toBe("new");
	});
	it("skips tried ids, already voiced, read and template-only notifications", () => {
		expect(pendingVoice(state([make("a"), make("b", { aiText: "x" }), make("c", { read: true }), make("d", { nudge: undefined })]), new Set(["a"]))).toBeNull();
	});
	it("returns null when there is nothing to voice", () => {
		expect(pendingVoice(state([]), new Set())).toBeNull();
	});
});

describe("failed rewrites are not retried after a reload", () => {
	const note = (extra: Partial<AppNotification> = {}): AppNotification => ({ id: "n", kind: "missed", title: "t", body: "b", createdAt: "2026-11-21T10:00:00.000Z", read: false, nudge: { kind: "missed", facts: {} }, ...extra });
	it("pendingVoice skips notifications marked as failed", () => {
		expect(pendingVoice({ notifications: [note({ aiFailed: true })] }, new Set())).toBeNull();
	});
});
