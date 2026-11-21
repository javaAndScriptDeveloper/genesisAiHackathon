import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeNudge = vi.fn();
vi.mock("@/lib/ai", async () => {
	const actual = await vi.importActual<typeof import("@/lib/ai/errors")>("@/lib/ai/errors");
	return { AiConfigError: actual.AiConfigError, writeNudge: (...args: unknown[]) => writeNudge(...args) };
});

import { POST } from "@/app/api/nudge/route";
import { AiConfigError } from "@/lib/ai/errors";

const trainers = { trainers: [{ id: "mike", name: "Mike", pathToImage: "/trainers/mike.svg", tov: "Angry, harsh-truth trainer." }] };
const call = (body: unknown) => POST(new Request("http://x/api/nudge", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
const valid = { trainerId: "mike", kind: "missed", facts: { title: "Leg day", daysMissed: 2 } };

beforeEach(() => {
	writeNudge.mockReset();
	vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(trainers), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/nudge", () => {
	it("returns the text and gives Gemini the trainer's tone of voice", async () => {
		writeNudge.mockResolvedValue("Get up. Leg day will not do itself.");
		const res = await call(valid);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ text: "Get up. Leg day will not do itself." });
		expect(writeNudge).toHaveBeenCalledWith({ name: "Mike", tov: "Angry, harsh-truth trainer." }, "missed", { title: "Leg day", daysMissed: 2 });
	});
	it("404s an unknown trainer without calling Gemini", async () => {
		const res = await call({ ...valid, trainerId: "nobody" });
		expect(res.status).toBe(404);
		expect(writeNudge).not.toHaveBeenCalled();
	});
	it("400s a bad body", async () => {
		for (const bad of [{ ...valid, kind: "chat" }, { ...valid, extra: 1 }, { ...valid, facts: { daysMissed: -1 } }, { ...valid, facts: { title: "x".repeat(81) } }, null]) {
			expect((await call(bad)).status).toBe(400);
		}
		expect(writeNudge).not.toHaveBeenCalled();
	});
	it("429s when one client floods the endpoint", async () => {
		writeNudge.mockResolvedValue("ok text");
		const send = () => POST(new Request("http://x/api/nudge", { method: "POST", body: JSON.stringify(valid), headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" } }));
		const statuses: number[] = [];
		for (let i = 0; i < 40; i++) statuses.push((await send()).status);
		expect(statuses).toContain(429);
		expect(statuses[0]).toBe(200);
	});
	it("503s when the Gemini key is missing", async () => {
		writeNudge.mockRejectedValue(new AiConfigError("GEMINI_API_KEY"));
		expect((await call(valid)).status).toBe(503);
	});
	it("502s when Gemini fails or returns nothing usable", async () => {
		writeNudge.mockRejectedValue(new Error("boom"));
		expect((await call(valid)).status).toBe(502);
		writeNudge.mockResolvedValue(null);
		expect((await call(valid)).status).toBe(502);
	});
	it("503s when the backend is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
		expect((await call(valid)).status).toBe(503);
		expect(writeNudge).not.toHaveBeenCalled();
	});
});
