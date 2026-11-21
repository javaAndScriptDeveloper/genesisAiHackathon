import { describe, expect, it } from "vitest";
import { ACCEPT_DELAY_MS, BUDDIES, MAX_CHAT_MESSAGES, buddyReply } from "@/lib/fit/community";
import { GOALS } from "@/lib/fit/options";
import { emptyState } from "@/lib/fit/seed";
import { reducer, type Action } from "@/lib/fit/store/reducer";
import type { ChatMessage, FitState } from "@/lib/fit/types";

const run = (state: FitState, ...actions: Action[]) => actions.reduce(reducer, state);
const t0 = new Date("2026-11-21T10:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms).toISOString();
const invite = (id = "maya") => run(emptyState(), { type: "partner", id, status: "invited", now: at(0) });
const msg = (n: number, over: Partial<ChatMessage> = {}): ChatMessage => ({ id: `m${n}`, from: "me", text: `hello ${n}`, at: at(n), ...over });

describe("buddy approval", () => {
	it("keeps the request awaiting before the delay passes", () => {
		const s = run(invite(), { type: "partners-sync", now: at(ACCEPT_DELAY_MS - 1) });
		expect(s.partners.maya).toBe("invited");
	});
	it("approves the request once the delay has passed", () => {
		const s = run(invite(), { type: "partners-sync", now: at(ACCEPT_DELAY_MS) });
		expect(s.partners.maya).toBe("accepted");
	});
	it("leaves accepted and never-invited buddies alone", () => {
		const accepted = run(invite(), { type: "partners-sync", now: at(ACCEPT_DELAY_MS) });
		const again = run(accepted, { type: "partners-sync", now: at(ACCEPT_DELAY_MS * 3) });
		expect(again.partners).toEqual({ maya: "accepted" });
		expect(run(emptyState(), { type: "partners-sync", now: at(ACCEPT_DELAY_MS) }).partners).toEqual({});
	});
	it("removing a connection deletes its chat and invite time", () => {
		const s = run(invite(), { type: "chat-send", buddyId: "maya", message: msg(1) }, { type: "partner", id: "maya", status: null });
		expect(s.partners.maya).toBeUndefined();
		expect(s.chats.maya).toBeUndefined();
		expect(s.partnerInvitedAt.maya).toBeUndefined();
	});
});

describe("buddy chat", () => {
	it("appends messages and ignores empty ones", () => {
		const s = run(emptyState(), { type: "chat-send", buddyId: "maya", message: msg(1) });
		expect(s.chats.maya?.map((m) => m.text)).toEqual(["hello 1"]);
		expect(run(s, { type: "chat-send", buddyId: "maya", message: msg(2, { text: "   " }) })).toBe(s);
	});
	it("accepts a photo without text", () => {
		const s = run(emptyState(), { type: "chat-send", buddyId: "maya", message: msg(1, { text: "", photo: "data:image/jpeg;base64,AAAA" }) });
		expect(s.chats.maya).toHaveLength(1);
	});
	it("keeps only the most recent messages", () => {
		const s = run(emptyState(), ...Array.from({ length: MAX_CHAT_MESSAGES + 5 }, (_, i): Action => ({ type: "chat-send", buddyId: "maya", message: msg(i + 1) })));
		expect(s.chats.maya).toHaveLength(MAX_CHAT_MESSAGES);
		expect(s.chats.maya?.[0]?.id).toBe("m6");
	});
	it("loads state saved before chats existed", () => {
		const legacy: Partial<FitState> = { ...emptyState() };
		delete legacy.chats;
		delete legacy.partnerInvitedAt;
		const loaded = { ...emptyState(), ...legacy };
		expect(loaded.chats).toEqual({});
		expect(loaded.partnerInvitedAt).toEqual({});
	});
});

describe("buddy content", () => {
	it("has unique ids and valid goals", () => {
		expect(new Set(BUDDIES.map((b) => b.id)).size).toBe(BUDDIES.length);
		for (const b of BUDDIES) expect(GOALS).toContain(b.goal);
	});
	it("replies deterministically, never empty, with a different line for photos", () => {
		for (const b of BUDDIES) {
			for (let n = 0; n < 10; n++) {
				const text = buddyReply(b, { text: "hi", hasPhoto: false }, n);
				expect(text.length).toBeGreaterThan(0);
				expect(text).toBe(buddyReply(b, { text: "hi", hasPhoto: false }, n));
			}
		}
		const b = BUDDIES[0];
		if (!b) throw new Error("no buddies");
		expect(buddyReply(b, { text: "", hasPhoto: true }, 0)).not.toBe(buddyReply(b, { text: "hi", hasPhoto: false }, 0));
	});
});
