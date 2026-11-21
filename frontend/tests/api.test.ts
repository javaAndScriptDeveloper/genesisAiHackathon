import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { fetchTrainers } from "@/lib/api/trainers";
import { ApiError, itemsResponseSchema } from "@/lib/api/types";

afterEach(() => vi.unstubAllGlobals());

const stub = (body: unknown, ok = true, status = 200) =>
	vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => body })));

describe("apiFetch", () => {
	it("returns parsed data", async () => {
		stub({ items: [], total: 0 });
		await expect(apiFetch("/items", itemsResponseSchema)).resolves.toEqual({ items: [], total: 0 });
	});
	it("rejects with ApiError on bad shape", async () => {
		stub({ nope: true });
		await expect(apiFetch("/items", itemsResponseSchema)).rejects.toBeInstanceOf(ApiError);
	});
	it("rejects with ApiError on http failure", async () => {
		stub({}, false, 500);
		await expect(apiFetch("/items", itemsResponseSchema)).rejects.toMatchObject({ status: 500 });
	});
});

describe("fetchTrainers", () => {
	const trainer = { id: "mike", name: "Mike", pathToImage: "/trainers/mike.svg", tov: "Blunt." };
	it("parses the backend payload", async () => {
		stub({ trainers: [trainer] });
		await expect(fetchTrainers()).resolves.toEqual([trainer]);
	});
	it("calls the real backend path, not the mock api", async () => {
		stub({ trainers: [] });
		await fetchTrainers();
		expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/trainers");
	});
	it("throws ApiError on a malformed payload", async () => {
		stub({ trainers: [{ id: "x" }] });
		await expect(fetchTrainers()).rejects.toBeInstanceOf(ApiError);
	});
	it("throws ApiError on http failure", async () => {
		stub({}, false, 503);
		await expect(fetchTrainers()).rejects.toMatchObject({ status: 503 });
	});
});
