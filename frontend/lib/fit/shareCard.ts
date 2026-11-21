import { isCancelled, shareText, type ShareResult } from "./share";

/** What the image shows: one big number or word, a headline above it and a line below. */
export interface ShareCardSpec {
	headline: string;
	value: string;
	line: string;
}

export interface ShareCaps {
	canShare: boolean;
	canShareFiles: boolean;
}

export function planShare(caps: ShareCaps): "files" | "text" | "copy" {
	if (!caps.canShare) return "copy";
	return caps.canShareFiles ? "files" : "text";
}

/** Resolves with `fallback` if the promise has not settled in `ms` (canvas encoding can stall in throttled tabs). */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => resolve(fallback), ms);
		promise.then((v) => { clearTimeout(timer); resolve(v); }, (e: unknown) => { clearTimeout(timer); reject(e); });
	});
}

const SIZE = { w: 1080, h: 1350 };
const FILE_NAME = "personal-coach.png";

/** A 1080x1350 PNG for social posts. Null where canvas is unavailable. Only the user's own stat and the app name are drawn. */
export async function renderShareCard(spec: ShareCardSpec): Promise<File | null> {
	if (typeof document === "undefined") return null;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE.w;
	canvas.height = SIZE.h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	const gradient = ctx.createLinearGradient(0, 0, SIZE.w, SIZE.h);
	gradient.addColorStop(0, "#15151a");
	gradient.addColorStop(1, "#2b2030");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, SIZE.w, SIZE.h);
	ctx.fillStyle = "#c5f54a";
	ctx.fillRect(96, 160, 120, 12);
	ctx.textBaseline = "alphabetic";
	ctx.fillStyle = "#c5f54a";
	ctx.font = "700 56px system-ui, sans-serif";
	ctx.fillText(spec.headline.toUpperCase(), 96, 260);
	ctx.fillStyle = "#ffffff";
	ctx.font = "800 360px system-ui, sans-serif";
	ctx.fillText(spec.value, 96, 700, SIZE.w - 192);
	ctx.font = "600 64px system-ui, sans-serif";
	ctx.fillText(spec.line, 96, 820, SIZE.w - 192);
	ctx.fillStyle = "#9a9aa6";
	ctx.font = "700 48px system-ui, sans-serif";
	ctx.fillText("Personal Coach", 96, SIZE.h - 120);
	const blob = await withTimeout(new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")), 3000, null);
	return blob ? new File([blob], FILE_NAME, { type: "image/png" }) : null;
}

/** Shares text plus an image card through the device share sheet; text only or a clipboard copy where that is all there is. Never throws. */
export async function shareCard(title: string, text: string, spec: ShareCardSpec): Promise<ShareResult> {
	try {
		const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
		const file = canShare ? await renderShareCard(spec) : null;
		const canShareFiles = canShare && file !== null && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
		const plan = planShare({ canShare, canShareFiles });
		if (plan === "files" && file) {
			await navigator.share({ title, text, files: [file] });
			return "shared";
		}
		return await shareText(title, text);
	} catch (error) {
		return isCancelled(error) ? "shared" : "failed";
	}
}
