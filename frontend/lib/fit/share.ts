export type ShareResult = "shared" | "copied" | "failed";

/** The user closed the share sheet without choosing an app: not an error. */
export const isCancelled = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

/** Clipboard API where the page is a secure context; legacy copy command otherwise (the demo runs on plain http). */
async function copyText(text: string): Promise<boolean> {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		}
		if (typeof document === "undefined") return false;
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(area);
		return ok;
	} catch {
		return false;
	}
}

/** Native share sheet where available, clipboard otherwise. Never throws. */
export async function shareText(title: string, text: string): Promise<ShareResult> {
	try {
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			await navigator.share({ title, text });
			return "shared";
		}
		if (await copyText(text)) return "copied";
		return "failed";
	} catch (error) {
		return isCancelled(error) ? "shared" : "failed";
	}
}
