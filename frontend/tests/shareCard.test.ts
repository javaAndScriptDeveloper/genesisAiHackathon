import { afterEach, describe, expect, it, vi } from "vitest";
import { planShare, renderShareCard, shareCard, withTimeout } from "@/lib/fit/shareCard";
import { shareText } from "@/lib/fit/share";

afterEach(() => vi.unstubAllGlobals());

const spec = { headline: "Streak", value: "7", line: "weeks in a row" };
const abort = () => Object.assign(new Error("cancelled"), { name: "AbortError" });

describe("planShare", () => {
	it("copies when the browser cannot share at all", () => expect(planShare({ canShare: false, canShareFiles: false })).toBe("copy"));
	it("shares text when files are not supported", () => expect(planShare({ canShare: true, canShareFiles: false })).toBe("text"));
	it("shares the image file when supported", () => expect(planShare({ canShare: true, canShareFiles: true })).toBe("files"));
	it("copies when it claims file support without share", () => expect(planShare({ canShare: false, canShareFiles: true })).toBe("copy"));
});

describe("renderShareCard", () => {
	it("returns null where there is no canvas (server, tests)", async () => {
		expect(await renderShareCard(spec)).toBeNull();
	});
});

describe("shareCard", () => {
	it("falls back to copying the text when sharing is unavailable", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { clipboard: { writeText } });
		expect(await shareCard("t", "hello", spec)).toBe("copied");
		expect(writeText).toHaveBeenCalledWith("hello");
	});
	it("shares text when sharing exists but there is no image", async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { share });
		expect(await shareCard("t", "hello", spec)).toBe("shared");
		expect(share).toHaveBeenCalledWith({ title: "t", text: "hello" });
	});
	it("treats a cancelled share sheet as done, not as a failure", async () => {
		vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(abort()) });
		expect(await shareCard("t", "hello", spec)).toBe("shared");
		expect(await shareText("t", "hello")).toBe("shared");
	});
	it("reports a real failure", async () => {
		vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(new Error("nope")) });
		expect(await shareCard("t", "hello", spec)).toBe("failed");
		vi.stubGlobal("navigator", {});
		expect(await shareCard("t", "hello", spec)).toBe("failed");
	});
});

describe("withTimeout", () => {
	it("resolves with the promise when it is fast", async () => {
		expect(await withTimeout(Promise.resolve("ok"), 50, "late")).toBe("ok");
	});
	it("falls back when the promise never settles", async () => {
		vi.useFakeTimers();
		const pending = withTimeout(new Promise<string>(() => undefined), 3000, "fallback");
		await vi.advanceTimersByTimeAsync(3000);
		expect(await pending).toBe("fallback");
		vi.useRealTimers();
	});
});

describe("copy without the clipboard API (plain http)", () => {
	it("falls back to the legacy copy command", async () => {
		const textarea = { value: "", style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn() };
		const exec = vi.fn().mockReturnValue(true);
		vi.stubGlobal("navigator", {});
		vi.stubGlobal("document", { createElement: () => textarea, body: { appendChild: vi.fn(), removeChild: vi.fn() }, execCommand: exec });
		expect(await shareText("t", "hello")).toBe("copied");
		expect(textarea.value).toBe("hello");
		expect(exec).toHaveBeenCalledWith("copy");
	});
	it("fails when nothing can copy", async () => {
		vi.stubGlobal("navigator", {});
		expect(await shareText("t", "hello")).toBe("failed");
	});
});
