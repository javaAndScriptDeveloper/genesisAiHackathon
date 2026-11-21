/** Charset the photo-insight route accepts in free-text context fields. Shared by server schema and client sanitizer. */
export const SAFE_TEXT_RE = /^[\p{L}\p{N} .,'()%/+:-]+$/u;
const DISALLOWED = /[^\p{L}\p{N} .,'()%/+:-]/gu;

/** Makes `s` valid for the server's safeText(max): typographic apostrophes become ', other disallowed characters are dropped. */
export function sanitizeRecordText(s: string, max = 60): string {
	return s
		.replace(/[‘’ʼ]/g, "'")
		.replace(DISALLOWED, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, max)
		.trim();
}

export const clampText = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s);
