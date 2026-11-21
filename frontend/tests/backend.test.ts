import { afterEach, describe, expect, it, vi } from "vitest";
import { backend } from "@/lib/api/backend";

function mockFetch(body: unknown, status = 200) {
	vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("backend", () => {
	it("parses a healthy response", async () => {
		mockFetch({ status: "ok", db: true });
		expect(await backend.health()).toEqual({ ok: true, data: { status: "ok", db: true } });
	});

	it("keeps the body of a 503 so the UI can show the database as down", async () => {
		mockFetch({ status: "error", db: false }, 503);
		expect(await backend.health()).toEqual({ ok: true, data: { status: "error", db: false } });
	});

	it("rejects an unexpected shape", async () => {
		mockFetch({ nope: 1 });
		expect(await backend.ping()).toEqual({ ok: false });
	});

	it("returns not ok when the backend is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
		expect(await backend.ping()).toEqual({ ok: false });
	});
});
