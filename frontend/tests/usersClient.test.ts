import { afterEach, describe, expect, it, vi } from "vitest";
import { createUser, userPayload } from "@/lib/api/users";
import type { Profile } from "@/lib/fit/types";

const profile: Profile = { name: "  Kate ", age: 30, gender: "female", heightCm: 170, weightKg: 62.5, goal: "stay-fit", experience: "beginner", location: "home", equipment: [], durationMin: 30, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none" };
const TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => vi.unstubAllGlobals());

describe("userPayload", () => {
	it("maps the onboarding profile to the API body", () => {
		expect(userPayload(profile, "hanna")).toEqual({ name: "Kate", gender: "female", weightKg: 62.5, heightCm: 170, level: "beginner", trainerId: "hanna" });
	});
	it("omits gender and trainer when not chosen", () => {
		const body = userPayload({ ...profile, gender: null }, null);
		expect(body).not.toHaveProperty("gender");
		expect(body).not.toHaveProperty("trainerId");
	});
});

describe("createUser", () => {
	it("POSTs to /api/users with the progress token and reports success", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
		vi.stubGlobal("fetch", fetchMock);
		expect(await createUser(profile, null, TOKEN)).toBe(true);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/users");
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>)["x-progress-token"]).toBe(TOKEN);
		expect(JSON.parse(String(init.body)).name).toBe("Kate");
	});
	it("returns false instead of throwing when the server errors or is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
		expect(await createUser(profile, null, TOKEN)).toBe(false);
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		expect(await createUser(profile, null, TOKEN)).toBe(false);
	});
});
