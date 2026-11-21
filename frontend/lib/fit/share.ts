export type ShareResult = "shared" | "copied" | "failed";

/** Native share sheet where available, clipboard otherwise. Never throws. */
export async function shareText(title: string, text: string): Promise<ShareResult> {
	try {
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			await navigator.share({ title, text });
			return "shared";
		}
		await navigator.clipboard.writeText(text);
		return "copied";
	} catch {
		return "failed";
	}
}
