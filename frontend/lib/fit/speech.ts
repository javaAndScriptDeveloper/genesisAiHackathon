// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface RecognitionResultLike {
	readonly 0: { readonly transcript: string };
	readonly isFinal: boolean;
}
interface RecognitionEventLike {
	readonly results: { readonly length: number; readonly [index: number]: RecognitionResultLike };
}
interface RecognitionLike {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	onresult: ((event: RecognitionEventLike) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
	if (typeof window === "undefined") return null;
	const w: Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } = window;
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => getCtor() !== null;

/** Starts one dictation. Returns a stop function, or null when the browser lacks support (callers fall back to typing). */
export function listenOnce(handlers: { onText: (text: string) => void; onEnd: () => void; onError: () => void }): (() => void) | null {
	const Ctor = getCtor();
	if (!Ctor) return null;
	const rec = new Ctor();
	rec.lang = "en-US";
	rec.interimResults = false;
	rec.continuous = false;
	rec.onresult = (event) => {
		const last = event.results[event.results.length - 1];
		if (last) handlers.onText(last[0].transcript);
	};
	rec.onerror = handlers.onError;
	rec.onend = handlers.onEnd;
	rec.start();
	return () => rec.stop();
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20 };

/** Parses phrases like "10 reps at 20 kilos" or "twelve reps" into a set entry. */
export function parseSetPhrase(text: string): { reps?: number; weight?: number } {
	const lower = text.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty)\b/g, (m) => String(NUMBER_WORDS[m] ?? m));
	const reps = /(\d+)\s*(?:reps?|repetitions?|times)/.exec(lower)?.[1];
	const weight = /(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)/.exec(lower)?.[1];
	return { reps: reps ? Number(reps) : undefined, weight: weight ? Number(weight) : undefined };
}
