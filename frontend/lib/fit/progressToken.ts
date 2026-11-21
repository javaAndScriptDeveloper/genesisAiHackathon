// The browser has no login: the user is the device's progress token (FitState.progressToken, a UUID). The browser
// sends it as `x-progress-token` to platform-backend and to the Next AI routes, which pass it on to the backend.

export const PROGRESS_TOKEN_HEADER = "x-progress-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isProgressToken = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** Reads the token from a request: `null` when absent, `"invalid"` when present but not a UUID. */
export function progressTokenOf(request: Request): string | null | "invalid" {
	const header = request.headers.get(PROGRESS_TOKEN_HEADER);
	if (header === null || header === "") return null;
	return isProgressToken(header) ? header.toLowerCase() : "invalid";
}
