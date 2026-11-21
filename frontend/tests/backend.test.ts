import { afterEach, describe, expect, it, vi } from "vitest";
import { backend } from "@/lib/api/backend";
import { getSnapshots, getTrainerTov, saveTraining, type PlanData } from "@/lib/api/platform";

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

const day = { date: "2026-11-21", sleepHours: 7, sleepScore: 80, restingHr: 58, hrvMs: 60, steps: 5000, activeKcal: 300, readiness: 70, source: "demo", scenario: "tired" };

describe("platform", () => {
	it("parses snapshots and returns [] on failure or bad shape", async () => {
		mockFetch({ snapshots: [day] });
		expect(await getSnapshots(1, 7)).toEqual([day]);
		mockFetch({}, 500);
		expect(await getSnapshots(1, 7)).toEqual([]);
		mockFetch({ snapshots: [{ date: 1 }] });
		expect(await getSnapshots(1, 7)).toEqual([]);
	});

	it("saves a training and returns the id, null on failure", async () => {
		const plan: PlanData = {
			kind: "fallback",
			createdBy: "fallback",
			inputs: { profile: { name: "A", age: 30, gender: null, heightCm: 170, weightKg: 60, goal: "stay-fit", experience: "beginner", location: "home", equipment: [], durationMin: 30, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none" }, stats: [], wishes: [] },
			summary: "s",
			planned: [],
		};
		mockFetch({ id: 5 }, 201);
		expect(await saveTraining(1, "hanna", plan)).toBe(5);
		vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
		expect(await saveTraining(1, "hanna", plan)).toBeNull();
	});

	it("picks the trainer tov, with a fallback", async () => {
		mockFetch({ trainers: [{ id: "hanna", name: "Hanna", pathToImage: "/x", tov: "Calm." }] });
		expect(await getTrainerTov("hanna")).toEqual({ name: "Hanna", tov: "Calm." });
		expect(await getTrainerTov("nobody")).toEqual({ name: "Coach", tov: "Friendly, clear and encouraging." });
	});
});
