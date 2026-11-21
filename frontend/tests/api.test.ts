import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
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
